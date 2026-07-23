from __future__ import annotations

import io
import json
import uuid
from typing import Any

import openpyxl
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.api.deps import get_current_active_user, get_unit_of_work
from app.application.services.import_engine_service import ImportEngineService
from app.domain.import_schema import ENTITY_IMPORT_SCHEMAS
from app.infrastructure.persistence.models.user import User
from app.infrastructure.persistence.unit_of_work import UnitOfWork

router = APIRouter(prefix="/api/v1/import", tags=["Excel Import Engine"])


class ExecuteImportRequest(BaseModel):
    entity_type: str
    column_mapping: dict[str, str]
    mode: str = "insert"  # insert | upsert
    strategy: str = "skip_invalid"  # skip_invalid | rollback_all


@router.get("/schemas", summary="Get supported import entity schemas")
async def get_import_schemas(
    current_user: User = Depends(get_current_active_user),
) -> list[dict[str, Any]]:
    return [
        {
            "entity_type": schema.entity_type,
            "display_name": schema.display_name,
            "columns": [
                {
                    "key": c.key,
                    "label": c.label,
                    "required": c.required,
                    "type": c.type,
                    "enum_values": c.enum_values,
                    "description": c.description,
                }
                for c in schema.columns
            ],
        }
        for schema in ENTITY_IMPORT_SCHEMAS.values()
    ]


@router.get("/template/{entity_type}", summary="Download sample Excel template")
async def download_template(
    entity_type: str,
    current_user: User = Depends(get_current_active_user),
    uow: UnitOfWork = Depends(get_unit_of_work),
) -> StreamingResponse:
    if entity_type not in ENTITY_IMPORT_SCHEMAS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown entity type '{entity_type}'.",
        )

    service = ImportEngineService(uow)
    file_bytes = service.generate_sample_template(entity_type)
    filename = f"{entity_type}_import_template.xlsx"

    return StreamingResponse(
        io.BytesIO(file_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/preview", summary="Preview and validate Excel import file")
async def preview_import(
    entity_type: str = Form(...),
    file: UploadFile = File(...),
    custom_mapping_json: str | None = Form(None),
    current_user: User = Depends(get_current_active_user),
    uow: UnitOfWork = Depends(get_unit_of_work),
) -> dict[str, Any]:
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Please upload an Excel file (.xlsx or .xls).",
        )

    contents = await file.read()
    service = ImportEngineService(uow)

    custom_mapping = None
    if custom_mapping_json:
        try:
            custom_mapping = json.loads(custom_mapping_json)
        except Exception:
            pass

    try:
        report = await service.preview_and_validate(
            file_bytes=contents,
            file_name=file.filename,
            entity_type=entity_type,
            custom_mapping=custom_mapping,
        )
        return report
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        )


@router.post("/execute", summary="Execute data import transaction")
async def execute_import(
    entity_type: str = Form(...),
    mode: str = Form("insert"),
    strategy: str = Form("skip_invalid"),
    column_mapping_json: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    uow: UnitOfWork = Depends(get_unit_of_work),
) -> dict[str, Any]:
    contents = await file.read()
    service = ImportEngineService(uow)

    try:
        mapping = json.loads(column_mapping_json)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid column_mapping_json payload.",
        )

    try:
        result = await service.execute_import(
            file_bytes=contents,
            file_name=file.filename,
            entity_type=entity_type,
            column_mapping=mapping,
            mode=mode,
            strategy=strategy,
            user_id=current_user.id,
            user_email=current_user.email,
        )
        return result
    except Exception as e:
        import logging
        logging.error("Exception during execute_import: %s", str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        )


@router.get("/history", summary="Get import history logs")
async def get_import_history(
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
    uow: UnitOfWork = Depends(get_unit_of_work),
) -> list[dict[str, Any]]:
    history = await uow.import_history.get_recent_history(limit=limit)
    return [
        {
            "id": str(h.id),
            "entity_type": h.entity_type,
            "file_name": h.file_name,
            "file_size": h.file_size,
            "user_email": h.user_email or "System",
            "total_rows": h.total_rows,
            "imported_count": h.imported_count,
            "updated_count": h.updated_count,
            "skipped_count": h.skipped_count,
            "failed_count": h.failed_count,
            "duration_ms": h.duration_ms,
            "mode": h.mode,
            "strategy": h.strategy,
            "status": h.status,
            "errors_summary": h.errors_summary,
            "created_at": h.created_at.isoformat() if h.created_at else None,
        }
        for h in history
    ]


@router.post("/export-errors", summary="Export validation error report")
async def export_error_report(
    errors_json: str = Form(...),
    file_name: str = Form("import_errors.xlsx"),
    current_user: User = Depends(get_current_active_user),
) -> StreamingResponse:
    try:
        errors = json.loads(errors_json)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid errors JSON payload.",
        )

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Validation Errors"

    headers = ["Row #", "Column / Field", "Raw Cell Value", "Error Type", "Description"]
    ws.append(headers)

    for err in errors:
        ws.append([
            err.get("row_index", 0),
            err.get("column_name", ""),
            str(err.get("raw_value", "")),
            err.get("error_type", ""),
            err.get("message", ""),
        ])

    output = io.BytesIO()
    wb.save(output)
    return StreamingResponse(
        io.BytesIO(output.getvalue()),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="error_report_{file_name}"'},
    )

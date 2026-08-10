from __future__ import annotations

import io
import json
import logging
import time
import traceback
import uuid
from typing import Any

import openpyxl
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.api.deps import get_current_active_user, get_unit_of_work
from app.application.services.import_engine_service import ImportEngineService
from app.application.services.template_context_service import TemplateContextService
from app.application.services.excel_header_extractor import ExcelHeaderExtractor
from app.application.services.ollama_mapping_service import OllamaMappingService
from app.application.services.mapping_cache_service import MappingCacheService
from app.domain.import_schema import ENTITY_IMPORT_SCHEMAS
from app.infrastructure.persistence.models.user import User
from app.infrastructure.persistence.unit_of_work import UnitOfWork

logger = logging.getLogger(__name__)

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


@router.get("/import-templates", summary="Get available project templates for import selection")
async def get_import_templates(
    current_user: User = Depends(get_current_active_user),
    uow: UnitOfWork = Depends(get_unit_of_work),
) -> list[dict[str, Any]]:
    """
    Returns all published project templates (K0, K9, etc.) suitable for selection
    at the start of the AI-powered import workflow.
    """
    from app.application.services.template_service import TemplateService
    start_t = time.perf_counter()
    svc = TemplateService(uow)
    result = await svc.get_templates()
    duration_ms = round((time.perf_counter() - start_t) * 1000, 2)
    logger.info("Loaded %d published templates in %.2f ms", len(result.items), duration_ms)
    return [
        {
            "id": str(t.id),
            "code": t.code,
            "name": t.name,
            "description": t.description or "",
            "version": t.version,
            "status": t.status,
        }
        for t in result.items
        if t.status == "PUBLISHED"
    ]


@router.post("/extract-headers", summary="Extract only column headers from an Excel file")
async def extract_excel_headers(
    file: UploadFile = File(...),
    header_row: int | None = Form(None),
    sheet_name: str | None = Form(None),
    orientation: str | None = Form(None),
    current_user: User = Depends(get_current_active_user),
) -> dict[str, Any]:
    """
    Parses the uploaded Excel file and returns ONLY column headers.
    Automatically detects worksheet, header row, and orientation (HORIZONTAL vs VERTICAL).
    Optionally accepts user-specified sheet_name, header_row, and orientation overrides.
    """
    start_t = time.perf_counter()
    if not file.filename.endswith((".xlsx", ".xls", ".xlsm")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Please upload an Excel file (.xlsx, .xls, .xlsm).",
        )
    contents = await file.read()
    try:
        headers, detected_row, header_conf, sheet_used, sheet_conf, row_previews, duration_ms, orient_info = ExcelHeaderExtractor.extract_headers_with_details(
            contents, specified_header_row=header_row, specified_sheet_name=sheet_name, specified_orientation=orientation
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    logger.info(
        "[HEADER DETECTION] File: '%s' | Sheet: '%s' (%.1f%%) | Orient: %s (%.1f%%) | Headers: %d | Elapsed: %.2f ms",
        file.filename, sheet_used, sheet_conf, orient_info["orientation"], orient_info["orientation_confidence"], len(headers), duration_ms
    )
    return {
        "file_name": file.filename,
        "header_count": len(headers),
        "headers": headers,
        "sheet_used": sheet_used,
        "sheet_confidence": sheet_conf,
        "detected_header_row": detected_row,
        "header_confidence": header_conf,
        "row_previews": row_previews,
        "extraction_duration_ms": duration_ms,
        "orientation": orient_info["orientation"],
        "orientation_confidence": orient_info["orientation_confidence"],
        "field_column": orient_info["field_column"],
        "value_column": orient_info["value_column"],
        "orientation_reason": orient_info["reason"],
    }


@router.post("/ollama-map", summary="AI semantic column mapping via local Ollama RAG")
async def ollama_semantic_map(
    template_identifier: str = Form(...),
    headers_json: str = Form("[]"),
    header_row: int | None = Form(None),
    sheet_name: str | None = Form(None),
    orientation: str | None = Form(None),
    file: UploadFile | None = File(None),
    current_user: User = Depends(get_current_active_user),
    uow: UnitOfWork = Depends(get_unit_of_work),
) -> dict[str, Any]:
    """
    Performs RAG-powered semantic mapping between Excel headers and template database fields.
    """
    total_start = time.perf_counter()
    header_start = time.perf_counter()
    excel_read_ms = 0.0
    detected_header_row = 1
    header_confidence = 90.0
    sheet_used = sheet_name or ""
    sheet_confidence = 90.0
    row_previews: list[dict] = []
    orient_info = {"orientation": "HORIZONTAL", "orientation_confidence": 90.0, "field_column": "", "value_column": "", "reason": ""}

    # Resolve headers
    excel_headers: list[str] = []
    if headers_json and headers_json.strip() != "[]":
        try:
            excel_headers = json.loads(headers_json)
            if not isinstance(excel_headers, list):
                excel_headers = []
        except Exception:
            excel_headers = []

    if not excel_headers and file is not None and file.filename:
        contents = await file.read()
        try:
            excel_headers, detected_header_row, header_confidence, sheet_used, sheet_confidence, row_previews, excel_read_ms, orient_info = ExcelHeaderExtractor.extract_headers_with_details(
                contents, specified_header_row=header_row, specified_sheet_name=sheet_name, specified_orientation=orientation
            )
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    else:
        excel_read_ms = round((time.perf_counter() - header_start) * 1000, 2)

    logger.info("[OLLAMA MAP DEBUG] Sheet: '%s' | Orient: %s | Headers (%d): %r",
                sheet_used, orient_info.get("orientation"), len(excel_headers), excel_headers)

    header_resolution_ms = round((time.perf_counter() - header_start) * 1000, 2)

    if not excel_headers:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No Excel headers provided or found.")

    # Build template context for RAG
    tmpl_start = time.perf_counter()
    ctx_svc = TemplateContextService(uow)
    try:
        template_context = await ctx_svc.get_template_context(template_identifier)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to resolve template: {e}")

    template_loading_ms = round((time.perf_counter() - tmpl_start) * 1000, 2)

    if not template_context.fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Template '{template_identifier}' has no field definitions to map against.",
        )

    # Run Ollama RAG mapping
    ollama_svc = OllamaMappingService()
    try:
        result = await ollama_svc.generate_mapping(template_context, excel_headers, excel_read_ms=excel_read_ms)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Mapping service error: {e}")

    total_duration_ms = round((time.perf_counter() - total_start) * 1000, 2)
    exec_times = result.get("execution_times", {})
    exec_times["total_mapping_ms"] = total_duration_ms
    exec_times["header_resolution_ms"] = header_resolution_ms
    exec_times["template_loading_ms"] = template_loading_ms

    return {
        "template_code": template_context.template_code,
        "template_name": template_context.template_name,
        "excel_headers": excel_headers,
        "sheet_used": sheet_used,
        "sheet_confidence": sheet_confidence,
        "detected_header_row": detected_header_row,
        "header_confidence": header_confidence,
        "row_previews": row_previews,
        "mapping": result["mapping"],
        "prompt_used": result.get("prompt_used", ""),
        "ollama_active": result.get("ollama_active", False),
        "ollama_reachable": result.get("ollama_reachable", False),
        "model": result.get("model", ""),
        "fallback_reason": result.get("fallback_reason"),
        "execution_times": exec_times,
        "orientation": orient_info.get("orientation", "HORIZONTAL"),
        "orientation_confidence": orient_info.get("orientation_confidence", 90.0),
        "field_column": orient_info.get("field_column", ""),
        "value_column": orient_info.get("value_column", ""),
        "orientation_reason": orient_info.get("reason", ""),
        "field_definitions": [
            {
                "key": f.key,
                "label": f.label,
                "description": f.description,
                "required": f.required,
                "type": f.type,
                "aliases": f.aliases,
            }
            for f in template_context.fields
        ],
    }


@router.post("/save-mapping-memory", summary="Persist user-confirmed mapping memory")
async def save_mapping_memory(
    template_code: str = Form(...),
    mapping_json: str = Form(...),
    current_user: User = Depends(get_current_active_user),
) -> dict[str, Any]:
    try:
        mapping = json.loads(mapping_json)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid mapping_json payload.")

    MappingCacheService.save_mapping_memory(template_code, mapping)
    return {"success": True, "saved_count": len(mapping)}


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
    orientation: str | None = Form(None),
    sheet_name: str | None = Form(None),
    current_user: User = Depends(get_current_active_user),
    uow: UnitOfWork = Depends(get_unit_of_work),
) -> dict[str, Any]:
    start_t = time.perf_counter()

    if not file.filename.endswith((".xlsx", ".xls", ".xlsm")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Import failed",
                "reason": "Invalid file format. Please upload an Excel file (.xlsx, .xls, .xlsm).",
                "uploaded_file": {"filename": file.filename},
                "selected_template": entity_type,
                "validation_errors": [],
                "serializer_errors": [],
            },
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
            orientation=orientation,
            sheet_name=sheet_name,
        )
        duration_ms = round((time.perf_counter() - start_t) * 1000, 2)
        report["preview_validation_ms"] = duration_ms
        return report
    except Exception as e:
        duration_ms = round((time.perf_counter() - start_t) * 1000, 2)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Import failed",
                "reason": str(e),
                "uploaded_file": {"filename": file.filename, "size_bytes": len(contents)},
                "selected_template": entity_type,
                "mapping_result": custom_mapping or {},
                "validation_errors": [],
                "serializer_errors": [],
                "execution_time_ms": duration_ms,
                "stack_trace": traceback.format_exc(),
            },
        )


@router.post("/execute", summary="Execute data import transaction")
async def execute_import(
    entity_type: str = Form(...),
    mode: str = Form("insert"),
    strategy: str = Form("skip_invalid"),
    column_mapping_json: str = Form(...),
    orientation: str | None = Form(None),
    sheet_name: str | None = Form(None),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    uow: UnitOfWork = Depends(get_unit_of_work),
) -> dict[str, Any]:
    start_t = time.perf_counter()
    contents = await file.read()
    service = ImportEngineService(uow)

    mapping: dict[str, str] = {}
    try:
        mapping = json.loads(column_mapping_json)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "Import failed", "reason": f"Invalid column_mapping_json payload: {e}"},
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
            orientation=orientation,
            sheet_name=sheet_name,
        )
        return result
    except Exception as e:
        duration_ms = round((time.perf_counter() - start_t) * 1000, 2)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Import failed",
                "reason": str(e),
                "execution_time_ms": duration_ms,
                "stack_trace": traceback.format_exc(),
            },
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

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query, UploadFile

from app.application.dto.documents import (
    CreateDocumentRequest,
    DocumentListResponse,
    DocumentResponse,
)
from app.application.services.document_service import DocumentService
from app.api.deps import get_current_active_user, get_document_service, get_unit_of_work
from app.infrastructure.persistence.models.user import User
from app.infrastructure.persistence.unit_of_work import UnitOfWork

router = APIRouter(prefix="/api/v1/documents", tags=["Documents"])


@router.post(
    "/upload",
    response_model=DocumentResponse,
    summary="Upload a document",
)
async def upload_document(
    file: UploadFile,
    title: str | None = Query(None, max_length=255),
    description: str | None = Query(None),
    document_type: str = Query("other"),
    project_id: uuid.UUID | None = Query(None),
    project_part_id: uuid.UUID | None = Query(None),
    current_user: User = Depends(get_current_active_user),
    document_service: DocumentService = Depends(get_document_service),
) -> Any:
    data = CreateDocumentRequest(
        title=title or (file.filename or "untitled"),
        description=description,
        document_type=document_type,
        project_id=project_id,
        project_part_id=project_part_id,
    )
    return await document_service.upload_document(file, data, user_id=current_user.id)


@router.get(
    "",
    response_model=DocumentListResponse,
    summary="List documents with filtering",
)
async def list_documents(
    document_type: str | None = Query(None),
    project_id: uuid.UUID | None = Query(None),
    project_part_id: uuid.UUID | None = Query(None),
    uploaded_by: uuid.UUID | None = Query(None),
    search: str | None = Query(None, max_length=200),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    uow: UnitOfWork = Depends(get_unit_of_work),
    document_service: DocumentService = Depends(get_document_service),
) -> Any:
    filters: dict[str, Any] = {}
    if document_type is not None:
        filters["document_type"] = document_type
    if project_id is not None:
        filters["project_id"] = project_id
    if project_part_id is not None:
        filters["project_part_id"] = project_part_id
    if uploaded_by is not None:
        filters["uploaded_by"] = uploaded_by

    total = await uow.documents.count(filters=filters)
    items = await uow.documents.get_multi(
        skip=skip,
        limit=limit,
        sort_by="created_at",
        sort_desc=True,
        filters=filters,
    )

    responses = [document_service._to_response(d) for d in items]
    return DocumentListResponse(
        items=responses,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/{id}",
    response_model=DocumentResponse,
    summary="Get document metadata by ID",
)
async def get_document(
    id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    document_service: DocumentService = Depends(get_document_service),
) -> Any:
    return await document_service.get_document(id)


@router.get(
    "/{id}/download",
    summary="Download document file",
)
async def download_document(
    id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    document_service: DocumentService = Depends(get_document_service),
) -> Any:
    return await document_service.download_document(id)


@router.delete(
    "/{id}",
    summary="Delete a document (soft delete)",
)
async def delete_document(
    id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    document_service: DocumentService = Depends(get_document_service),
) -> dict[str, bool]:
    result = await document_service.delete_document(id, user_id=current_user.id)
    return {"success": result}

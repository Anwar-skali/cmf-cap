from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends

from app.api.deps import get_current_active_user, get_unit_of_work
from app.application.dto.templates import (
    CreateTemplateRequest,
    TemplateListResponse,
    TemplateResponse,
    UpdateTemplateRequest,
)
from app.application.services.template_service import TemplateService
from app.infrastructure.persistence.models.user import User

router = APIRouter(prefix="/api/v1/templates", tags=["Templates"])


def get_template_service(uow=Depends(get_unit_of_work)) -> TemplateService:
    return TemplateService(uow)


@router.get("", response_model=TemplateListResponse, summary="List templates")
async def list_templates(
    current_user: User = Depends(get_current_active_user),
    service: TemplateService = Depends(get_template_service),
) -> Any:
    return await service.get_templates()


@router.get("/code/{code}", response_model=TemplateResponse, summary="Get template by code (e.g. K9)")
async def get_template_by_code(
    code: str,
    current_user: User = Depends(get_current_active_user),
    service: TemplateService = Depends(get_template_service),
) -> Any:
    return await service.get_template_by_code(code)


@router.get("/{id}", response_model=TemplateResponse, summary="Get template by ID")
async def get_template(
    id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    service: TemplateService = Depends(get_template_service),
) -> Any:
    return await service.get_template(id)


@router.post("", response_model=TemplateResponse, summary="Create a new template")
async def create_template(
    data: CreateTemplateRequest,
    current_user: User = Depends(get_current_active_user),
    service: TemplateService = Depends(get_template_service),
) -> Any:
    return await service.create_template(data)


@router.put("/{id}", response_model=TemplateResponse, summary="Update a template")
async def update_template(
    id: uuid.UUID,
    data: UpdateTemplateRequest,
    current_user: User = Depends(get_current_active_user),
    service: TemplateService = Depends(get_template_service),
) -> Any:
    return await service.update_template(id, data)


@router.post("/{id}/duplicate", response_model=TemplateResponse, summary="Duplicate a template")
async def duplicate_template(
    id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    service: TemplateService = Depends(get_template_service),
) -> Any:
    return await service.duplicate_template(id)


@router.post("/{id}/publish", response_model=TemplateResponse, summary="Publish a template")
async def publish_template(
    id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    service: TemplateService = Depends(get_template_service),
) -> Any:
    return await service.publish_template(id)


@router.post("/{id}/archive", response_model=TemplateResponse, summary="Archive a template")
async def archive_template(
    id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    service: TemplateService = Depends(get_template_service),
) -> Any:
    return await service.archive_template(id)


@router.delete("/{id}", summary="Delete a template")
async def delete_template(
    id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    service: TemplateService = Depends(get_template_service),
) -> dict[str, bool]:
    return {"success": await service.delete_template(id)}


@router.post("/import", response_model=TemplateResponse, summary="Import template JSON")
async def import_template_json(
    raw_json: dict[str, Any],
    current_user: User = Depends(get_current_active_user),
    service: TemplateService = Depends(get_template_service),
) -> Any:
    return await service.import_template_json(raw_json)


@router.get("/{id}/export", summary="Export template JSON")
async def export_template_json(
    id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    service: TemplateService = Depends(get_template_service),
) -> dict[str, Any]:
    tmpl = await service.get_template(id)
    return tmpl.schema_json

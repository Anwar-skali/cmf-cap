from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query

from app.application.dto.suppliers import (
    CreateSupplierRequest,
    SupplierFilter,
    SupplierListResponse,
    SupplierResponse,
    UpdateSupplierRequest,
)
from app.application.services.supplier_service import SupplierService
from app.api.deps import get_current_active_user, get_supplier_service
from app.core.exceptions import ForbiddenException
from app.infrastructure.persistence.models.user import User

router = APIRouter(prefix="/api/v1/suppliers", tags=["Suppliers"])


@router.get(
    "",
    response_model=SupplierListResponse,
    summary="List suppliers with search, filtering, and pagination",
)
async def list_suppliers(
    search: str | None = Query(None, max_length=200),
    status: str | None = Query(None),
    category: str | None = Query(None),
    country: str | None = Query(None),
    rating_min: int | None = Query(None, ge=1, le=5),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    sort_by: str | None = Query("created_at"),
    sort_desc: bool = Query(True),
    current_user: User = Depends(get_current_active_user),
    supplier_service: SupplierService = Depends(get_supplier_service),
) -> Any:
    filter_data = SupplierFilter(
        search=search,
        status=status,
        category=category,
        country=country,
        rating_min=rating_min,
        skip=skip,
        limit=limit,
        sort_by=sort_by,
        sort_desc=sort_desc,
    )
    return await supplier_service.get_suppliers(filter_data)


@router.post(
    "",
    response_model=SupplierResponse,
    summary="Create a new supplier",
)
async def create_supplier(
    data: CreateSupplierRequest,
    current_user: User = Depends(get_current_active_user),
    supplier_service: SupplierService = Depends(get_supplier_service),
) -> Any:
    return await supplier_service.create_supplier(data, user_id=current_user.id)


@router.get(
    "/{id}",
    response_model=SupplierResponse,
    summary="Get supplier by ID",
)
async def get_supplier(
    id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    supplier_service: SupplierService = Depends(get_supplier_service),
) -> Any:
    return await supplier_service.get_supplier(id)


@router.put(
    "/{id}",
    response_model=SupplierResponse,
    summary="Update a supplier",
)
async def update_supplier(
    id: uuid.UUID,
    data: UpdateSupplierRequest,
    current_user: User = Depends(get_current_active_user),
    supplier_service: SupplierService = Depends(get_supplier_service),
) -> Any:
    return await supplier_service.update_supplier(id, data, user_id=current_user.id)


@router.delete(
    "/{id}",
    summary="Delete a supplier (soft delete)",
)
async def delete_supplier(
    id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    supplier_service: SupplierService = Depends(get_supplier_service),
) -> dict[str, bool]:
    result = await supplier_service.delete_supplier(id, user_id=current_user.id)
    return {"success": result}


@router.post(
    "/{id}/assign/{project_id}",
    summary="Assign supplier to project",
)
async def assign_supplier_to_project(
    id: uuid.UUID,
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    supplier_service: SupplierService = Depends(get_supplier_service),
) -> dict[str, bool]:
    result = await supplier_service.assign_to_project(id, project_id)
    return {"success": result}


@router.delete(
    "/{id}/assign/{project_id}",
    summary="Remove supplier from project",
)
async def remove_supplier_from_project(
    id: uuid.UUID,
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    supplier_service: SupplierService = Depends(get_supplier_service),
) -> dict[str, bool]:
    result = await supplier_service.remove_from_project(id, project_id)
    return {"success": result}

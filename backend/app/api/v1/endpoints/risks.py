from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Body, Depends, Query

from app.application.dto.risks import (
    CreateRiskRequest,
    RiskDistributionResponse,
    RiskListResponse,
    RiskResponse,
    UpdateRiskRequest,
)
from app.application.services.risk_service import RiskService
from app.api.deps import get_current_active_user, get_risk_service, get_unit_of_work
from app.infrastructure.persistence.models.user import User
from app.infrastructure.persistence.unit_of_work import UnitOfWork

router = APIRouter(prefix="/api/v1/risks", tags=["Risks"])


@router.get(
    "",
    response_model=RiskListResponse,
    summary="List risks with filtering",
)
async def list_risks(
    severity: str | None = Query(None),
    status: str | None = Query(None),
    risk_type: str | None = Query(None),
    assigned_to: uuid.UUID | None = Query(None),
    project_part_id: uuid.UUID | None = Query(None),
    search: str | None = Query(None, max_length=200),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    sort_by: str | None = Query("created_at"),
    sort_desc: bool = Query(True),
    current_user: User = Depends(get_current_active_user),
    uow: UnitOfWork = Depends(get_unit_of_work),
    risk_service: RiskService = Depends(get_risk_service),
) -> Any:
    filters: dict[str, Any] = {}
    if severity is not None:
        filters["severity"] = severity
    if status is not None:
        filters["status"] = status
    if risk_type is not None:
        filters["risk_type"] = risk_type
    if assigned_to is not None:
        filters["assigned_to"] = assigned_to
    if project_part_id is not None:
        filters["project_part_id"] = project_part_id

    total = await uow.risks.count(filters=filters)
    items = await uow.risks.get_multi(
        skip=skip,
        limit=limit,
        sort_by=sort_by or "created_at",
        sort_desc=sort_desc,
        filters=filters,
    )

    responses = [risk_service._to_response(r) for r in items]
    return RiskListResponse(
        items=responses,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.post(
    "/sync",
    summary="Synchronize risks with industrial capacity assessments",
)
async def sync_risks(
    current_user: User = Depends(get_current_active_user),
    risk_service: RiskService = Depends(get_risk_service),
) -> dict[str, Any]:
    count = await risk_service.sync_capacity_risks()
    return {"status": "ok", "synced_assessments": count}


@router.post(
    "",
    response_model=RiskResponse,
    summary="Create a new risk",
)
async def create_risk(
    data: CreateRiskRequest,
    current_user: User = Depends(get_current_active_user),
    risk_service: RiskService = Depends(get_risk_service),
) -> Any:
    return await risk_service.create_risk(data, user_id=current_user.id)


@router.get(
    "/{id}",
    response_model=RiskResponse,
    summary="Get risk by ID",
)
async def get_risk(
    id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    uow: UnitOfWork = Depends(get_unit_of_work),
    risk_service: RiskService = Depends(get_risk_service),
) -> Any:
    from app.core.exceptions import NotFoundException

    risk = await uow.risks.get(id)
    if risk is None:
        raise NotFoundException("Risk not found")
    return risk_service._to_response(risk)


@router.put(
    "/{id}",
    response_model=RiskResponse,
    summary="Update a risk",
)
async def update_risk(
    id: uuid.UUID,
    data: UpdateRiskRequest,
    current_user: User = Depends(get_current_active_user),
    risk_service: RiskService = Depends(get_risk_service),
) -> Any:
    return await risk_service.update_risk(id, data, user_id=current_user.id)


@router.delete(
    "/{id}",
    summary="Delete a risk (soft delete)",
)
async def delete_risk(
    id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    risk_service: RiskService = Depends(get_risk_service),
) -> dict[str, bool]:
    result = await risk_service.delete_risk(id, user_id=current_user.id)
    return {"success": result}


@router.patch(
    "/{id}/mitigate",
    response_model=RiskResponse,
    summary="Mitigate a risk",
)
async def mitigate_risk(
    id: uuid.UUID,
    mitigation_details: str = Body(..., embed=True),
    current_user: User = Depends(get_current_active_user),
    risk_service: RiskService = Depends(get_risk_service),
) -> Any:
    return await risk_service.mitigate_risk(id, mitigation_details, user_id=current_user.id)


@router.patch(
    "/{id}/close",
    response_model=RiskResponse,
    summary="Close a risk",
)
async def close_risk(
    id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    risk_service: RiskService = Depends(get_risk_service),
) -> Any:
    return await risk_service.close_risk(id, user_id=current_user.id)


@router.get(
    "/distribution",
    response_model=RiskDistributionResponse,
    summary="Get risk distribution statistics",
)
async def risk_distribution(
    current_user: User = Depends(get_current_active_user),
    risk_service: RiskService = Depends(get_risk_service),
) -> Any:
    return await risk_service.get_distribution()

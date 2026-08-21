from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query

from app.application.dto.capacity import (
    CapacityAssessmentListResponse,
    CapacityAssessmentResponse,
    CapacityCoverageResponse,
    CapacityFilter,
    CreateCapacityAssessmentRequest,
    MonthlyCapacityResponse,
    UpdateCapacityAssessmentRequest,
)
from app.application.services.capacity_assessment_service import (
    CapacityAssessmentService,
)
from app.api.deps import (
    get_capacity_assessment_service,
    get_current_active_user,
    get_unit_of_work,
)
from app.infrastructure.persistence.models.user import User
from app.infrastructure.persistence.unit_of_work import UnitOfWork

router = APIRouter(prefix="/api/v1/capacity", tags=["Capacity Assessments"])


@router.get(
    "",
    response_model=CapacityAssessmentListResponse,
    summary="List capacity assessments with filtering",
)
async def list_capacity(
    month: int | None = Query(None, ge=1, le=12),
    year: int | None = Query(None, ge=2000, le=2100),
    status: str | None = Query(None),
    gate: str | None = Query(None),
    risk_level: str | None = Query(None),
    supplier_id: uuid.UUID | None = Query(None),
    project_part_id: uuid.UUID | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_active_user),
    uow: UnitOfWork = Depends(get_unit_of_work),
    capacity_service: CapacityAssessmentService = Depends(get_capacity_assessment_service),
) -> Any:
    filters: dict[str, Any] = {}
    if month is not None:
        filters["month"] = month
    if year is not None:
        filters["year"] = year
    if status is not None:
        filters["status"] = status
    if gate is not None:
        filters["gate"] = gate
    if risk_level is not None:
        filters["risk_level"] = risk_level
    if supplier_id is not None:
        filters["supplier_id"] = supplier_id
    if project_part_id is not None:
        filters["project_part_id"] = project_part_id

    total = await uow.capacity_assessments.count(filters=filters)
    assessments = await uow.capacity_assessments.get_multi(
        skip=skip,
        limit=limit,
        sort_by="created_at",
        sort_desc=True,
        filters=filters,
    )

    responses = [capacity_service._to_response(a) for a in assessments]
    return CapacityAssessmentListResponse(
        items=responses,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.post(
    "",
    response_model=CapacityAssessmentResponse,
    summary="Create a capacity assessment",
)
async def create_capacity(
    data: CreateCapacityAssessmentRequest,
    current_user: User = Depends(get_current_active_user),
    capacity_service: CapacityAssessmentService = Depends(get_capacity_assessment_service),
) -> Any:
    return await capacity_service.create_assessment(data, user_id=current_user.id)


@router.get(
    "/{id}",
    response_model=CapacityAssessmentResponse,
    summary="Get capacity assessment by ID",
)
async def get_capacity(
    id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    uow: UnitOfWork = Depends(get_unit_of_work),
    capacity_service: CapacityAssessmentService = Depends(get_capacity_assessment_service),
) -> Any:
    from app.core.exceptions import NotFoundException

    assessment = await uow.capacity_assessments.get(id)
    if assessment is None:
        raise NotFoundException("Capacity assessment not found")
    return capacity_service._to_response(assessment)


@router.put(
    "/{id}",
    response_model=CapacityAssessmentResponse,
    summary="Update a capacity assessment",
)
async def update_capacity(
    id: uuid.UUID,
    data: UpdateCapacityAssessmentRequest,
    current_user: User = Depends(get_current_active_user),
    capacity_service: CapacityAssessmentService = Depends(get_capacity_assessment_service),
) -> Any:
    return await capacity_service.update_assessment(id, data, user_id=current_user.id)


@router.delete(
    "/{id}",
    summary="Delete a capacity assessment (soft delete)",
)
async def delete_capacity(
    id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    capacity_service: CapacityAssessmentService = Depends(get_capacity_assessment_service),
) -> dict[str, bool]:
    result = await capacity_service.delete_assessment(id, user_id=current_user.id)
    return {"success": result}


@router.get(
    "/coverage",
    response_model=CapacityCoverageResponse,
    summary="Get capacity coverage statistics",
)
async def capacity_coverage(
    current_user: User = Depends(get_current_active_user),
    capacity_service: CapacityAssessmentService = Depends(get_capacity_assessment_service),
) -> Any:
    return await capacity_service.get_coverage()


@router.get(
    "/monthly/{year}/{month}",
    response_model=list[MonthlyCapacityResponse],
    summary="Get monthly capacity data",
)
async def monthly_capacity(
    year: int,
    month: int,
    current_user: User = Depends(get_current_active_user),
    capacity_service: CapacityAssessmentService = Depends(get_capacity_assessment_service),
) -> Any:
    return await capacity_service.get_monthly(year, month)

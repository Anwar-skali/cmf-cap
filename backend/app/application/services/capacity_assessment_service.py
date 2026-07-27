from __future__ import annotations

import uuid
from typing import Any

from app.application.dto.capacity import (
    CapacityAssessmentListResponse,
    CapacityAssessmentResponse,
    CapacityCoverageResponse,
    CapacityFilter,
    CreateCapacityAssessmentRequest,
    MonthlyCapacityResponse,
    UpdateCapacityAssessmentRequest,
)
from app.application.interfaces.services import IUnitOfWork
from app.core.exceptions import NotFoundException, ConflictException, BadRequestException
from app.domain.enums import ActivityAction


class CapacityAssessmentService:
    def __init__(self, uow: IUnitOfWork) -> None:
        self._uow = uow

    async def create_assessment(self, data: CreateCapacityAssessmentRequest, user_id: uuid.UUID | None = None) -> CapacityAssessmentResponse:
        part_id = uuid.UUID(str(data.project_part_id)) if not isinstance(data.project_part_id, uuid.UUID) else data.project_part_id
        sup_id = uuid.UUID(str(data.supplier_id)) if not isinstance(data.supplier_id, uuid.UUID) else data.supplier_id

        part = await self._uow.project_parts.get(part_id)
        if part is None:
            raise NotFoundException("Project part not found")

        supplier = await self._uow.suppliers.get(sup_id)
        if supplier is None:
            raise NotFoundException("Supplier not found")

        if data.maximum_capacity <= 0:
            raise BadRequestException("Maximum capacity must be greater than zero")

        assessment_data = data.model_dump(exclude_unset=True)
        assessment_data["project_part_id"] = part_id
        assessment_data["supplier_id"] = sup_id
        if user_id is not None:
            assessment_data["assessed_by"] = user_id

        assessment = await self._uow.capacity_assessments.create(assessment_data)

        await self._uow.activity_logs.create({
            "user_id": user_id,
            "action": ActivityAction.CREATE.value,
            "resource_type": "capacity_assessment",
            "resource_id": str(assessment.id),
            "details": {
                "project_part_id": str(part_id),
                "supplier_id": str(sup_id),
            },
        })


        await self._uow.commit()
        return self._to_response(assessment)

    async def update_assessment(self, id: uuid.UUID, data: UpdateCapacityAssessmentRequest, user_id: uuid.UUID | None = None) -> CapacityAssessmentResponse:
        assessment = await self._uow.capacity_assessments.get(id)
        if assessment is None:
            raise NotFoundException("Capacity assessment not found")

        update_data = data.model_dump(exclude_unset=True, exclude_none=True)
        if not update_data:
            return self._to_response(assessment)

        if "maximum_capacity" in update_data and update_data["maximum_capacity"] is not None and update_data["maximum_capacity"] <= 0:
            raise BadRequestException("Maximum capacity must be greater than zero")

        assessment = await self._uow.capacity_assessments.update(id, update_data)
        if assessment is None:
            raise NotFoundException("Capacity assessment not found")

        await self._uow.activity_logs.create({
            "user_id": user_id,
            "action": ActivityAction.UPDATE.value,
            "resource_type": "capacity_assessment",
            "resource_id": str(id),
            "details": {"updated_fields": list(update_data.keys())},
        })

        await self._uow.commit()
        return self._to_response(assessment)

    async def delete_assessment(self, id: uuid.UUID, user_id: uuid.UUID | None = None) -> bool:
        assessment = await self._uow.capacity_assessments.get(id)
        if assessment is None:
            raise NotFoundException("Capacity assessment not found")

        result = await self._uow.capacity_assessments.delete(id)

        await self._uow.activity_logs.create({
            "user_id": user_id,
            "action": ActivityAction.DELETE.value,
            "resource_type": "capacity_assessment",
            "resource_id": str(id),
        })

        await self._uow.commit()
        return result

    async def get_by_part(self, project_part_id: uuid.UUID) -> list[CapacityAssessmentResponse]:
        assessments = await self._uow.capacity_assessments.get_by_part(project_part_id)
        return [self._to_response(a) for a in assessments]

    async def get_by_supplier(self, supplier_id: uuid.UUID) -> list[CapacityAssessmentResponse]:
        assessments = await self._uow.capacity_assessments.get_by_supplier(supplier_id)
        return [self._to_response(a) for a in assessments]

    async def get_coverage(self) -> CapacityCoverageResponse:
        stats = await self._uow.capacity_assessments.get_coverage_stats()
        total = stats.get("total", 0)
        assessed = stats.get("assessed", 0) + stats.get("confirmed", 0)
        pending = stats.get("pending", 0)
        coverage_pct = (assessed / total * 100) if total > 0 else 0.0
        return CapacityCoverageResponse(
            coverage_percentage=round(coverage_pct, 2),
            total=total,
            assessed=assessed,
            pending=pending,
        )

    async def get_monthly(self, year: int, month: int) -> list[MonthlyCapacityResponse]:
        assessments = await self._uow.capacity_assessments.get_by_month(year, month)
        if not assessments:
            return []

        total_cap = sum(float(a.maximum_capacity) for a in assessments)
        utilized = sum(float(a.current_capacity) for a in assessments)
        rate = (utilized / total_cap * 100) if total_cap > 0 else 0.0

        return [
            MonthlyCapacityResponse(
                month=month,
                year=year,
                total_capacity=round(total_cap, 2),
                utilized=round(utilized, 2),
                rate=round(rate, 2),
            )
        ]

    def _to_response(self, assessment: Any) -> CapacityAssessmentResponse:
        rate = None
        if assessment.maximum_capacity and assessment.maximum_capacity > 0:
            rate = round(float(assessment.current_capacity / assessment.maximum_capacity * 100), 2)
        return CapacityAssessmentResponse(
            id=assessment.id,
            assessment_date=assessment.assessment_date,
            month=assessment.month,
            year=assessment.year,
            current_capacity=assessment.current_capacity,
            maximum_capacity=assessment.maximum_capacity,
            utilization_rate=rate,
            lead_time_days=assessment.lead_time_days,
            bottleneck=assessment.bottleneck,
            notes=assessment.notes,
            status=assessment.status,
            project_part_id=assessment.project_part_id,
            supplier_id=assessment.supplier_id,
            assessed_by=assessment.assessed_by,
            created_at=assessment.created_at,
            updated_at=assessment.updated_at,
        )

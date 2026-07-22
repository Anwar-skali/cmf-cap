from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select

from app.application.dto.suppliers import (
    CreateSupplierRequest,
    SupplierFilter,
    SupplierListResponse,
    SupplierResponse,
    UpdateSupplierRequest,
)
from app.application.interfaces.services import IUnitOfWork
from app.core.exceptions import ConflictException, NotFoundException
from app.domain.enums import ActivityAction


class SupplierService:
    def __init__(self, uow: IUnitOfWork) -> None:
        self._uow = uow

    async def create_supplier(self, data: CreateSupplierRequest, user_id: uuid.UUID | None = None) -> SupplierResponse:
        existing = await self._uow.suppliers.get_by_code(data.code)
        if existing is not None:
            raise ConflictException(f"A supplier with code '{data.code}' already exists")

        supplier_data = data.model_dump(exclude_unset=True)
        supplier = await self._uow.suppliers.create(supplier_data)

        await self._uow.activity_logs.create({
            "user_id": user_id,
            "action": ActivityAction.CREATE.value,
            "resource_type": "supplier",
            "resource_id": str(supplier.id),
            "details": {"code": data.code, "name": data.name},
        })

        await self._uow.commit()
        return self._to_response(supplier)

    async def get_supplier(self, id: uuid.UUID) -> SupplierResponse:
        supplier = await self._uow.suppliers.get(id)
        if supplier is None:
            raise NotFoundException("Supplier not found")
        return self._to_response(supplier)

    async def update_supplier(self, id: uuid.UUID, data: UpdateSupplierRequest, user_id: uuid.UUID | None = None) -> SupplierResponse:
        supplier = await self._uow.suppliers.get(id)
        if supplier is None:
            raise NotFoundException("Supplier not found")

        update_data = data.model_dump(exclude_unset=True, exclude_none=True)
        if not update_data:
            return self._to_response(supplier)

        supplier = await self._uow.suppliers.update(id, update_data)
        if supplier is None:
            raise NotFoundException("Supplier not found")

        await self._uow.activity_logs.create({
            "user_id": user_id,
            "action": ActivityAction.UPDATE.value,
            "resource_type": "supplier",
            "resource_id": str(id),
            "details": {"updated_fields": list(update_data.keys())},
        })

        await self._uow.commit()
        return self._to_response(supplier)

    async def delete_supplier(self, id: uuid.UUID, user_id: uuid.UUID | None = None) -> bool:
        supplier = await self._uow.suppliers.get(id)
        if supplier is None:
            raise NotFoundException("Supplier not found")

        result = await self._uow.suppliers.delete(id)

        await self._uow.activity_logs.create({
            "user_id": user_id,
            "action": ActivityAction.DELETE.value,
            "resource_type": "supplier",
            "resource_id": str(id),
            "details": {"code": supplier.code, "name": supplier.name},
        })

        await self._uow.commit()
        return result

    async def get_suppliers(self, filter: SupplierFilter) -> SupplierListResponse:
        filters: dict[str, Any] = {}
        if filter.status is not None:
            filters["status"] = filter.status
        if filter.category is not None:
            filters["category"] = filter.category
        if filter.country is not None:
            filters["country"] = filter.country
        if filter.rating_min is not None:
            filters.setdefault("rating", {})["gte"] = filter.rating_min

        if filter.search:
            items, total = await self._uow.suppliers.search(filter.search, filters=filters)
            skip = filter.skip or 0
            limit = filter.limit or 20
            items = items[skip : skip + limit]
        else:
            total = await self._uow.suppliers.count(filters=filters)
            items = await self._uow.suppliers.get_multi(
                skip=filter.skip,
                limit=filter.limit,
                sort_by=filter.sort_by,
                sort_desc=filter.sort_desc,
                filters=filters,
            )

        return SupplierListResponse(
            items=[self._to_response(s) for s in items],
            total=total,
            skip=filter.skip,
            limit=filter.limit,
        )

    async def assign_to_project(self, supplier_id: uuid.UUID, project_id: uuid.UUID) -> bool:
        supplier = await self._uow.suppliers.get(supplier_id)
        if supplier is None:
            raise NotFoundException("Supplier not found")

        project = await self._uow.projects.get(project_id)
        if project is None:
            raise NotFoundException("Project not found")

        from app.infrastructure.persistence.models.supplier import ProjectSupplier

        existing = await self._uow.session.execute(
            select(ProjectSupplier).where(
                ProjectSupplier.supplier_id == supplier_id,
                ProjectSupplier.project_id == project_id,
            )
        )
        if existing.scalars().first() is not None:
            return True

        ps = ProjectSupplier(supplier_id=supplier_id, project_id=project_id)
        self._uow.session.add(ps)
        await self._uow.commit()
        return True

    async def remove_from_project(self, supplier_id: uuid.UUID, project_id: uuid.UUID) -> bool:
        from sqlalchemy import delete
        from app.infrastructure.persistence.models.supplier import ProjectSupplier

        stmt = delete(ProjectSupplier).where(
            ProjectSupplier.supplier_id == supplier_id,
            ProjectSupplier.project_id == project_id,
        )
        result = await self._uow.session.execute(stmt)
        await self._uow.commit()
        return result.rowcount > 0

    def _to_response(self, supplier: Any) -> SupplierResponse:
        return SupplierResponse(
            id=supplier.id,
            code=supplier.code,
            name=supplier.name,
            contact_person=supplier.contact_person,
            email=supplier.email,
            phone=supplier.phone,
            address=supplier.address,
            city=supplier.city,
            country=supplier.country,
            postal_code=supplier.postal_code,
            website=supplier.website,
            status=supplier.status,
            category=supplier.category,
            rating=supplier.rating,
            notes=supplier.notes,
            created_at=supplier.created_at,
            updated_at=supplier.updated_at,
        )

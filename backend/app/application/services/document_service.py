from __future__ import annotations

import uuid
from typing import Any

from app.application.dto.documents import (
    CreateDocumentRequest,
    DocumentFilter,
    DocumentListResponse,
    DocumentResponse,
)
from app.application.interfaces.services import IFileStorageService, IUnitOfWork
from app.core.exceptions import NotFoundException
from app.domain.enums import ActivityAction


class DocumentService:
    def __init__(self, uow: IUnitOfWork, file_storage: IFileStorageService) -> None:
        self._uow = uow
        self._file_storage = file_storage

    async def upload_document(
        self,
        file: Any,
        data: CreateDocumentRequest,
        user_id: uuid.UUID | None = None,
    ) -> DocumentResponse:
        from pathlib import Path

        subdir = "documents"
        if data.project_id:
            subdir = f"projects/{data.project_id}"

        file_path = await self._file_storage.save_file(file, subdirectory=subdir)

        file.file.seek(0, 2)
        file_size = file.file.tell()
        file.file.seek(0)

        doc_data = {
            "title": data.title,
            "description": data.description,
            "document_type": data.document_type,
            "project_id": data.project_id,
            "project_part_id": data.project_part_id,
            "uploaded_by": user_id,
            "file_name": file.filename or "unknown",
            "file_path": file_path,
            "file_size": file_size,
            "mime_type": file.content_type,
            "version": 1,
            "is_latest": True,
        }

        doc = await self._uow.documents.create(doc_data)

        await self._uow.activity_logs.create({
            "user_id": user_id,
            "action": ActivityAction.CREATE.value,
            "resource_type": "document",
            "resource_id": str(doc.id),
            "details": {
                "title": data.title,
                "file_name": file.filename,
                "file_size": file_size,
                "document_type": data.document_type,
            },
        })

        await self._uow.commit()
        return self._to_response(doc)

    async def get_document(self, id: uuid.UUID) -> DocumentResponse:
        doc = await self._uow.documents.get(id)
        if doc is None:
            raise NotFoundException("Document not found")
        return self._to_response(doc)

    async def delete_document(self, id: uuid.UUID, user_id: uuid.UUID | None = None) -> bool:
        doc = await self._uow.documents.get(id)
        if doc is None:
            raise NotFoundException("Document not found")

        await self._file_storage.delete_file(doc.file_path)
        result = await self._uow.documents.delete(id)

        await self._uow.activity_logs.create({
            "user_id": user_id,
            "action": ActivityAction.DELETE.value,
            "resource_type": "document",
            "resource_id": str(id),
            "details": {"title": doc.title, "file_name": doc.file_name},
        })

        await self._uow.commit()
        return result

    async def get_by_project(self, project_id: uuid.UUID) -> list[DocumentResponse]:
        docs = await self._uow.documents.get_by_project(project_id)
        return [self._to_response(d) for d in docs]

    async def get_by_part(self, project_part_id: uuid.UUID) -> list[DocumentResponse]:
        docs = await self._uow.documents.get_by_part(project_part_id)
        return [self._to_response(d) for d in docs]

    async def download_document(self, id: uuid.UUID) -> Any:
        doc = await self._uow.documents.get(id)
        if doc is None:
            raise NotFoundException("Document not found")

        file_path = await self._file_storage.get_file_path(doc.file_path)
        from fastapi.responses import FileResponse
        return FileResponse(
            path=file_path,
            filename=doc.file_name,
            media_type=doc.mime_type or "application/octet-stream",
        )

    def _to_response(self, doc: Any) -> DocumentResponse:
        return DocumentResponse(
            id=doc.id,
            title=doc.title,
            description=doc.description,
            file_name=doc.file_name,
            file_path=doc.file_path,
            file_size=doc.file_size,
            mime_type=doc.mime_type,
            document_type=doc.document_type,
            version=doc.version,
            is_latest=doc.is_latest,
            project_id=doc.project_id,
            project_part_id=doc.project_part_id,
            uploaded_by=doc.uploaded_by,
            created_at=doc.created_at,
            updated_at=doc.updated_at,
        )

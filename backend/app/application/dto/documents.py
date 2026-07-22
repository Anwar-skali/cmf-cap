from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class CreateDocumentRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    document_type: str = "other"
    project_id: Any | None = None
    project_part_id: Any | None = None


class DocumentResponse(BaseModel):
    id: Any
    title: str
    description: str | None = None
    file_name: str
    file_path: str
    file_size: int = 0
    mime_type: str | None = None
    document_type: str = "other"
    version: int = 1
    is_latest: bool = True
    project_id: Any | None = None
    project_part_id: Any | None = None
    uploaded_by: Any | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class DocumentListResponse(BaseModel):
    items: list[DocumentResponse]
    total: int
    skip: int = 0
    limit: int = 20


class DocumentFilter(BaseModel):
    document_type: str | None = None
    project_id: Any | None = None
    project_part_id: Any | None = None
    uploaded_by: Any | None = None
    search: str | None = None
    skip: int = Field(default=0, ge=0)
    limit: int = Field(default=20, ge=1, le=100)
    sort_by: str | None = "created_at"
    sort_desc: bool = True

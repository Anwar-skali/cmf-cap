from __future__ import annotations

import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from app.domain.enums import DocumentType
from app.infrastructure.persistence.models.base import (
    Base,
    SoftDeleteMixin,
    TimestampMixin,
)


class Document(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_name: Mapped[str] = mapped_column(String(500), nullable=False)
    file_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    mime_type: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    document_type: Mapped[DocumentType] = mapped_column(
        String(50), default=DocumentType.OTHER, nullable=False
    )
    version: Mapped[int] = mapped_column(
        Integer, default=1, nullable=False
    )
    is_latest: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )

    project_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True
    )
    project_part_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("project_parts.id", ondelete="SET NULL"),
        nullable=True,
    )
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    project = relationship(
        "Project", back_populates="documents", lazy="selectin"
    )
    project_part = relationship(
        "ProjectPart", back_populates="documents", lazy="selectin"
    )
    uploader = relationship(
        "User", back_populates="documents", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<Document {self.title} (v{self.version})>"

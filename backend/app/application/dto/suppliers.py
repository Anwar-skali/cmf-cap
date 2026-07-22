from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator


class CreateSupplierRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=255)
    contact_person: str | None = Field(None, max_length=255)
    email: str | None = Field(None, max_length=255)
    phone: str | None = Field(None, max_length=50)
    address: str | None = None
    city: str | None = Field(None, max_length=100)
    country: str | None = Field(None, max_length=100)
    postal_code: str | None = Field(None, max_length=20)
    website: str | None = Field(None, max_length=500)
    status: str | None = "active"
    category: str | None = Field(None, max_length=100)
    rating: int | None = Field(None, ge=1, le=5)
    notes: str | None = None

    @field_validator("code")
    @classmethod
    def validate_code(cls, v: str) -> str:
        return v.strip().upper()


class UpdateSupplierRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    contact_person: str | None = Field(None, max_length=255)
    email: str | None = Field(None, max_length=255)
    phone: str | None = Field(None, max_length=50)
    address: str | None = None
    city: str | None = Field(None, max_length=100)
    country: str | None = Field(None, max_length=100)
    postal_code: str | None = Field(None, max_length=20)
    website: str | None = Field(None, max_length=500)
    status: str | None = None
    category: str | None = Field(None, max_length=100)
    rating: int | None = Field(None, ge=1, le=5)
    notes: str | None = None


class SupplierResponse(BaseModel):
    id: Any
    code: str
    name: str
    contact_person: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    city: str | None = None
    country: str | None = None
    postal_code: str | None = None
    website: str | None = None
    status: str | None = "active"
    category: str | None = None
    rating: int | None = None
    notes: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class SupplierListResponse(BaseModel):
    items: list[SupplierResponse]
    total: int
    skip: int = 0
    limit: int = 20


class SupplierFilter(BaseModel):
    search: str | None = None
    status: str | None = None
    category: str | None = None
    country: str | None = None
    rating_min: int | None = Field(None, ge=1, le=5)
    skip: int = Field(default=0, ge=0)
    limit: int = Field(default=20, ge=1, le=100)
    sort_by: str | None = "created_at"
    sort_desc: bool = True

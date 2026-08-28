from __future__ import annotations

import uuid
import warnings
from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field

# Filter Pydantic v2 warning for schema_json shadowing deprecated BaseModel.schema_json
warnings.filterwarnings(
    "ignore",
    message=r'.*shadows an attribute in parent "BaseModel".*',
    category=UserWarning,
)


FieldTypeEnum = Literal[
    "text",
    "textarea",
    "integer",
    "decimal",
    "currency",
    "date",
    "week",
    "boolean",
    "email",
    "phone",
    "dropdown",
    "multiselect",
    "checkbox",
    "radio",
    "user",
    "supplier",
    "project",
    "status",
    "file_upload",
    "percentage",
    "calculated",
    "readonly",
]


class DropdownOption(BaseModel):
    value: str
    label: str
    order: int = 0


class ValidationRule(BaseModel):
    type: str  # required, minLength, maxLength, regex, unique, enum, numberRange, dateRange, custom, conditional, crossField
    value: Any = None
    message: str | None = None


class ConditionalRule(BaseModel):
    type: str = "show"  # show, hide, require
    field: str  # internalName of dependent field
    operator: str = "equals"  # equals, not_equals, in, not_in, greater_than, less_than
    value: Any = None


class CalculationRule(BaseModel):
    expression: str  # e.g., "actual_cost - target_cost"


class ExcelMapping(BaseModel):
    columnName: str | None = None
    position: int | None = None
    importAlias: str | None = None
    exportAlias: str | None = None


class SearchConfig(BaseModel):
    searchable: bool = False
    filterable: bool = False
    sortable: bool = False
    visibleInTable: bool = True
    visibleInExport: bool = True


class PermissionRule(BaseModel):
    rolesAllowedToEdit: list[str] = Field(default_factory=list)
    rolesAllowedToView: list[str] = Field(default_factory=list)


class TemplateFieldSchema(BaseModel):
    id: str
    internalName: str
    label: str
    type: FieldTypeEnum
    required: bool = False
    placeholder: str | None = None
    helpText: str | None = None
    defaultValue: Any = None
    order: int = 0
    visible: bool = True
    editable: bool = True
    options: list[DropdownOption] = Field(default_factory=list)
    validation: ValidationRule | None = None
    conditions: list[ConditionalRule] = Field(default_factory=list)
    calculation: CalculationRule | None = None
    excel: ExcelMapping | None = None
    search: SearchConfig | None = None
    permissions: PermissionRule | None = None


class FieldGroupSchema(BaseModel):
    id: str
    name: str
    order: int = 0
    description: str | None = None
    fields: list[TemplateFieldSchema] = Field(default_factory=list)


class SectionSchema(BaseModel):
    id: str
    name: str
    order: int = 0
    icon: str | None = "Folder"
    description: str | None = None
    groups: list[FieldGroupSchema] = Field(default_factory=list)


class DashboardKpiSchema(BaseModel):
    id: str
    title: str
    field: str
    aggregation: str = "avg"  # avg, sum, count, min, max
    format: str = "number"  # currency, percentage, number
    icon: str | None = None


class DashboardChartMetric(BaseModel):
    field: str
    aggregation: str = "avg"
    label: str
    color: str = "#3b82f6"


class DashboardChartSchema(BaseModel):
    id: str
    title: str
    type: str = "bar"  # bar, line, pie
    groupBy: str
    metrics: list[DashboardChartMetric] = Field(default_factory=list)


class DashboardConfigSchema(BaseModel):
    kpis: list[DashboardKpiSchema] = Field(default_factory=list)
    charts: list[DashboardChartSchema] = Field(default_factory=list)


class TemplateSearchConfigSchema(BaseModel):
    defaultSortBy: str = "created_at"
    defaultSortDesc: bool = True
    defaultPageSize: int = 20
    quickFilterFields: list[str] = Field(default_factory=list)


class TemplateSchemaContent(BaseModel):
    code: str
    name: str
    version: str = "1.0"
    status: str = "DRAFT"  # DRAFT, PUBLISHED, ARCHIVED
    description: str | None = None
    sections: list[SectionSchema] = Field(default_factory=list)
    dashboardConfig: DashboardConfigSchema | None = None
    searchConfig: TemplateSearchConfigSchema | None = None


class CreateTemplateRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    code: str
    name: str
    description: str | None = None
    version: str = "1.0"
    status: str = "DRAFT"
    schema_json: dict[str, Any]


class UpdateTemplateRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    name: str | None = None
    description: str | None = None
    status: str | None = None
    schema_json: dict[str, Any] | None = None
    change_log: str | None = None


class TemplateResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    id: uuid.UUID
    code: str
    name: str
    description: str | None = None
    version: str
    status: str
    schema_json: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class TemplateListResponse(BaseModel):
    items: list[TemplateResponse]
    total: int

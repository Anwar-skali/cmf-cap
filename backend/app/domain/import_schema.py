from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field


class ImportColumnSpec(BaseModel):
    key: str
    label: str
    required: bool = False
    type: str = "string"  # string, integer, number, date, enum
    enum_values: list[str] | None = None
    aliases: list[str] = Field(default_factory=list)
    description: str | None = None
    unique_key: bool = False


class EntityImportSchema(BaseModel):
    entity_type: str
    display_name: str
    columns: list[ImportColumnSpec]
    sample_rows: list[dict[str, Any]]


ENTITY_IMPORT_SCHEMAS: dict[str, EntityImportSchema] = {
    "projects": EntityImportSchema(
        entity_type="projects",
        display_name="Projects",
        columns=[
            ImportColumnSpec(
                key="code",
                label="Project Code",
                required=True,
                type="string",
                aliases=["code", "project code", "project_code", "ref", "project ref"],
                unique_key=True,
                description="Unique identifier for the project",
            ),
            ImportColumnSpec(
                key="name",
                label="Project Name",
                required=True,
                type="string",
                aliases=["name", "project name", "title", "project title"],
                description="Name of the project",
            ),
            ImportColumnSpec(
                key="description",
                label="Description",
                required=False,
                type="string",
                aliases=["desc", "description", "details"],
            ),
            ImportColumnSpec(
                key="status",
                label="Status",
                required=False,
                type="enum",
                enum_values=["draft", "active", "on_hold", "completed", "cancelled"],
                aliases=["status", "project status", "state"],
            ),
            ImportColumnSpec(
                key="budget",
                label="Budget",
                required=False,
                type="number",
                aliases=["budget", "total budget", "cost"],
            ),
            ImportColumnSpec(
                key="start_date",
                label="Start Date",
                required=False,
                type="date",
                aliases=["start date", "start_date", "launch date"],
            ),
            ImportColumnSpec(
                key="end_date",
                label="End Date",
                required=False,
                type="date",
                aliases=["end date", "end_date", "target date"],
            ),
        ],
        sample_rows=[
            {
                "Project Code": "PRJ-2026-001",
                "Project Name": "NextGen EV Platform",
                "Description": "Electric Vehicle chassis and powertrain project",
                "Status": "active",
                "Budget": 500000.0,
                "Start Date": "2026-01-15",
                "End Date": "2026-12-31",
            },
            {
                "Project Code": "PRJ-2026-002",
                "Project Name": "Battery Pack Line",
                "Description": "High voltage battery pack assembly module",
                "Status": "draft",
                "Budget": 250000.0,
                "Start Date": "2026-03-01",
                "End Date": "2026-11-15",
            },
        ],
    ),
    "suppliers": EntityImportSchema(
        entity_type="suppliers",
        display_name="Suppliers",
        columns=[
            ImportColumnSpec(
                key="name",
                label="Supplier Name",
                required=True,
                type="string",
                aliases=["name", "supplier name", "company", "vendor"],
                unique_key=True,
            ),
            ImportColumnSpec(
                key="contact_person",
                label="Contact Person",
                required=False,
                type="string",
                aliases=["contact", "contact person", "contact_person"],
            ),
            ImportColumnSpec(
                key="email",
                label="Email",
                required=False,
                type="string",
                aliases=["email", "contact email", "e-mail"],
            ),
            ImportColumnSpec(
                key="phone",
                label="Phone",
                required=False,
                type="string",
                aliases=["phone", "telephone", "mobile"],
            ),
            ImportColumnSpec(
                key="country",
                label="Country",
                required=False,
                type="string",
                aliases=["country", "location", "nation"],
            ),
            ImportColumnSpec(
                key="status",
                label="Status",
                required=False,
                type="enum",
                enum_values=["active", "inactive", "blacklisted"],
                aliases=["status", "supplier status"],
            ),
        ],
        sample_rows=[
            {
                "Supplier Name": "Apex Auto Components",
                "Contact Person": "Sarah Jenkins",
                "Email": "s.jenkins@apexauto.com",
                "Phone": "+1-555-0192",
                "Country": "United States",
                "Status": "active",
            }
        ],
    ),
    "parts": EntityImportSchema(
        entity_type="parts",
        display_name="Parts",
        columns=[
            ImportColumnSpec(
                key="project_code",
                label="Project Code",
                required=True,
                type="string",
                aliases=["project", "project code", "project_code"],
            ),
            ImportColumnSpec(
                key="part_number",
                label="Part Number",
                required=True,
                type="string",
                aliases=["part_number", "part number", "pn", "part no"],
                unique_key=True,
            ),
            ImportColumnSpec(
                key="name",
                label="Part Name",
                required=True,
                type="string",
                aliases=["name", "part name", "title"],
            ),
            ImportColumnSpec(
                key="quantity",
                label="Quantity",
                required=False,
                type="integer",
                aliases=["quantity", "qty", "count"],
            ),
            ImportColumnSpec(
                key="unit",
                label="Unit",
                required=False,
                type="string",
                aliases=["unit", "uom"],
            ),
            ImportColumnSpec(
                key="material",
                label="Material",
                required=False,
                type="string",
                aliases=["material", "type"],
            ),
            ImportColumnSpec(
                key="status",
                label="Status",
                required=False,
                type="enum",
                enum_values=["active", "inactive", "obsolete"],
                aliases=["status"],
            ),
        ],
        sample_rows=[
            {
                "Project Code": "CMF-1001",
                "Part Number": "PN-88210",
                "Part Name": "Front Subframe Bracket",
                "Quantity": 150,
                "Unit": "pcs",
                "Material": "Aluminum 6061",
                "Status": "active",
            },
            {
                "Project Code": "CMF-1001",
                "Part Number": "PN-88211",
                "Part Name": "Rear Subframe Bracket",
                "Quantity": 150,
                "Unit": "pcs",
                "Material": "Aluminum 6061",
                "Status": "active",
            }
        ],
    ),
    "capacity": EntityImportSchema(
        entity_type="capacity",
        display_name="Capacity Assessments",
        columns=[
            ImportColumnSpec(
                key="month",
                label="Month",
                required=True,
                type="integer",
                aliases=["month", "m"],
            ),
            ImportColumnSpec(
                key="year",
                label="Year",
                required=True,
                type="integer",
                aliases=["year", "y"],
            ),
            ImportColumnSpec(
                key="current_capacity",
                label="Current Capacity",
                required=True,
                type="number",
                aliases=["current_capacity", "current capacity", "actual"],
            ),
            ImportColumnSpec(
                key="maximum_capacity",
                label="Maximum Capacity",
                required=True,
                type="number",
                aliases=["maximum_capacity", "maximum capacity", "max"],
            ),
            ImportColumnSpec(
                key="status",
                label="Status",
                required=False,
                type="enum",
                enum_values=["pending", "assessed", "confirmed", "rejected"],
                aliases=["status"],
            ),
        ],
        sample_rows=[
            {
                "Month": 6,
                "Year": 2026,
                "Current Capacity": 1200.0,
                "Maximum Capacity": 1500.0,
                "Status": "confirmed",
            }
        ],
    ),
    "risks": EntityImportSchema(
        entity_type="risks",
        display_name="Risks",
        columns=[
            ImportColumnSpec(
                key="title",
                label="Risk Title",
                required=True,
                type="string",
                aliases=["title", "risk title", "name"],
                unique_key=True,
            ),
            ImportColumnSpec(
                key="severity",
                label="Severity",
                required=False,
                type="enum",
                enum_values=["low", "medium", "high", "critical"],
                aliases=["severity", "level"],
            ),
            ImportColumnSpec(
                key="probability",
                label="Probability",
                required=False,
                type="enum",
                enum_values=["rare", "unlikely", "possible", "likely", "almost_certain"],
                aliases=["probability", "likelihood"],
            ),
            ImportColumnSpec(
                key="description",
                label="Description",
                required=False,
                type="string",
                aliases=["description", "details"],
            ),
        ],
        sample_rows=[
            {
                "Risk Title": "Supplier Raw Material Delay",
                "Severity": "high",
                "Probability": "possible",
                "Description": "Delay in lithium delivery affecting battery assembly schedule",
            }
        ],
    ),
}

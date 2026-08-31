from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.infrastructure.persistence.models.template import Template
from app.infrastructure.persistence.models.supplier import Supplier
from app.infrastructure.persistence.models.project import Project
from app.infrastructure.persistence.models.project_part import ProjectPart
from app.infrastructure.persistence.models.risk import Risk
from app.infrastructure.persistence.models.capacity_assessment import CapacityAssessment

logger = get_logger(__name__)


def parse_uuid(val: Any) -> uuid.UUID | None:
    if not val:
        return None
    if isinstance(val, uuid.UUID):
        return val
    try:
        return uuid.UUID(str(val))
    except Exception:
        return uuid.uuid4()


def parse_dt(val: Any) -> datetime | None:
    if not val:
        return None
    try:
        s = str(val).replace('Z', '+00:00')
        return datetime.fromisoformat(s)
    except Exception:
        return None


def run_auto_seed(engine: Any) -> None:
    """Auto-seed initial database if tables are empty."""
    try:
        seed_path = os.path.join(os.path.dirname(__file__), "seed_data.json")
        if not os.path.exists(seed_path):
            logger.info("No seed_data.json found at %s", seed_path)
            return

        with open(seed_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        with Session(engine) as session:
            existing_projects = session.query(Project).count()
            if existing_projects > 0:
                logger.info("Database already contains %d projects — skipping auto-seed", existing_projects)
                return

            logger.info("Seeding initial database with CMF templates, projects, suppliers, and risks...")

            # 1. Templates
            template_id_map: dict[str, uuid.UUID] = {}
            for r in data.get("templates", []):
                t_id = parse_uuid(r.get("id"))
                if not t_id:
                    continue
                schema = r.get("schema_json")
                if isinstance(schema, str):
                    try:
                        schema = json.loads(schema)
                    except Exception:
                        schema = {}

                existing_t = session.query(Template).filter(Template.id == t_id).first()
                if not existing_t:
                    t = Template(
                        id=t_id,
                        code=r.get("code"),
                        name=r.get("name"),
                        description=r.get("description"),
                        version=r.get("version", "1.0"),
                        status=r.get("status", "PUBLISHED"),
                        schema_json=schema or {},
                    )
                    session.add(t)
                    template_id_map[str(t_id)] = t_id
            session.commit()

            # 2. Suppliers
            for r in data.get("suppliers", []):
                s_id = parse_uuid(r.get("id"))
                if not s_id:
                    continue
                existing_s = session.query(Supplier).filter(Supplier.id == s_id).first()
                if not existing_s:
                    s = Supplier(
                        id=s_id,
                        code=r.get("code"),
                        name=r.get("name"),
                        contact_person=r.get("contact_person"),
                        email=r.get("email"),
                        phone=r.get("phone"),
                        address=r.get("address"),
                        status=r.get("status", "active"),
                    )
                    session.add(s)
            session.commit()

            # 3. Projects
            for r in data.get("projects", []):
                p_id = parse_uuid(r.get("id"))
                if not p_id:
                    continue
                pdata = r.get("data")
                if isinstance(pdata, str):
                    try:
                        pdata = json.loads(pdata)
                    except Exception:
                        pdata = {}

                existing_p = session.query(Project).filter(Project.id == p_id).first()
                if not existing_p:
                    p = Project(
                        id=p_id,
                        code=r.get("code"),
                        name=r.get("name"),
                        description=r.get("description"),
                        status=r.get("status", "draft"),
                        priority=r.get("priority", 0),
                        start_date=parse_dt(r.get("start_date")),
                        end_date=parse_dt(r.get("end_date")),
                        client_name=r.get("client_name"),
                        template_id=parse_uuid(r.get("template_id")),
                        data=pdata or {},
                    )
                    session.add(p)
            session.commit()

            # 4. Project Parts
            for r in data.get("project_parts", []):
                part_id = parse_uuid(r.get("id"))
                if not part_id:
                    continue
                part_data = r.get("data")
                if isinstance(part_data, str):
                    try:
                        part_data = json.loads(part_data)
                    except Exception:
                        part_data = {}

                existing_part = session.query(ProjectPart).filter(ProjectPart.id == part_id).first()
                if not existing_part:
                    part = ProjectPart(
                        id=part_id,
                        project_id=parse_uuid(r.get("project_id")),
                        part_number=r.get("part_number") or f"PART-{str(part_id)[:8]}",
                        name=r.get("name") or "Part Component",
                        description=r.get("description"),
                        data=part_data or {},
                    )
                    session.add(part)
            session.commit()

            # 5. Risks
            for r in data.get("risks", []):
                risk_id = parse_uuid(r.get("id"))
                if not risk_id:
                    continue
                existing_risk = session.query(Risk).filter(Risk.id == risk_id).first()
                if not existing_risk:
                    risk = Risk(
                        id=risk_id,
                        project_part_id=parse_uuid(r.get("project_part_id")),
                        title=r.get("title") or "Technical Quality Risk",
                        description=r.get("description"),
                        risk_type=r.get("risk_type") or "Technical",
                        severity=r.get("severity") or "medium",
                        probability=r.get("probability") or "possible",
                        status=r.get("status") or "open",
                        mitigation_plan=r.get("mitigation_plan"),
                    )
                    session.add(risk)
            session.commit()

            # 6. Capacity Assessments
            for r in data.get("capacity_assessments", []):
                ca_id = parse_uuid(r.get("id"))
                if not ca_id:
                    continue
                existing_ca = session.query(CapacityAssessment).filter(CapacityAssessment.id == ca_id).first()
                if not existing_ca:
                    ca = CapacityAssessment(
                        id=ca_id,
                        project_part_id=parse_uuid(r.get("project_part_id")),
                        supplier_id=parse_uuid(r.get("supplier_id")),
                        month=r.get("month", 1),
                        year=r.get("year", 2026),
                        maximum_capacity=float(r.get("maximum_capacity") or 0.0),
                        current_capacity=float(r.get("current_capacity") or 0.0),
                        status=r.get("status") or "assessed",
                        comments=r.get("comments"),
                    )
                    session.add(ca)
            session.commit()

            logger.info("Auto-seed completed: %d projects, %d templates, %d suppliers loaded.",
                        session.query(Project).count(),
                        session.query(Template).count(),
                        session.query(Supplier).count())

    except Exception as exc:
        logger.warning("Auto-seed encountered an issue: %s", exc)

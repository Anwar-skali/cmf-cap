import pytest
from datetime import datetime, timezone, timedelta
from app.application.services.dashboard_service import DashboardService
from app.domain.enums import ProjectStatus, RiskSeverity, RiskProbability
from app.infrastructure.persistence.models.project import Project
from app.infrastructure.persistence.models.supplier import Supplier
from app.infrastructure.persistence.models.risk import Risk
from app.infrastructure.persistence.models.project_part import ProjectPart
from app.infrastructure.persistence.models.capacity_assessment import CapacityAssessment
from app.infrastructure.persistence.models.template import Template


@pytest.mark.asyncio
async def test_dashboard_service_computes_live_stats(unit_of_work):
    # 0. Seed CMF Structure Templates (e.g. K9, K0)
    t1 = Template(
        code="K9",
        name="CMF K9 Project Template",
        version="2.0",
        status="PUBLISHED",
    )
    t2 = Template(
        code="K0",
        name="CMF K0 Project Template",
        version="1.0",
        status="PUBLISHED",
    )
    unit_of_work._session.add_all([t1, t2])
    await unit_of_work.commit()

    # 1. Seed Projects
    p1 = Project(
        code="PRJ-001",
        name="Battery Line Alpha",
        status=ProjectStatus.ACTIVE,
        client_name="Stellantis",
        end_date=datetime.now(timezone.utc) + timedelta(days=30),
        data={"use_case": "Standard Pack"},
        template_id=t1.id,
    )
    p2 = Project(
        code="PRJ-002",
        name="Inverter Case Beta",
        status=ProjectStatus.ACTIVE,
        client_name="Renault Group",
        end_date=datetime.now(timezone.utc) - timedelta(days=5),
        data={"use_case": "HV Box", "status": "delayed"},
        template_id=t2.id,
    )
    p3 = Project(
        code="PRJ-003",
        name="Motor Core Gamma",
        status=ProjectStatus.COMPLETED,
        client_name="Stellantis",
        template_id=t1.id,
    )
    unit_of_work._session.add_all([p1, p2, p3])
    await unit_of_work.commit()

    # 2. Seed Supplier
    s1 = Supplier(
        code="SUP-001",
        name="Top Tier Auto Parts",
        contact_person="John Doe",
        email="contact@toptier.com",
    )
    unit_of_work._session.add(s1)
    await unit_of_work.commit()

    # 3. Seed Part
    part1 = ProjectPart(
        project_id=p1.id,
        part_number="PART-001",
        name="Battery Module",
    )
    unit_of_work._session.add(part1)
    await unit_of_work.commit()

    # 4. Seed Risks
    r1 = Risk(
        project_part_id=part1.id,
        title="Quality Dimension Tolerance",
        risk_type="quality",
        severity=RiskSeverity.HIGH,
        probability=RiskProbability.LIKELY,
        status="open",
    )
    r2 = Risk(
        project_part_id=part1.id,
        title="Supplier Tooling Wear",
        risk_type="quality",
        severity=RiskSeverity.CRITICAL,
        probability=RiskProbability.LIKELY,
        status="open",
    )
    unit_of_work._session.add_all([r1, r2])
    await unit_of_work.commit()

    # 5. Seed Capacity Assessments
    now = datetime.now(timezone.utc)
    ca1 = CapacityAssessment(
        project_part_id=part1.id,
        supplier_id=s1.id,
        month=now.month,
        year=now.year,
        maximum_capacity=50000.0,
        current_capacity=40000.0,
        status="assessed",
    )
    unit_of_work._session.add(ca1)
    await unit_of_work.commit()

    service = DashboardService(unit_of_work)
    stats = await service.get_dashboard_stats()

    # Verify Total CMF structures (K9, K0 = 2)
    assert stats.total_cmf == 2

    # Verify Projects & Use Cases
    assert stats.total_projects == 3
    assert stats.active_projects == 2
    assert stats.completed_projects == 1
    assert stats.delayed_projects == 1
    assert stats.projects_on_track == 1
    assert stats.project_use_cases == 2
    assert stats.delayed_project_use_cases == 1

    # Verify Suppliers & Risks
    assert stats.total_suppliers == 1
    assert stats.total_risks == 2
    assert stats.open_risks == 2
    assert stats.open_quality_issues == 2
    assert stats.critical_quality_issues == 1
    assert stats.supplier_quality_status in ("YELLOW", "RED")

    # Verify Capacity
    assert stats.total_capacity == 50000.0
    assert stats.allocated_capacity == 40000.0
    assert stats.average_utilization_pct == 80.0

    # Verify Customer Breakdown
    assert len(stats.projects_by_customer) >= 2
    assert stats.projects_by_customer[0]["customer"] == "Stellantis"
    assert stats.projects_by_customer[0]["count"] == 2

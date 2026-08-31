# Dashboard Live Data Implementation Plan

## What We're Doing
Replacing all hardcoded/mock values in the CMF Dashboard with real data from the backend. 
The backend already has a `GET /api/v1/dashboard/stats` endpoint — we'll extend it to return everything the dashboard needs, and update the frontend hook to consume it all.

---

## Current State (Live vs. Static)

| KPI / Widget | Current | After Fix |
|---|---|---|
| Total Projects | ✅ Live | ✅ Live |
| Active Projects | ✅ Live | ✅ Live |
| Projects at Risk (open risks) | ✅ Live | ✅ Live |
| Active Suppliers | ✅ Live | ✅ Live |
| **Total Capacity** | ❌ Hardcoded 48,500 | ✅ From DB |
| **Utilization %** | ❌ Hardcoded 80% | ✅ From DB |
| **Allocated / Used / Remaining Capacity** | ❌ Hardcoded | ✅ From DB |
| **On Track / Delayed / Completed projects** | ❌ Hardcoded | ✅ From DB |
| **Open Quality Issues** | ❌ Hardcoded 14 | ✅ From DB |
| **Open Actions** | ❌ Hardcoded 27 | ✅ From DB |
| **Projects by Customer chart** | ❌ Hardcoded list | ✅ From DB |
| **Capacity Trend chart** | ❌ Hardcoded monthly | ✅ From DB (monthly_capacity) |
| **Project Status bar chart** | ❌ Hardcoded | ✅ From DB |
| **SQD Pie chart** | ❌ Hardcoded | ✅ From DB (risk_distribution) |

---

## Proposed Changes

### Backend

#### [MODIFY] [`dashboard.py` (DTO)](file:///C:/projects/pfa-anwar/cmf-platform/backend/app/application/dto/dashboard.py)
Add new fields to `DashboardStatsResponse`:
- `total_capacity: float` — sum of `maximum_capacity` across all assessments
- `allocated_capacity: float` — sum of `current_capacity` across all assessments
- `average_utilization_pct: float` — computed average (current / maximum * 100)
- `projects_on_track: int` — projects with status `active` and `end_date` in future
- `open_quality_issues: int` — risks with `risk_type = 'quality'` and `status = 'open'`
- `open_actions: int` — same as `open_risks` (all open risks)
- `projects_by_customer: list[dict]` — group projects by `client_name`
- `supplier_quality_status: str` — `GREEN` / `YELLOW` / `RED` based on critical risk count

#### [MODIFY] [`dashboard_service.py`](file:///C:/projects/pfa-anwar/cmf-platform/backend/app/application/services/dashboard_service.py)
Compute the new fields in `_compute_stats()`:
- Sum `maximum_capacity` and `current_capacity` from all capacity assessments
- Compute `average_utilization_pct` from DB values
- Count `projects_on_track` (active + end_date in future)
- Count `open_quality_issues` (risk_type = 'quality', status = 'open')
- Group projects by `client_name` for the chart
- Derive `supplier_quality_status` from critical risk count thresholds

---

### Frontend

#### [MODIFY] [`types/index.ts`](file:///C:/projects/pfa-anwar/cmf-platform/frontend/src/types/index.ts)
Extend `DashboardStats` interface to include all new fields returned by the backend:
- `completedProjects`, `delayedProjects`, `projectsOnTrack`
- `totalCapacity`, `allocatedCapacity`, `averageUtilizationPct`
- `openQualityIssues`, `openActions`, `supplierQualityStatus`
- `projectsByCustomer`, `monthlyCapacity`, `projectStatusDistribution`, `riskDistribution`

#### [MODIFY] [`useCmfDashboardData.ts`](file:///C:/projects/pfa-anwar\cmf-platform/frontend/src/hooks/useCmfDashboardData.ts)
- Remove ALL `/** MOCK */` constants
- Map every field directly from `stats` returned by `useDashboardStatsQuery()`
- Keep `MOCK_*` chart constants only as fallback/zero-state for empty DB (new deployments)
- Map `monthlyCapacity` → capacity trend chart data
- Map `projectStatusDistribution` → project status bar chart data
- Map `riskDistribution.bySeverity` → SQD pie chart data
- Map `projectsByCustomer` → customer bar chart data

---

## Verification Plan
- Deploy backend changes and confirm `GET /api/v1/dashboard/stats` returns the new fields
- Confirm the dashboard UI shows numbers that match the real DB state
- Confirm the charts render real data
- Run `pytest tests/` to make sure all 117 tests still pass

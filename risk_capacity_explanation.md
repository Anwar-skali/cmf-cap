# CMF Platform — Risk & Capacity System Explained

> A manager-ready explanation of how everything works, why it matters, and how to present it confidently.

---

## 1. What Is the Capacity Assessment System?

The **Capacity page** (`/capacity`) is where the SQD team evaluates whether each supplier can physically produce enough parts per month to meet the vehicle ramp-up demand.

For every supplier-part combination, the SQD engineer enters:

| Field | What It Means |
|---|---|
| **Required Capacity (pcs/mo)** | The monthly production volume demand from the customer/OEM. This is *how many parts we need*. |
| **Installed Max (Supplier Max Throughput)** | The maximum number of parts the supplier's current production line can make per month — with all their machines and shifts at full utilization. This is *how many parts they can make*. |
| **Status** | `Pending` → `Assessed` → `Confirmed` (validated by SQD audit) or `Rejected` |
| **CAT Gate (CATE 1-3, Gate 1-3)** | The automotive milestone checkpoint this assessment is for (similar to a PPAP stage: prototype, pre-series, series launch). |
| **Target Week / Forecast Week** | When the supplier should be ready vs. when they actually will be ready. |
| **Bottleneck** | The specific machine, mold, or tooling causing the production limit. |

---

## 2. How the Platform Calculates Risk from Capacity

The system **automatically** turns every capacity assessment into a risk entry using this logic:

### Step 1 — Calculate Utilization Rate
```
Utilization Rate = (Required Capacity ÷ Installed Max) × 100
```

**Example**: Required = 12,000 pcs/mo, Max = 10,000 pcs/mo → **Utilization = 120%** (overloaded!)

---

### Step 2 — Classify the Risk (3 Tiers)

| Condition | Risk Type | Severity | Probability |
|---|---|---|---|
| **Utilization ≥ 100%** (or rejected audit) | 🔴 **Capacity Overload** / Quality Non-Conformity | **CRITICAL** | Almost Certain |
| **Utilization 85–99%** or forecast delay | 🟡 **Capacity Constraint** / Milestone Delay | **HIGH** | Likely |
| **Utilization < 85%** and no delay | 🟢 **Capacity Compliant** | **LOW** | Rare |

**What makes it CRITICAL?**
The supplier's line **cannot physically produce enough parts** for the vehicle program. If nothing changes, the OEM assembly line will stop. This is a supply chain emergency.

---

### Step 3 — Calculate the Risk Score

```
Risk Score = Severity × Probability
```

| Severity | Value | Probability | Value |
|---|---|---|---|
| Low | 1 | Rare | 1 |
| Medium | 2 | Unlikely | 2 |
| High | 3 | Possible | 3 |
| Critical | 4 | Likely | 4 |
| | | Almost Certain | 5 |

**Example**: Critical (4) × Almost Certain (5) = **Score 20** (maximum danger)

---

## 3. What the Risk Register (`/risks`) Actually Does

The **Risks page** is the central command center for all supply chain risks. It serves three roles:

### 📋 For the SQD Engineer
- See every risk automatically generated from capacity audits
- Track which supplier is causing the problem and why
- Move risks through the lifecycle: `Open → In Mitigation → Mitigated → Closed`
- Switch the **CAT Gate milestone** directly from the table (no need to go to each record)

### 📊 For the Manager
- At a glance: how many critical risks are open today
- Which suppliers are most at risk (sorted by score)
- Kanban board showing the status flow of all risks
- Historical audit trail of who changed what and when

### 🔄 Automated Intelligence
- **Creating** a new capacity assessment → **instantly creates** a risk entry
- **Updating** a capacity audit → **updates** the risk automatically
- **Deleting** one → **deletes the other** (no orphan data)
- **Marking a risk as Mitigated/Closed** → **marks the capacity assessment as Confirmed** (and vice versa)

---

## 4. What Do the Dashboard Numbers Mean?

| Dashboard Metric | What It Actually Measures |
|---|---|
| **Critical Risks** | Risks that are currently `Open` or `In Mitigation` AND have `Critical` severity (overloaded suppliers) |
| **Open Quality Issues** | Risks that are `Open`/`Mitigating` AND belong to a quality/non-conformity risk type specifically |
| **Capacity Secured (%)** | The percentage of all capacity assessments that have been validated (`Assessed` + `Confirmed`) out of the total |
| **Installed Capacity** | Total `maximum_capacity` across all suppliers (total line throughput available) |
| **Allocated Capacity** | Total `current_capacity` / required demand placed on all suppliers combined |
| **Average Utilization** | `Allocated ÷ Installed × 100%` — how loaded the supplier network is overall |
| **Supplier Quality Status** | 🔴 RED if >2 critical risks or >1 critical quality issue; 🟡 YELLOW if any critical risk or >3 open quality issues; 🟢 GREEN otherwise |

---

## 5. The Business Benefit — What This Replaces

Before this platform, the SQD team would use:
- Excel spreadsheets per supplier
- Manual risk registers updated once a month
- Email chains to track status changes
- No automatic alert when a supplier went from 80% to 105% load

**With this system:**
1. **Real-time risk visibility** — any capacity issue is immediately visible as a risk with severity, score, bottleneck cause, and recommended mitigation already filled in.
2. **No double entry** — enter capacity data once, risk register updates automatically.
3. **Traceability** — every change is logged with who made it and when (activity log).
4. **CAT milestone tracking** — risks are linked to CATE 1/2/3 or Gate 1/2/3 milestones so you know exactly which automotive stage is at risk.
5. **Manager dashboard** — one screen shows the global health of all supplier capacities and risks across all projects.

---

## 6. One-Paragraph Manager Pitch

> *"The CMF platform gives our SQD team a live supply chain risk radar. When an engineer audits a supplier's production capacity, the system automatically calculates whether that supplier can meet the vehicle ramp-up demand. If they can't — if the demand exceeds their installed capacity — the system immediately raises a Critical risk in our risk register with the exact deficit, the bottleneck cause, and a recommended corrective action. Our team then tracks that risk through mitigation on a Kanban board, and the moment the supplier's capacity is confirmed as sufficient, the risk is automatically closed. Everything is linked, auditable, and visible in real time from the manager dashboard."*

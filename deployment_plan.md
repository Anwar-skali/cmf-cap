# 🚀 CMF Platform — Free Deployment Plan

## Architecture Overview

| Layer | Service | Free Tier |
|---|---|---|
| **Frontend** (React/Vite) | **Vercel** | Unlimited static deploys |
| **Backend** (FastAPI/Python) | **Railway** | 500 hrs/month + $5 credit |
| **Database** (PostgreSQL) | **Neon** | 0.5 GB storage, 1 project |
| **File Storage** (uploads) | Railway volume / local disk | Included in Railway |

> [!NOTE]
> The current backend uses **SQLite** locally. For production we migrate to **Neon (PostgreSQL)** — free, serverless, and persistent. Railway's SQLite would be wiped on redeploy.

---

## Pre-requisites
- [ ] GitHub account (to connect Vercel & Railway)
- [ ] Push the project to a **GitHub repository** (public or private)
- [ ] Accounts: [railway.app](https://railway.app), [vercel.com](https://vercel.com), [neon.tech](https://neon.tech)

---

## Phase 1 — Database (Neon PostgreSQL)

- [ ] **1.1** Sign up at [neon.tech](https://neon.tech) → Create a new project called `cmf-platform`
- [ ] **1.2** Copy the **connection string** (format: `postgresql://user:pass@host/dbname?sslmode=require`)
- [ ] **1.3** Keep it safe — you'll paste it into Railway as `DATABASE_URL`

---

## Phase 2 — Backend Code Changes

### 2.1 — Add `Procfile` (Railway start command)
- [ ] Create `backend/Procfile`:
```
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### 2.2 — Add `runtime.txt` (Python version pin)
- [ ] Create `backend/runtime.txt`:
```
python-3.11
```

### 2.3 — Fix CORS for production
- [ ] Update `backend/.env.example` to include the Vercel domain:
```
CORS_ORIGINS=["https://your-app.vercel.app","http://localhost:5173"]
```
The actual value will be set as an env var in Railway after Vercel gives you the URL.

### 2.4 — Ensure Alembic migrations run on startup
- [ ] In `backend/app/main.py` lifespan, add a production migration call so the DB schema is applied automatically on first deploy.

> [!IMPORTANT]
> The backend currently uses SQLite and `_create_tables_if_sqlite()` only in development mode. In production on Railway with Postgres, we need Alembic to run migrations automatically.

---

## Phase 3 — Frontend Code Changes

### 3.1 — Add `.env.production` 
- [ ] Create `frontend/.env.production`:
```
VITE_API_URL=https://your-railway-backend.up.railway.app/api/v1
```
(Replace with the actual Railway URL after deploy)

### 3.2 — Update `vite.config.ts` for production build
No changes needed — the production build uses `VITE_API_URL` env var directly (already configured in `constants.ts`).

### 3.3 — Add `vercel.json` for SPA routing
- [ ] Create `frontend/vercel.json`:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```
This ensures React Router works correctly (all routes fall back to `index.html`).

---

## Phase 4 — Deploy Backend to Railway

- [ ] **4.1** Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
- [ ] **4.2** Select the repo → Set **root directory** to `backend`
- [ ] **4.3** Railway auto-detects Python — verify it uses `requirements.txt`
- [ ] **4.4** Add environment variables in Railway dashboard:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://...` (from Neon, swap `postgresql://` → `postgresql+asyncpg://`) |
| `SECRET_KEY` | Generate a random 64-char string |
| `ENVIRONMENT` | `production` |
| `ALGORITHM` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` |
| `FIRST_SUPERUSER_EMAIL` | `admin@cmf.com` |
| `FIRST_SUPERUSER_PASSWORD` | (set a strong password) |
| `CORS_ORIGINS` | `["https://your-app.vercel.app"]` |
| `UPLOAD_DIR` | `./uploads` |

- [ ] **4.5** Deploy → copy the Railway public URL (e.g. `https://cmf-backend.up.railway.app`)
- [ ] **4.6** Test: visit `https://cmf-backend.up.railway.app/docs` — FastAPI Swagger UI should load

---

## Phase 5 — Deploy Frontend to Vercel

- [ ] **5.1** Go to [vercel.com](https://vercel.com) → New Project → Import GitHub repo
- [ ] **5.2** Set **root directory** to `frontend`
- [ ] **5.3** Framework preset: **Vite**
- [ ] **5.4** Add environment variable in Vercel dashboard:

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://cmf-backend.up.railway.app/api/v1` |

- [ ] **5.5** Deploy → Vercel gives you a URL like `https://cmf-platform.vercel.app`
- [ ] **5.6** Copy this URL → Go back to Railway → Update `CORS_ORIGINS` to include it → Redeploy

---

## Phase 6 — Final Verification

- [ ] **6.1** Visit the Vercel URL → Login page loads ✅
- [ ] **6.2** Login with `admin@cmf.com` / your set password → Dashboard loads ✅
- [ ] **6.3** Create a project → Data persists in Neon ✅
- [ ] **6.4** Import a template → File uploads work ✅
- [ ] **6.5** Test role restrictions (Buyer / Cap. Mgr / SQD) ✅

---

## Free Tier Limits Summary

| Service | Limit | Notes |
|---|---|---|
| Vercel | Unlimited deploys, 100 GB bandwidth/mo | More than enough |
| Railway | $5 credit/mo (~500 hrs) | Enough for a small team |
| Neon | 0.5 GB storage, 1 project | Fine for development/demo |

> [!TIP]
> If you want to stay completely free long-term, consider **Render** as a Railway alternative (750 hrs/month free). The setup is identical — just swap Railway for Render.

---

## Files to Create / Modify

| File | Action |
|---|---|
| `backend/Procfile` | **CREATE** |
| `backend/runtime.txt` | **CREATE** |
| `backend/app/main.py` | **MODIFY** — auto-run Alembic in production |
| `frontend/.env.production` | **CREATE** |
| `frontend/vercel.json` | **CREATE** |

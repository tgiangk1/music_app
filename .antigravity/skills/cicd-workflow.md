---
name: CI/CD Workflow
description: GitHub Actions CI/CD pipeline convention for music-app with Vercel + Render
---

# CI/CD Workflow Skill — Music App

## Overview

Pipeline s\u1eed d\u1ee5ng **GitHub Actions** \u0111\u1ec3 CI, **Vercel** \u0111\u1ec3 deploy frontend, v\u00e0 **Render** \u0111\u1ec3 deploy backend.

```
Push/PR → CI (lint + test + build) → Staging (develop) → Production (main)
```

## Workflows

| File | Trigger | M\u1ee5c \u0111\u00edch |
|------|---------|----------|
| `ci.yml` | Push m\u1ecdi branch, PR → main | Lint, test, build — block merge n\u1ebfu fail |
| `deploy-staging.yml` | Merge v\u00e0o `develop` | Deploy preview l\u00ean Vercel + Render staging |
| `deploy-production.yml` | Merge v\u00e0o `main` | Deploy production + t\u1ea1o GitHub Release |

## Flow chi ti\u1ebft

### 1. CI (`ci.yml`)
Ch\u1ea1y **3 jobs song song**:
- **Lint** — ESLint tr\u00ean c\u1ea3 FE v\u00e0 API (`--if-present`, skip n\u1ebfu ch\u01b0a config)
- **Test** — Jest unit tests (`--if-present`, skip n\u1ebfu ch\u01b0a config)
- **Build** — `vite build` (FE) + `node --check` (API)

> N\u1ebfu b\u1ea5t k\u1ef3 job n\u00e0o fail → **kh\u00f4ng merge \u0111\u01b0\u1ee3c PR**

### 2. Staging (`deploy-staging.yml`)
Khi merge v\u00e0o `develop`:
1. Deploy FE l\u00ean **Vercel Preview** (kh\u00f4ng ph\u1ea3i production domain)
2. Trigger **Render Staging** deploy via API
3. Comment link staging URL l\u00ean PR li\u00ean quan

### 3. Production (`deploy-production.yml`)
Khi merge v\u00e0o `main`:
1. Ch\u1edd CI pass (`ci-check` gate)
2. Deploy FE l\u00ean **Vercel Production** (`--prod`)
3. Trigger **Render Production** deploy
4. T\u1ea1o **GitHub Release** v\u1edbi changelog t\u1ef1 \u0111\u1ed9ng

## GitHub Secrets c\u1ea7n setup

V\u00e0o **Settings → Secrets and variables → Actions**, th\u00eam:

| Secret | Ngu\u1ed3n | M\u1ee5c \u0111\u00edch |
|--------|-------|----------|
| `VERCEL_TOKEN` | [vercel.com/account/tokens](https://vercel.com/account/tokens) | Auth Vercel CLI |
| `VERCEL_ORG_ID` | Vercel Dashboard → Settings → General | Identify Vercel team/org |
| `VERCEL_PROJECT_ID` | Vercel Dashboard → Project → Settings → General | Identify Vercel project |
| `RENDER_API_KEY` | [dashboard.render.com/account/api-keys](https://dashboard.render.com/account/api-keys) | Auth Render API |
| `RENDER_BACKEND_SERVICE_ID` | Render Dashboard → Service → Settings | ID c\u1ee7a backend service |

## Checklist tr\u01b0\u1edbc khi merge v\u00e0o `main`

- [ ] CI pipeline (lint + test + build) pass \u2705
- [ ] PR \u0111\u00e3 \u0111\u01b0\u1ee3c review v\u00e0 approved
- [ ] Kh\u00f4ng c\u00f3 merge conflicts
- [ ] \u0110\u00e3 test tr\u00ean staging (n\u1ebfu c\u00f3 thay \u0111\u1ed5i l\u1edbn)
- [ ] Env vars production \u0111\u00e3 c\u1eadp nh\u1eadt (n\u1ebfu th\u00eam bi\u1ebfn m\u1edbi)
- [ ] Database migrations \u0111\u00e3 \u0111\u01b0\u1ee3c ki\u1ec3m tra (n\u1ebfu thay \u0111\u1ed5i schema)
- [ ] PR body \u0111\u00e3 \u0111i\u1ec1n \u0111\u1ea7y \u0111\u1ee7 theo template

## Quy t\u1eafc cho Agent

- **KH\u00d4NG** trigger deploy th\u1ee7 c\u00f4ng — workflow t\u1ef1 ch\u1ea1y khi merge
- **LU\u00d4N** ch\u1ea1y CI locally tr\u01b0\u1edbc khi push (n\u1ebfu c\u00f3 th\u1ec3)
- Khi th\u00eam env var m\u1edbi → nh\u1eafc user c\u1eadp nh\u1eadt tr\u00ean Vercel/Render **v\u00e0** GitHub Secrets
- Khi workflow fail → \u0111\u1ecdc logs v\u00e0 s\u1eeda tr\u01b0\u1edbc khi retry

# Anitrack (Ani-Tracker)

**GitHub repository:** [https://github.com/IsanaNao/Anitrack](https://github.com/IsanaNao/Anitrack)

A personal anime watchlist and progress tracker built with **Next.js (frontend) + NestJS (backend) + MongoDB**, featuring automated activity heatmaps and multi-layer contract testing.

> **Milestone (2026-05-28):** All **course content requirements** are implemented in the repository (NestJS, API-first, CRUD, tests, thin frontend, responsive UI). Since **2026-05-21**, the app ships full **Chinese/English UI**, Bangumi mapping, and responsive layout. Defense copy and diagrams live under `Project_Intro/` and `anitrack-visuals/`. Login, multi-user, and “zero TBD” timetable polish are **optional** (Blueprint §10.5).
>
> **Compliance (one line):** Content requirements are met in code; organizational requirements (three speakers × ~7 minutes each, role split, live demo) are fulfilled on presentation day.

## Repository layout

| Directory | Purpose |
|-----------|---------|
| `anitrack/` | Next.js frontend (port `3000`) |
| `anitrack/anitrack-backend/` | NestJS backend (**primary API**, port `3001`, Swagger `/api-docs`) |
| `anitrack-tester/` | Contract tests and HTTP smoke scripts |
| `anitrack-visuals/` | Defense diagrams (English PNG/SVG in `figures/`) |
| `Project_Intro/` | Defense materials (requirements, outline, script, checklist) |
| `PROJECT_BLUEPRINT.md` / `TASK_PROGRESS.md` | Design blueprint and working log (Chinese); **English:** `docs/en/` |
| `5-Anitrack/` | `openapi.json` + `Anitrack_sourcecode.zip` for upload |

## Vision

Anitrack is more than a watchlist. It aggregates viewing behavior into a **GitHub-style contribution heatmap** so personal anime history becomes a visible timeline.

## Core features (implemented)

### 1) Logic-heavy backend

- **State machine:** Illegal status transitions are rejected (e.g. only `WATCHING` or `DROPPED` may become `COMPLETED`).
- **Completion timestamps:** `completedDates` is maintained automatically when status is `COMPLETED` (supports rewatches).
- **Aggregation:** MongoDB pipelines output heatmap JSON with **intensity** levels on the server.
- **Stats APIs:**
  - `GET /api/stats/summary` — dashboard/profile headline metrics
  - `GET /api/stats/activity?month=YYYY-MM` — monthly added/completed lists
  - `GET /api/anime-meta/seasonal-random` — seasonal picks from `AnimeMirror` (**no Jikan HTTP** on this path)
- **Dual-table ownership:** `AnimeMeta` (shared metadata) vs `AnimeEntry` (per-user progress).
- **Cache-aside by `malId`:** Jikan fetch on miss, stored in MongoDB.
- **24h Jikan HTTP cache** via NestJS `CacheModule`.
- **Timetable (`/timetable`):** Scrollable Berlin-date strip (±2 weeks), daily lists from `AnimeMirror`; Bangumi weekday first, Jikan `broadcast` fallback. Some air times remain **TBD**.
- **i18n:** UI **中文 / English**; titles/synopsis picked by locale. Legacy library titles mapped in the background (`[i18n-map]` logs); manual `POST /api/bee/map-mal-ids?malIds=...`.
- **Responsive UI:** Hamburger nav, compact `AnimeCard`, dashboard horizontal scroll, profile heatmap horizontal scroll (see `TASK_PROGRESS.md` §4.11).
- **Bee mirroring:** Background Jikan → `AnimeMirror` at ~65s / 3 requests; resume after restart; tiered priority (`seasonal` > `top_1y` > …); mirror-first reads.

### 2) Contract-driven development

- **OpenAPI 3.0:** `anitrack/anitrack-backend/swagger.json` → `http://localhost:3001/api-docs`
- **Tests:** Vitest unit tests, integration tests, `anitrack-tester/contract-validator` smoke against declared HTTP methods

### 3) Tooling

- **Seeder** for demo heatmap data
- **Date normalization** for mixed BSON `Date` / string storage (`Europe/Berlin` default)

## Tech stack

- **Frontend:** Next.js (App Router), Tailwind CSS
- **Backend:** NestJS 11, Mongoose, Swagger (OpenAPI 3.0)
- **Database:** MongoDB Atlas
- **Validation:** class-validator / class-transformer
- **Testing:** Vitest, AJV, Jest (backend)

## Roadmap

- [x] Phase 1: Watchlist CRUD + persistence
- [x] Phase 2: Stats, heatmap, automated tests
- [x] Phase 3: `AnimeMeta` cache + main UI
- [x] Phase 4: `/timetable`, seasonal random + detail dialog
- [x] Phase 5: Site-wide bilingual UI
- [x] Phase 5+: Responsive layout
- [ ] Phase 6+ (**optional**): Auth / multi-user; personalized recommendations; timetable “zero TBD” — Blueprint §10.5

## Defense preparation

See `Project_Intro/答辩清单.md` (bilingual checklist). Slides and live demo should use **English**.

| Material | Status | Path |
|----------|--------|------|
| Requirements (DE + ZH) | Ready | `Project_Intro/项目要求.md` |
| Outline / script | Ready | `Project_Intro/演讲大纲.md`, `PPT文字稿大纲.md` |
| Diagrams (EN) | Ready | `anitrack-visuals/figures/` |
| PPT | Generated | `Project_Intro/slides/Anitrack_Defense.pptx` → export **PDF** for upload |
| Course upload bundle | Ready | `5-Anitrack/openapi.json`, `5-Anitrack/Anitrack_sourcecode.zip` |

## Quick start

```bash
# Terminal 1 — backend (3001)
cd anitrack/anitrack-backend
npm install
npm run start:dev

# Terminal 2 — frontend (3000)
cd anitrack
npm install
npm run dev
```

Create `anitrack/anitrack-backend/.env` (gitignored):

```plaintext
MONGODB_URI=<your connection string>
JIKAN_BASE_URL=https://api.jikan.moe/v4
SYNC_ENABLED=true
```

- Swagger UI: `http://localhost:3001/api-docs`
- OpenAPI JSON: `http://localhost:3001/swagger.json`
- App: `http://localhost:3000/`

## Tests

```bash
# Frontend unit tests (in anitrack/)
npm test
npm run test:integration

# Contract test (backend must be running on 3001)
cd ../anitrack-tester/contract-validator
node run-contract-test.js
```

## Bee 429 runbook (short)

1. `GET http://localhost:3001/api/bee/status` — check `backoffUntil`
2. After backoff: `POST http://localhost:3001/api/bee/seed-step`
3. Sync batch: `POST http://localhost:3001/api/bee/sync-step?batchSize=3`

English design details: **`docs/en/PROJECT_BLUEPRINT.md`**. Progress log: **`docs/en/TASK_PROGRESS.md`**.

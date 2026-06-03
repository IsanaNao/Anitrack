# Anitrack — Task Progress & Working Log

> Purpose: Make “where we are, what’s next, blockers, and decisions” visible at a glance.  
> Convention: After each change, update **Current status** and **Next steps**.

---

## 0. Current status (update here)

- **Phase:** All **planned course features are delivered**; repo is demo/defense-ready
- **Compliance (one line):** Content requirements implemented in the repo; organizational requirements (~7 min/person, roles, live demo) completed on defense day via `Project_Intro`
- **Optional extras:** Auth, recommendation algorithms, pure Jikan schedule view — **not mandatory**; **site-wide i18n (§4.9)**, **library Bangumi on-demand mapping**, **responsive design (§4.11)** are **done**
- **Defense materials (`Project_Intro/`):**
  - [x] Requirements, checklist, slide outline, PPT script (Chinese primary + DE/EN对照)
  - [x] Diagrams `anitrack-visuals/figures/*.png` (English labels)
  - [x] `.pptx` — `Project_Intro/slides/Anitrack_Defense.pptx` (16 slides; rebuild via `build_defense_pptx.py`)
  - [ ] English Swagger/UI screenshots for slides 7/12; real names on slide 2; timed rehearsal
- **Next:** Finish PPT/screenshots per `Project_Intro/答辩清单.md`; run app in **English** during demo
- **Blockers:** None at course level; `TEMP_USER_ID` until Auth (§9); timetable **TBD** is a data limitation
- **Last updated:** 2026-06-03 (submission bundle + English docs for professor)

---

## 1. Milestones (aligned with course)

- [x] **Phase 1 (backend base):** Next.js API routes + MongoDB + `/api/anime` CRUD + OpenAPI + contract testing
- [x] **Phase 2 (refactor & tests):** NestJS migration + dual-table ownership + heatmap tests/contracts
- [x] **Phase 3 (Jikan + frontend):** Search integration + UI wiring end-to-end
- [x] **Phase 4 (pages):** Routes `/`, `/library`, `/profile` + shared components + pagination/`CurrentUser`
- [x] **Phase 5 (deep UX):** Search pagination/debounce + global Dialog + profile heatmap/stats cards

---

## 2. Phase 1: Backend base (done)

- [x] Next.js App Router skeleton, MongoDB connection, `AnimeEntry` schema
- [x] Full `/api/anime` CRUD with state machine and unified error envelope
- [x] Minimal OpenAPI; `anitrack-tester` smoke + contract validator

---

## 3. Phase 2: Logic & tests (done)

- [x] Heatmap aggregation pipeline with Date/string normalization fix
- [x] Monthly heatmap `GET /api/stats/heatmap`
- [x] Vitest unit + integration tests; `heatmap-seeder.js`; strict contract tests green

---

## 4. Phase 3: Frontend (core done)

### 4.0 Ownership split
- [x] `AnimeMeta` + `AnimeEntry`, `(userId, malId)` unique, nested `animeMeta` in responses

### 4.1–4.3 UI / watchlist / heatmap
- [x] Tailwind layout, library CRUD via global Dialog, monthly heatmap + activity API

### 4.4 Seasonal schedule (optional second view)
- [ ] Optional pure Jikan `/schedule` — not required for course delivery

### 4.5–4.7 Search, dashboard, timetable
- [x] `GET /api/anime-meta/search`, soft-create on meta failure
- [x] `GET /api/stats/summary`, watching carousel, `seasonal-random` + `SeasonalPickDetailDialog`
- [x] `GET /api/anime-meta/timetable`, `/timetable` UI; some **TBD** air times remain

### 4.8 Bee mirror system
- [x] Cron 65s/3 req, tiers, Bangumi map + enrich, manual `seed-step` / `sync-step` / status

### 4.9 Site-wide i18n — **done (2026-05-21)**
- [x] `I18nProvider`, `LanguageSwitcher`, `pickAnimeTitle` / `pickAnimeSynopsis`
- [x] Backend `attachMirrorI18n`; library background Bangumi mapping + `POST /api/bee/map-mal-ids`

### 4.11 Responsive design — **done (2026-05-21)**
- [x] Hamburger nav, compact cards, timetable date strip ±2 weeks, heatmap horizontal scroll
- [x] `npm run build` passes for frontend and backend

### 4.10 Swagger Bee POST + contract by method (2026-05-21)
- [x] Bee POST paths in `swagger.json`; smoke uses declared HTTP methods per path

---

## 5. Decision log (ADR)

- 2026-04-20: Heatmap intensity thresholds (0→0 … 5+→4)
- 2026-04-20: Dates as `YYYY-MM-DD`
- 2026-05-21: i18n — UI dictionary vs anime fields decoupled; no `next-intl` routes yet
- 2026-05-21: Swagger includes Bee POST; contract smoke respects methods

---

## 6. Open questions

- [x] Site-wide bilingual UI — done (§4.9)
- [ ] Auth / multi-user — optional (Blueprint §3.10)
- [x] Jikan cache-aside — done
- [x] Heatmap default range — last 365 days in configured `tz`

---

## 7. Changelog (selected)

- 2026-04-20: Blueprint + this log created; MongoDB + CRUD green
- 2026-04-22: NestJS migration port 3001; ownership split
- 2026-04-29: Search proxy, multi-page UI, profile monthly heatmap
- 2026-05-07: Activity/summary APIs, Bee system, dashboard/timetable skeletons
- 2026-05-13: Timetable real data; `seasonal-random` mirror-only
- 2026-05-21: i18n, responsive, Bee POST in OpenAPI
- 2026-05-28: `anitrack-visuals`, `Project_Intro` defense pack
- 2026-06-03: `submission/` bundle + `docs/en/` for professor

---

## 9. Tech debt

- **`TEMP_USER_ID`:** Replace with real user from token when Auth lands
- **Timetable TBD:** Upstream broadcast fields incomplete
- **OpenAPI:** POST paths documented; 429 on Bee POST = warning in smoke
- **Index migration:** Drop `animeentries` if old unique `malId` index blocks inserts

---

## 10. Test / troubleshooting runbook

| Layer | Command / URL |
|-------|----------------|
| Swagger alive | `http://localhost:3001/api-docs` |
| Backend tests | `cd anitrack/anitrack-backend && npm test` |
| Frontend tests | `cd anitrack && npm test` / `npm run test:integration` |
| Contract | `cd anitrack-tester/contract-validator && npm run contract` |
| HTTP smoke | `anitrack-tester/api-test-suite/run-all.js` (set `BASE_URL` to `3001` for Nest) |

---

## 11. Core vs nice-to-have (Blueprint §10.5)

| Category | Items |
|----------|--------|
| **Not built (optional)** | Auth; personalized recommendations |
| **Worth doing** | Footer copy for TBD/`bgmId=0`; defense PDF + screenshots |
| **Defer / low ROI** | Zero-TBD timetable; full parallel Jikan schedule site |
| **Keep as-is** | Single user; Bee 65s/3; Berlin timetable ±2 weeks; i18n pickers; responsive §4.11 |

---

## 12. Defense diagrams (done, English labels)

Output: `anitrack-visuals/figures/` — tech-stack, architecture, user-flow, data-flow.  
Materials: `Project_Intro/` — see checklist. Live demo: **English** UI, API on port **3001**.

---

## 13. Defense ↔ course mapping

| Document | Role |
|----------|------|
| `Project_Intro/项目要求.md` | Official requirements DE + ZH |
| `docs/en/PROJECT_BLUEPRINT.md` | English blueprint for professor |
| `docs/en/README.md` | English project overview |
| This file (`docs/en/TASK_PROGRESS.md`) | English progress log |

**Manual:** Export PPT to PDF; add screenshots; fill slide 2 with team roles.

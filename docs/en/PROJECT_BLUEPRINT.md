# Anitrack — Project Blueprint

> English version of PROJECT_BLUEPRINT.md (2026-06-03)
>
> This document serves as Anitrack's "master outline for design and implementation / miscellaneous notes entry point."  
> Content may remain heterogeneous and can be continuously appended.
> Course-oriented goals: **API-First, frontend-backend decoupling, backend-owned logic, testability, responsive UI**.

> **Project status (2026-05-28)**: **Course content requirements are already closed-loop in the repository**; defense-side scripts and visuals are ready (`Project_Intro/`, `anitrack-visuals/`), while `.pptx`, English screenshots, and on-site rehearsal are **pending**. See **`TASK_PROGRESS.md` §0** for detailed progress.

---

## 0. Project Overview

- **Project name**: Anitrack (Personal Anime Watchlist & Analytics)
- **Core objective**: Build a full-stack web application that satisfies the Web-Technologies I course requirements, with emphasis on:
  - **API-First**: Backend APIs run independently and can be consumed by script clients.
  - **Frontend-backend decoupling**: Frontend handles rendering and interaction only; backend provides a stable data contract.
  - **Business logic encapsulation**: Statistical computation and state-machine validation stay strictly in the backend.
  - **Responsive UI**: Consistent and reasonable experience across mobile and desktop.
- **Runtime ports (Truth)**:
  - **Backend**: NestJS (`http://localhost:3001`, API Base: `/api`, Swagger UI: `/api-docs`)
  - **Frontend**: Next.js (`http://localhost:3000`)

---

## 1. Core Features (MVP -> Extensible)

### 1.1 Watchlist CRUD (Core)
Perform create/read/update/delete operations around anime entry states.

- **States** (enum):
  - `PLANNED`
  - `WATCHING`
  - `ON_HOLD`
  - `DROPPED`
  - `COMPLETED`
- **Core capabilities**:
  - Create entries (frontend submits `malId` only; backend fetches metadata via shadow-cache layer)
  - Update entries (especially state transitions and completion date handling)
  - Delete entries
  - List queries (status filtering, pagination/sorting)

### 1.2 Seasonal Schedule / Timetable (External Data Integration)
Current implementation is based on **Bee `AnimeMirror` (seasonal Jikan mirror)**, with **Bangumi mapping preferred** and **Jikan `broadcast` used as weekday/time fallback**; it does not rely solely on Jikan's schedule endpoint.

- **Backend**: `GET /api/anime-meta/timetable?days=7|14` — reads seasonal `tier=seasonal` mirror data; weekday bucketing prefers `bangumi.weekday`, and falls back to **`broadcast.day` / `broadcast.string`** when unavailable (same convention as Bangumi: 1=Monday...7=Sunday); Tokyo wall-clock time is converted via **`dayjs` (`Asia/Tokyo`) -> `Europe/Berlin`** and mapped to Berlin calendar-day columns (see **§3.8.6**). If Bangumi mapping is missing, **`bgmId` may be `0`** and no Bangumi link is shown in the detail panel.
- **Frontend**: `/timetable` — horizontal date columns, item cards, countdowns; each column renders the full `items` array from API (**no "max N items per column" truncation**); layout uses **`items-start`** so columns align by content height. Clicking an item opens details and supports **adding to watchlist (`PLANNED` / `WATCHING`)** or opening `AnimeEntryDialog` for existing entries; the placeholder "Anime Index" tab is **removed**.
- **Display language (timetable domain)**: API returns multilingual snapshots (`title` / `titleCn` / `titleJp` / `titleEn`, `synopsisCn` / `synopsisEn` / `synopsisJa`); **frontend selects title/synopsis based on UI language** (see **§7.5**) and no longer hardcodes English-first in timetable pages.

> **Deferred (known gap)**: **Some anime may not appear in certain columns**: if Bangumi title matching fails, enrich data is unavailable; and if Jikan **`broadcast.day` is Unknown** and `bangumi.weekday` is also absent, weekday bucketing cannot be performed. **Broadcast time TBD** (`airTimeLocal` empty) can still occur when upstream lacks reliable `airTime`/clock fields. Implemented mitigations include **`parseBangumiWallClockWithExtendedHours`**, parsing time from `airDate` containing `T`, combining with `broadcast.time`, **`POST /api/bee/sync-step?refreshSeasonalAirTimes=true`**, response **`airTime`**, and F12 logs. **Full scheduling completeness and 100% mapping** depend on data-source quality or operational strategy; this is **nice-to-have**, not a blocker for core course delivery (see **§10.5**).

### 1.3 Anime Heatmap (Highlight: Green Wall)
Generate a GitHub-contributions-like life grid (monthly) based on user watch behavior.

- **Axes**: y-axis = months (Jan-Dec), x-axis = years (from start year to current year)
- **Input signals (backend aggregation)**:
  - `addedCount`: number of entries added in that month (by `createdAt` month)
  - `completedCount`: number of entries completed in that month (by `completedAt` month, `status=COMPLETED`)
  - `episodeCount`: total watched episodes in that month (sum `episodesWatched` by `completedAt` month)
- **Output structure**: `months[]` (one cell per month), containing `intensity` (0-4)
- **Interaction (frontend)**:
  - Hover: GitHub-style floating tooltip (`pointer-events: none` to avoid hover interference)
  - Click: lock a month and show "Activity for YYYY-MM" below the heatmap (Added/Completed timeline list)

### 1.4 Data Persistence (MongoDB)
MongoDB stores users and personalized watchlists, plus date-dimension data required by heatmap statistics.

---

## 2. Technical Constraints (Course Mapping)

### 2.1 API-First
- Backend exposes explicit contracts via **OpenAPI/Swagger** (fields, status codes, error schema).
- Frontend depends on API only (must not duplicate statistics/validation logic client-side).
- APIs must be callable by script clients (curl / node scripts / postman).

### 2.2 Logic Separation (Backend-Owned Logic)
- Frontend: rendering, form collection, routing, UI state management, API calls.
- Backend: data validation, state-machine transition constraints, statistical computation, aggregation logic, auth (if implemented).

### 2.3 Testing (Mandatory)
- **Integration Tests** for API endpoints to verify:
  - HTTP status codes
  - Response schema
  - Persistence side effects (created/updated data can be queried)
- **Unit Tests** for core algorithms/pure functions (e.g., heatmap intensity level mapping).

### 2.4 Responsive (Mandatory)
Must cover at least mobile and desktop, with explicit layout strategy per breakpoint (see Chapter 7).

---

## 3. OpenAPI / Swagger: Core API Endpoints and Structures (Draft)

> Note: This section is the contract draft. The **runtime OpenAPI document** is loaded by Nest at startup from **`anitrack-backend/swagger.json`** (`main.ts` -> `SwaggerModule.setup('api-docs', ...)`), available at **`http://localhost:3001/api-docs`**, with JSON at **`http://localhost:3001/swagger.json`**.  
> **Coverage note**: The file currently includes at least `GET/POST /api/anime`, `GET/PATCH/DELETE /api/anime/{id}`, `GET /api/stats/heatmap`, and several discovery-type **GET** endpoints (Bee / `anime-meta`). For **POST-only** endpoints (e.g., `POST /api/bee/sync-step`), directly adding them in `paths` without updating contract smoke logic may cause `contract-smoke-test` to wrongly send **GET** to the same path and fail, so such endpoints may appear only in Blueprint or `@ApiOperation` notes. When extending contracts, sync **`anitrack-tester/contract-validator`** accordingly.  
> API Base: `/api`

### 3.1 Common Conventions

#### 3.1.1 Content-Type
- Request: `application/json`
- Response: `application/json`

#### 3.1.2 Generic Error Structure

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable message",
    "details": [
      { "path": "status", "reason": "Invalid enum value" }
    ]
  }
}
```

#### 3.1.3 Generic Pagination Structure (Optional)

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "total": 0
}
```

---

### 3.2 `GET /api/anime`
Retrieve watchlist entries (supports status filtering, pagination, sorting).

#### Query
- `status` (optional): `PLANNED|WATCHING|ON_HOLD|DROPPED|COMPLETED`
- `page` (optional): number, default 1
- `pageSize` (optional): number, default 20
- `sort` (optional): e.g., `updatedAt:desc` (exact format to be finalized during implementation)

#### 200 Response (Paginated)

```json
{
  "items": [
    {
      "id": "65f0c1... (string)",
      "userId": "default_user",
      "malId": 5114,
      "status": "COMPLETED",
      "rating": 9,
      "notes": "optional",
      "startedAt": "2026-04-01",
      "completedAt": "2026-04-12",
      "completedDates": ["2026-04-12"],
      "animeMeta": {
        "malId": 5114,
        "title": "Fullmetal Alchemist: Brotherhood",
        "imageUrl": "https://...",
        "episodes": 64,
        "score": 9.11
      },
      "createdAt": "2026-04-12T10:00:00.000Z",
      "updatedAt": "2026-04-12T10:00:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1
}
```

---

### 3.3 `POST /api/anime`
Create a watchlist entry.

#### Request Body

```json
{
  "malId": 5114,
  "status": "PLANNED",
  "rating": 9,
  "notes": "optional",
  "startedAt": "2026-04-01",
  "completedAt": "2026-04-12",
  "completedDates": ["2026-04-12"]
}
```

#### Field Rules (Backend-Enforced)
- `malId`: number, unique per user (enforced via DB compound unique index `(userId, malId)`)
- `status`: must be one of the enum values
- `rating`: optional, recommended range 1-10 (or 0-10), validated by backend
- `completedAt` / `completedDates`:
  - writable only when `status=COMPLETED` (or auto-maintained during state transition)
  - date format: `YYYY-MM-DD` (more stable for heatmap aggregation)

#### 201 Response
Returns the created entry (same structure as `GET /api/anime` items).

---

### 3.4 `GET /api/anime/{id}`
Get details of one entry.

#### 200 Response
Entry object (same as above).

#### 404 Response
Resource not found.

---

### 3.5 `PATCH /api/anime/{id}`
Update an entry (focus: status transitions and date maintenance).

#### Request Body (Partial Fields)

```json
{
  "status": "COMPLETED",
  "rating": 10,
  "notes": "rewatch soon",
  "completedAt": "2026-04-20",
  "completedDates": ["2026-04-20"]
}
```

#### 200 Response
Updated entry object.

#### 409 Response (Recommended)
Returned when state-machine transition is invalid (e.g., direct `DROPPED` -> `WATCHING` forbidden).

---

### 3.6 `DELETE /api/anime/{id}`
Delete an entry.

#### 204 Response
No body.

---

### 3.7 `GET /api/stats/heatmap`
Return heatmap data (current implementation: monthly life grid).

#### Query (Recommended)
- `start` (optional): `YYYY-MM`, default: past 12 months
- `end` (optional): `YYYY-MM`, default: current month
- `tz` (optional): IANA timezone identifier (currently validated only; aggregation uses UTC month)

#### 200 Response (Monthly Aggregation)

```json
{
  "start": "2005-05",
  "end": "2006-04",
  "months": [
    {
      "month": "2005-05",
      "addedCount": 5,
      "completedCount": 2,
      "episodeCount": 48,
      "intensity": 3
    }
  ]
}
```

#### Intensity Levels (0-4, Defined in Backend)
- `intensity=0` indicates no activity in that month.
- Others map to 1-4 by threshold policy (see Chapter 5; currently can weight by `addedCount+completedCount`).

> Note: Legacy "daily green wall (weeks->days, from/to)" belongs to historical implementation/testing residue and is no longer the main UI contract target.
> Compatibility policy: frontend `anitrack/src/app/api/stats/heatmap/route.ts` now **proxies to NestJS** (`http://localhost:3001/api/stats/heatmap`); outward semantics across repository follow NestJS.
> Frontend Activity-list filtering uses `dayjs.utc(...).format('YYYY-MM')` to align with backend UTC month aggregation, avoiding "stats has data but list is empty" due to timezone cross-month drift.

---

### 3.7.1 `GET /api/stats/activity?month=YYYY-MM`
Return activity list for a month (Added/Completed), used after clicking a heatmap cell in Profile page.

#### Query
- `month`: `YYYY-MM` (required)

#### 200 Response

```json
{
  "month": "2026-05",
  "added": [ { "id": "...", "malId": 1, "status": "PLANNED", "animeMeta": { "title": "..." } } ],
  "completed": [ { "id": "...", "malId": 2, "status": "COMPLETED", "completedAt": "2026-05-03" } ]
}
```

---

### 3.7.2 `GET /api/stats/summary`
Single-shot aggregation for Dashboard/Profile top statistic cards, avoiding performance and consistency issues from frontend paginated pulling.

#### 200 Response

```json
{
  "total": 15,
  "totalCompleted": 4,
  "totalWatching": 6,
  "avgRating": 8.7,
  "ratedCount": 12,
  "totalEpisodesWatched": 36
}
```

---

### 3.8 Data Cache Layer (AnimeMeta Cache, Strategic Reserve)

> **Goal**: migrate Jikan (public MyAnimeList data) read path from "direct external API each time" to "MongoDB-backed **Cache-Aside** shadow repository", reusable for both coursework and future personal-blog scenarios.

- **Collection role**: add **`AnimeMeta`** (name adjustable) as a **normalized snapshot of Jikan responses** (e.g., stable fields like `malId`, `title`, `images`, `aired`), decoupled from business table **`AnimeEntry`**: former for "catalog metadata", latter for "user watch state".
- **Cache-Aside pattern**:
  1. **Read path**: query **`AnimeMeta`** by `malId` (or search-key hash) first; if **hit**, return local document directly to avoid Jikan **Rate Limiting**.
  2. **Miss path**: request Jikan synchronously; after success, **asynchronously write payload** into `AnimeMeta` (`setImmediate` / queue / background `Promise`, to be finalized in implementation), then return current response.
  3. **Invalidation policy (optional)**: TTL index, `updatedAt` threshold, or manual purge; early phase can use "long-term cache + manual refresh" for lower complexity.
- **Engineering benefits**: significantly reduced external API coupling and **429** risk; local index (e.g., `malId` unique) supports "constant-time primary-key lookup" under exaggerated "**billion-scale**" rhetoric (orders-of-magnitude difference compared with per-request HTTP roundtrip).

> **Implementation status**: NestJS backend already uses dual-table architecture: `AnimeMeta` (public cache) + `AnimeEntry` (user-private progress). Entry creation follows **Cache-Aside**: read/write `AnimeMeta` first, then write `AnimeEntry`, and return nested `animeMeta` in response.

#### 3.8.1 Jikan Search Relay (Search -> Upsert -> Return)
To avoid frontend direct calls to external APIs, add backend relay endpoint:
- `GET /api/anime-meta/search?q=...`:
  - Upstream: `GET https://api.jikan.moe/v4/anime?q={q}&limit=5`
  - Processing: bulk upsert results into `AnimeMeta` by `malId` (deduplicate, preserve order)
  - Return: normalized `AnimeMeta[]` (contains `id`; hides `_id/__v`)

#### 3.8.2 429 Rate-Limit Strategy
- When upstream returns 429: backend preserves semantics with **HTTP 429** and error code `UPSTREAM_RATE_LIMIT` (frontend prompts retry later).

#### 3.8.3 Soft Mode
Considering Jikan availability and rate-limit fluctuations, `POST /api/anime` supports soft creation:
- If fetching/reading `AnimeMeta` fails: log error but **do not block** `AnimeEntry` creation.
- In this case, `animeMeta` in response is `null`.

#### 3.8.4 Runtime Cache (CacheModule, 24h)
Beyond MongoDB shadow cache, backend includes NestJS `CacheModule` and applies 24h caching to all Jikan HTTP requests (cache key based on full URL), reducing 429 occurrence from source.

#### 3.8.5 Seasonal Random Recommendation (`seasonal-random`, Pure Mongo / No Jikan HTTP)

> Dashboard "Seasonal Random Recommendation" read path: **no Jikan call**; depends only on Bee-written `AnimeMirror` (seasonal queue must have synced `data`).

- **Endpoint**: `GET /api/anime-meta/seasonal-random?limit=` (`limit` optional, default 4; backend clamps roughly to 1-12 items)
- **Data source**: `AnimeMirror` collection, filtering `tier=seasonal` with existing `data`; use MongoDB aggregation **`$sample`** random sampling.
- **Response**: `{ items: [...] }`, each item aligns with `AnimeMeta` display model fields (`malId/title/imageUrl/score/genres/totalEpisodes/synopsis/...`).
- **Frontend (Dashboard)**: recommendation cards are clickable and open **`SeasonalPickDetailDialog`** (cover, score, genres, synopsis, **add to watchlist**); "Add to watchlist" button remains below list.
- **Empty data**: if seasonal mirror is not written yet or still syncing, endpoint may return `items: []` (frontend should show empty state and Bee runtime hint).

#### 3.8.6 Seasonal Timetable (`GET /api/anime-meta/timetable`)

> Read path: **no Jikan HTTP** (depends on `AnimeMirror.data` and Bee-maintained Bangumi fields; **weekday** is merged at app layer from Bangumi and Jikan `broadcast`).

- **Endpoint**: `GET /api/anime-meta/timetable?days=` (`days` default 7, max 14)
- **Mongo filters**: `tier=seasonal`, `malId>0`; app layer further keeps documents where **`resolveTimetableWeekdayBangumi` resolves 1-7** (prefer `bangumi.weekday`, else Jikan **`broadcast.day` / `broadcast.string`**).
- **Response**: `{ timezone: "Europe/Berlin", days: [ { date, dateLabel, weekdayLabel, items[] } ] }`
- **Single `items[]` (key points)**:
  - `malId` / **`bgmId`** (**`0`** if no Bangumi mapping), `imageUrl` (from mirrored Jikan payload)
  - `title`: English-preferred display string; `titleJp` / `titleEn`: multilingual snapshots
  - `airTime`: **raw upstream broadcast string** used in conversion (for diagnostics; compare with `airTimeLocal`)
  - `airTimeLocal` / `nextAirAtIso`: Tokyo wall clock (including **extended-hour notation**) converted by **`dayjs` (`Asia/Tokyo`)** to `Europe/Berlin`; parser combines `bangumi.airTime`, time in `airDate` with `T`, and Jikan **`broadcast`**; empty if missing (frontend shows **TBD**)
  - `synopsisEn` / `synopsisJa`: from mirrored Jikan `synopsis` (not Bangumi Chinese synopsis)
  - `episodeLabel`: currently **`Seasonal`** (seasonal-item marker)

---

### 3.9 Bee: Anime Mirror System (Cron Mirror Sync)

> Goal: provide a **local data mirror** for read-heavy/write-light, third-party-dependent functions (Schedule / Recommendation etc.), using controlled-rate background Jikan fetches into MongoDB:
> - **Polite crawling**: low-frequency, controlled batch size, with `User-Agent`
> - **Resumable crawling**: continue from DB `lastUpdated` status after restart, no full restart from zero
> - **Freshness policy**: seasonal titles refresh fast (3 days), legacy titles slower (30 days)
> - **Mirror-first reads**: prefer mirror for metadata reads, passively fetch only when missing

#### 3.9.1 Directory Structure (Backend)

```text
anitrack-backend/src/modules/bee/
├── bee.module.ts
├── bee.service.ts
├── bee.cron.ts
└── schemas/
    └── anime-mirror.schema.ts
```

#### 3.9.2 Collection: `AnimeMirror`
- `malId: number` (unique index)
- `data: object` (full JSON returned by Jikan)
- `lastUpdated: Date`
- `source: 'seasonal' | 'general'`
- `tier: 'seasonal' | 'top_1y' | 'top_5y' | 'top_all' | 'backfill'` (sync tier)
- `priority: number` (smaller value = higher priority)
- **`bgmId` (optional)**: Bangumi `subject_id`; aligned with `ApiMapping`, used for calendar matching and enrich
- **`titles` (optional)**: `{ cn?, jp?, en? }` — multilingual title snapshot (timetable English-priority rendering depends on this structure + Jikan `title_english`)
- **`bangumi` (optional)**: `weekday` (1-7), `airTime` (Tokyo wall clock, allows **25:00-47:59** notation), `airDate` (`air_date`), `summaryCn`, `detailFetchedAt`, etc.

#### 3.9.3 Scheduling Rhythm (Avoid 60-second Boundary)
- Execute every **65 seconds**
- Sync **3** entries per tick (`/anime/{id}`)

#### 3.9.4 Priority Policy (Multi-Tier)
By `priority` (smaller first):
1. `seasonal` (current season, priority=0)
2. `top_1y` (popular Top 40, priority=10)
3. `top_5y` (popular Top 100, priority=20)
4. `top_all` (historical popular Top 200, priority=30)
5. `backfill` (quarterly rollback gap-fill, priority=90, starts only when 1-4 are saturated)

> Note: Jikan `top` endpoint does not provide strict "past 1 year/past 5 years" filters; current implementation approximates strategy via "tiered quantity gradient (40/100/200) + priority." Strict year-window policy can be added later via secondary labeling from mirrored `aired.from`.

#### 3.9.5 Data Freshness (TTL)
By tier:
- `seasonal`: 7 days
- `top_1y` (Top40): 30 days
- `top_5y` (Top100): 60 days
- `top_all` (Top200): 180 days
- `backfill`: 60 days

#### 3.9.6 Read-Path Adaptation (Mirror-first)
`AnimeMetaService.getOrFetchByMalId()`:
- Prefer fresh data from `AnimeMirror`; if hit, directly materialize into `AnimeMeta`
- Fetch Jikan on miss (and passively enqueue general tier for Bee background completion)

#### 3.9.7 Environment Variables (Dev-Specific)
- `SYNC_ENABLED=true`: enable Bee silent sync and startup seed
- `JIKAN_USER_AGENT=...`: optional override for default UA (contact email recommended)

#### 3.9.8 Resumable Crawl State (BeeState)
To support resumable quarterly rollback gap-fill, backend adds `BeeState` (key-value) to persist rollback cursor (previous quarter/year), resuming from last checkpoint after restart.

#### 3.9.9 Seed Retry (Resilience to 429/Network Jitter)
To avoid partial tier seeding due to 429 or network errors at startup, Cron retries low-frequency seeding (e.g., every 30 minutes). All operations are upsert + `$setOnInsert`, so duplicates are not created.

#### 3.9.10 429 Rate-Limit Runbook
When logs show `status=429 code=UPSTREAM_RATE_LIMIT`:
1. Check current progress snapshot: `GET /api/bee/status`
2. Focus on:
   - `tiers.top_5y.total` / `tiers.top_all.total`: whether seeded into queue (0 means not seeded)
   - `backoffUntil`: backoff timestamp (do not trigger seed before this time)
3. After `backoffUntil`, manually trigger one lightweight seed:
   - `POST /api/bee/seed-step`
4. After successful seeding, expect `top_5y.total=100`, `top_all.total=200`; subsequent tick logs should show sync records like `top_5y=3` / `top_all=3`.

#### 3.9.11 Bangumi Mapping and Subject Enrich (Timetable Data Chain)

> Goal: find **Bangumi entries** for seasonal `AnimeMirror` items, writing **`bgmId` + broadcast weekday + (best-effort) broadcast time**, and optionally fetching subject details.

- **Entry point**: `tryBangumiMapSeasonal()` inside Bee service (triggered periodically by Cron): flatten Bangumi `/calendar`, fuzzily match against Jikan titles, then upsert **`ApiMapping(malId, bgmId)`** and update mirror `titles` / `bangumi.weekday` / `bangumi.airTime`.
- **Enrich**: `enrichBangumiSubject(malId, bgmId)` fetches Bangumi v0 subject and merges `summaryCn`, `air_weekday`, `time`/`air_time`, etc.; before writing `airTime`, apply **`normalizeBangumiWallClock`** (compatibility such as `2330` -> `23:30`).
- **Relation with §3.8.6**: timetable API **consumes** `bangumi.*` + Jikan **`data`** in mirror; **weekday** can be inferred from Bangumi or Jikan broadcast fields; **clock time** still depends on upstream fields such as `bangumi.airTime` / `airDate` / `broadcast`, and remains empty if absent (frontend **TBD**). Unmatched Bangumi entries may still appear via Jikan weekday, but with **`bgmId=0`** and no Chinese-summary chain.

#### 3.9.12 Bee Ops POST Endpoints (Written to `swagger.json`, 2026-05-21)

| Method | Path | Purpose |
|------|------|------|
| **POST** | `/api/bee/seed-step` | Lightweight seeding retry step -> returns `BeeProgressSnapshot` |
| **POST** | `/api/bee/sync-step` | Manual sync batch (`batchSize` 1-10; optional `refreshSeasonalAirTimes` / `airTimeRefreshLimit`) -> `BeeSyncStepResponse` |
| **POST** | `/api/bee/bangumi-map` | Manually trigger Bangumi title mapping -> `BeeBangumiMappingSnapshot` |
| **POST** | `/api/bee/map-mal-ids` | On-demand mapping for legacy watchlist items (query `malIds=38000,8861`) -> `{ attempted, mapped }`; internally uses Bangumi v0 **POST** `search/subjects` |

> **Contract smoke**: `anitrack-tester/contract-validator` now probes according to OpenAPI-declared HTTP methods (no longer wrongly sending GET to POST-only paths). Bee POST may return **429** (Jikan/Bangumi limiting), recorded as **warning** rather than failure in smoke.

> **Watchlist Chinese titles (not a new HTTP route)**: list read path for `GET /api/anime` triggers background mapping for up to 8 missing-`titleCn` `malId` values before response returns (non-blocking); terminal log prefix is **`[i18n-map]`**.

- **Query**
  - `batchSize` (optional): Jikan mirror sync batch size for current execution; default `3`, max `10`
  - `refreshSeasonalAirTimes` (optional): when `true` / `1`, before sync run, call **`enrichBangumiSubject`** on up to **`airTimeRefreshLimit`** documents where **`tier=seasonal` and mapped `bgmId` exists**, to fix **`bangumi.airTime` / `weekday` / `airDate`**
  - `airTimeRefreshLimit` (optional): used with previous flag, default `50`, max `200`
- **200 Response**: same snapshot structure as `GET /api/bee/status` by default; if refresh executed, response additionally includes **`seasonalAirTimeRefresh: { attempted, refreshed, errors }`**

---

### 3.10 Multi-User Scalability Notes (Future Migration to Personal Blog)

> Current repository focuses on **single-user / no-auth** for easier course delivery; constraints below reduce schema refactoring when introducing **`userId` isolation** later.

- **Data isolation**: `AnimeEntry` (and future user-level `AnimeMeta` preferences, if any) should use **`userId: ObjectId`** (or stable FK like `sub` / `email`) with business fields in **compound unique indexes**, e.g., **`(userId, malId)` unique**. The first stage of all list and heatmap **Aggregation Pipeline** must include **`$match` with `userId`**.
- **Authentication layer**: validate **Session / JWT** in Next.js Route Handlers or Middleware; inject `userId` into request context; **forbid** unvalidated client-provided `userId`.
- **OpenAPI**: extend `securitySchemes` (e.g., `bearerAuth`); current single-user routes can be marked `optional` or retain **dev-only** default user.
- **Migration path**: add nullable `userId` + backfill default user first -> enforce non-null -> remove global-shared code path; **Contract Testing** should add "cross-user unreadable" test cases.

---

### 3.11 NestJS Backend Migration (Next.js -> NestJS, Architecture Translation)

> Goal: migrate backend from Next.js Route Handlers to NestJS **without changing any API field names**, preserving business rules (state machine, completion date maintenance, heatmap aggregation) and contract test consistency.

#### Directory and Port Conventions

- `anitrack/`: Next.js frontend (port `3000`)
- `anitrack/anitrack-backend/`: NestJS backend (port `3001`, global prefix `/api`, Swagger UI `/api-docs`, OpenAPI JSON `/swagger.json`)

#### Layered Architecture (Controller / Service / Repository)

- **Controller**: only handles routing and DTO validation, keeping paths `GET/POST /api/anime`, `GET/PATCH/DELETE /api/anime/:id`, `GET /api/stats/heatmap`
- **Service (business core)**: state-machine transition validation, auto-maintenance of `completedAt/completedDates` on `COMPLETED`, and heatmap logic
- **Repository (Mongoose Model)**: inject `AnimeEntry` model via `@nestjs/mongoose`; keep indexes (e.g., `malId unique`) aligned

#### Compatibility Constraints (Must Keep)

- **Error envelope**: all errors return `{ "error": { "code", "message", "details" } }`
- **State machine**: follow §5.1 allowed edges (invalid transitions return `409 INVALID_STATUS_TRANSITION`)
- **Heatmap aggregation**: keep `$unwind` + normalization (`$dateToString` / `$toString` + `$trim`) for compatibility with historical mixed `Date/string` storage

---

## 4. MongoDB Data Model (Schema Design)

> Goal: support both watchlist CRUD and heatmap date-dimension aggregation, while remaining test-friendly and aggregation-friendly.

### 4.1 `User` (Optional; can be skipped if login not required by course)
- `_id`
- `email` (unique)
- `passwordHash` (if auth is implemented)
- `createdAt` / `updatedAt`

### 4.2 `AnimeEntry` (User-Private Watchlist Main Table)

Suggested fields (expressed in Mongoose/TypeScript style):
- `_id`: ObjectId
- `userId`: string (phase 3 placeholder `TEMP_USER_ID`; migrate in phase 4 to real user id parsed from token)
- `malId`: number (from Jikan / MyAnimeList)
- `status`: enum
- `rating`: number (optional)
- `episodesWatched`: number (optional; for progress management like "watched x / total y episodes")
- `notes`: string (optional)
- `startedAt`: string(`YYYY-MM-DD`) (optional)
- `completedAt`: string(`YYYY-MM-DD`) (optional)
- `completedDates`: string[](`YYYY-MM-DD`) (for completion-date trails, and possible historical day-level stats; current monthly aggregation mainly uses `completedAt`)
- `createdAt` / `updatedAt`

> **Ownership constraint**: `AnimeEntry` must not contain objective anime fields like `title/imageUrl/score/episodes`; those belong to `AnimeMeta`.

#### Why `completedDates` is needed
- Minimal mode: record one completion date per finished anime for contribution counting.
- Extensible mode: future "episode completion" can record multiple dates (including multiple completions on same day via count accumulation).

#### Index Suggestions
- `(userId, malId)` unique (prevent duplicate collection)
- `(userId, status)`
- `(userId, updatedAt)` (list sorting)
- `completedDates` (multikey index) for range query/aggregation (implementation-dependent)

### 4.3 `AnimeMeta` (Public Anime Metadata Cache / Shadow Store)

- `_id`: ObjectId
- `malId`: number (globally unique)
- `title`: string
- `imageUrl`: string (optional)
- `episodes`: number (optional)
- `totalEpisodes`: number (optional; preferred field, while `episodes` remains legacy-compatible)
- `score`: number (optional)
- `synopsis`: string (optional; may be long)
- `genres`: string[] (optional; normalized from Jikan genres object array to string array for frontend tag rendering)
- `createdAt` / `updatedAt`

#### Relation
- `AnimeEntry.malId` -> `AnimeMeta.malId` (joined by `malId`; nested `animeMeta` in list/detail responses)

### 4.4 Dual-Table Joined Response Logic (`AnimeMeta` <-> `AnimeEntry`)

> Goal: keep `AnimeEntry` as "user-private progress" and `AnimeMeta` as "public metadata cache", while returning frontend-friendly payloads (`animeMeta` already nested).

- **Responsibility split**:
  - **`AnimeMeta`**: global unique key `malId`; stores objective metadata such as title/cover/episodes/score (fetchable and cacheable from Jikan).
  - **`AnimeEntry`**: unique by `userId + malId`; stores user-private progress such as status/rating/notes/completion dates.
- **Join key**: `AnimeEntry.malId` <-> `AnimeMeta.malId` (join by `malId`)
- **Read path (list/detail)** (text flow):
  - `GET /api/anime` / `GET /api/anime/:id`
  - Query `AnimeEntry` (filtered by `userId`) to get entries
  - Extract `malId[]` from entries
  - Query `AnimeMeta` (`malId in [...]`)
  - Assemble response: inject `animeMeta` into each entry (if miss, may be `null` or trigger backend refill; implementation-specific)
- **Write path (create)** (Cache-Aside flow):
  - `POST /api/anime` (client sends only `malId` + private fields)
  - Read/write `AnimeMeta(malId)` first (fetch from external source on miss and cache)
  - Write `AnimeEntry(userId, malId, ...)`
  - Return `AnimeEntry` with nested `animeMeta`

---

## 5. Backend Business-Logic Layering (Strictly Backend)

### 5.1 State-Machine Transition Validation (Backend)
Define allowed status transitions (example, adjustable in final implementation):
- `PLANNED` -> `WATCHING|ON_HOLD|DROPPED|COMPLETED`
- `WATCHING` -> `ON_HOLD|DROPPED|COMPLETED`
- `ON_HOLD` -> `WATCHING|DROPPED|COMPLETED`
- `DROPPED` -> `PLANNED` (optional reopen) / `WATCHING` (optional)
- `COMPLETED` -> `WATCHING` (re-watch, optional) / others (usually forbidden)

Backend responsibilities:
- Reject invalid transitions (return 409 or 400)
- Auto-maintain `completedAt/completedDates` when `status` becomes `COMPLETED`

### 5.2 Heatmap Aggregation and Intensity Calculation (Backend)
Endpoint: `GET /api/stats/heatmap`

Backend must:
- Read entries in `AnimeEntry` with `status=COMPLETED`
- Extract and aggregate current signals:
  - `addedCount`: count by month of `createdAt`
  - `completedCount`: count by month of `completedAt` (`status=COMPLETED`)
  - `episodeCount`: sum `episodesWatched` by month of `completedAt`
- Aggregate monthly into life-grid output: return `months[]`, each with `addedCount/completedCount/episodeCount/intensity`

#### Recommended Intensity Threshold Strategy (Adjustable)
To fit different user data scales, use a simple and interpretable "fixed thresholds + cap":
- `count = 0` -> 0
- `count = 1` -> 1
- `count = 2` -> 2
- `count = 3-4` -> 3
- `count >= 5` -> 4

> Pros: easy to explain and stable.  
> Cons: heavy users may saturate at 4.  
> Alternative: quantile-based dynamic thresholds (more adaptive but harder to explain/test precisely).

---

## 6. Testing Strategy (Test Cases)

> Tooling constraint: backend is based on Next.js App Router API routes; tests use Vitest.  
> Goal: cover both Integration Tests and Unit Tests (course requirement).

### 6.1 Integration Tests: `/api/stats/heatmap`

#### Case A: Empty Data (Monthly)
- **Given**: user has no entries (or no completed/episode contribution)
- **When**: request `GET /api/stats/heatmap?start=2026-01&end=2026-03`
- **Then**:
  - status code **200**
  - response includes `start/end/months`
  - `months` covers all months in range (including 2026-01/02/03)
  - each month has `addedCount/completedCount/episodeCount` = 0, `intensity=0`

#### Case B: Multiple Data Points (Monthly Aggregation)
- **Given**:
  - multiple entries distributed across months; `COMPLETED` entries include `completedAt` and `episodesWatched`
- **When**: request a range covering these months
- **Then**:
  - status code **200**
  - `completedCount` and `episodeCount` aggregate correctly for each month
  - `intensity` maps correctly by threshold (weighted by `addedCount+completedCount`)

#### Case C: Parameter Validation (Optional Bonus)
- **Given**: `start > end` or invalid month format
- **When**: request heatmap
- **Then**: status code **400**, error shape matches generic error body

### 6.2 Unit Tests: Pure Function for Heatmap Intensity Mapping
- `count=0 -> 0`
- `count=1 -> 1`
- `count=2 -> 2`
- `count=3 -> 3`
- `count=4 -> 3` (if 3-4 -> 3 is used)
- `count=5 -> 4`
- invalid input (negative/NaN) -> throw or clamp to zero (implementation-defined, but must be consistent and tested)

---

## 6.3 Test Navigation (Troubleshooting Toolbox)

> Purpose: when frontend-backend integration/database/contract/third-party API issues occur, know **which tests to run first, where to inspect results, and how to localize problems**.

### 6.3.1 Recommended Quick Troubleshooting Order

- **Is API alive (baseline)**: can backend Swagger be opened?
  - `http://localhost:3001/api-docs`
  - `http://localhost:3001/swagger.json`
- **Backend self-check (without external Jikan)**: run NestJS e2e/smoke (mocks `AnimeMetaService`, can use in-memory Mongo)
  - suitable for: error envelope, state machine, heatmap schema, CRUD baseline chain
- **Frontend-side algorithm/integration (legacy from Next.js route-handler era)**: Vitest (heatmapCalc unit + heatmap integration)
  - suitable for: heatmap pure-function alignment with swagger schema, Mongo connect/cleanup logic
- **Contract regression (Swagger vs runtime)**: `anitrack-tester/contract-validator`
  - suitable for: missing paths/field mismatches/error envelope/code mismatch/pagination drift
- **End-to-end smoke (HTTP layer)**: `anitrack-tester/api-test-suite/run-all.js`
  - suitable for: full HTTP loop of create -> update -> conflict -> completion-date side effects -> delete

### 6.3.2 Backend Tests (NestJS / Jest)

Directory: `anitrack/anitrack-backend/`

- **Unit/integration (Jest)**
  - `npm test`
- **e2e and smoke**
  - `test/app.e2e-spec.ts`: minimal e2e (`GET /api`)
  - `test/app.smoke-spec.ts`: covers heatmap, state machine, CRUD (mock `AnimeMetaService`; uses `mongodb-memory-server` when `MONGODB_URI` is absent)

### 6.3.3 Frontend Tests (Next.js / Vitest)

Directory: `anitrack/`

- **Unit tests**: `npm test`
  - e.g., `src/lib/__tests__/heatmap-calc.test.ts` (intensity mapping, week structure)
- **Integration tests**: `npm run test:integration`
  - e.g., `src/__tests__/integration/heatmap.integration.test.ts`
  - note: requires real `MONGODB_URI` (auto-loaded from `anitrack/.env.local` by `vitest.integration.config.ts`)

### 6.3.4 Contract Tests (Contract Validator)

Directory: `anitrack-tester/contract-validator/`

- **One-command run (schema + HTTP smoke)**: `npm run contract` (or `node run-contract-test.js`)
- **Environment variables**
  - `BASE_URL` (default `http://localhost:3001/api`, used to infer `origin`)
  - `CONTRACT_ORIGIN` (override root site, e.g., `http://localhost:3001`)
  - `CONTRACT_SWAGGER_URL` (override swagger.json URL)
  - `CONTRACT_PENDING_PATHS` (comma-separated; allows temporarily unimplemented paths downgraded to warning)

### 6.3.5 HTTP Smoke Scripts (API Test Suite)

Directory: `anitrack-tester/api-test-suite/`

- **One-command full run (smoke + batch)**: `node run-all.js`
- **Seed heatmap data**: `node heatmap-seeder.js`
- **Environment variables**
  - `BASE_URL` (default `http://localhost:3000/api` for historical reasons; for direct NestJS, recommend `http://localhost:3001/api`)

---

## 7. Responsive UI Guidelines (Breakpoints & Layout)

> Goal: mobile must be usable; desktop should provide higher information density; heatmap should be horizontally scrollable on narrow screens.

### 7.1 Recommended Breakpoints (Tailwind Defaults)
- `sm`: >= 640px
- `md`: >= 768px
- `lg`: >= 1024px

### 7.2 Page Layout Behavior (Main Screens)

#### Mobile (< md)
- Layout: vertical stack
  - Top: Heatmap (horizontal scroll enabled)
  - Bottom: Watchlist (grouped by status or tab switching)
  - Schedule can be a standalone page or collapsible block

#### Desktop (>= md)
- Layout: two-column or three-region
  - Left: Watchlist (list/grouped)
  - Right top: Heatmap (persistently visible)
  - Right bottom: Seasonal Schedule (table/cards)

#### Dashboard (`/`) - Seasonal Recommendation
- "Seasonal random recommendation": **card is clickable** to open **`SeasonalPickDetailDialog`** (cover, score, episode count, genres, HTML-stripped synopsis, **add to watchlist PLANNED**); keep in-list quick "Add to watchlist" button; close dialog and refresh watchlist cache after successful insert.

#### Timetable (Schedule Page)
- Form: horizontally scrollable date columns (one day per column in Berlin calendar date); columns align with **`items-start`**, and render **all** API-returned entries (no "max N per column" truncation); items sorted by `airTimeLocal` string.
- Data: `GET /api/anime-meta/timetable` (see **§3.8.6**); show **TBD** at left if local time missing; missing Bangumi mapping may have **`bgmId=0`** (see **§1.2**, **§10.5**).
- Interaction: 7/14-day switch, horizontal scroll arrows, **click card** -> detail dialog (MAL / Bangumi ID, Synopsis, `POST /api/anime` follow action or open edit dialog for existing entry).

### 7.3 Heatmap Component Rules
- Cell: square (e.g., 10-14px), spacing 2px
- Color: 5-level green scale mapped from `intensity 0-4` (0 is gray/background)
- Narrow screens: container uses `overflow-x-auto`, preserving cell size

### 7.4 Schedule Component Rules
- Mobile: collapsible groups by weekday, card flow
- Desktop: table or multi-column grid, optimized for quick scanning

### 7.5 Site-wide I18n (UI Copy + Content Display Language, 2026-05-21)

> **Principle**: **shell UI language** (buttons/navigation/toast/empty states) is **decoupled** from **anime metadata display language** (title/synopsis). Language switch modifies frontend rendering and field priority only, and does **not** alter API enum values such as `AnimeEntry.status`.

#### 7.5.1 Frontend (Next.js)

| Module | Path / Responsibility |
|------|-------------|
| Message dictionaries | `anitrack/src/i18n/messages/zh.ts`, `en.ts` |
| Runtime | `I18nProvider` + `useI18n().t(key, params)`; mounted at root `app/providers.tsx` |
| Switcher | `TopNav` -> `LanguageSwitcher`; preference in **`localStorage`** key `anitrack.locale` (`zh` \| `en`), also sets `document.documentElement.lang` |
| Anime title/synopsis display | `anime-display.ts`: `pickAnimeTitle` / `pickAnimeSynopsis`; component side uses `useAnimeDisplay()` |

**`pickAnimeTitle` priority (brief)**

- UI = **zh**: `titleCn` -> `title` -> `titleJp` -> `titleEn`
- UI = **en**: `titleEn` -> `title` -> `titleJp` -> `titleCn`

Synopsis follows similar logic: prioritize `synopsisCn` (Bangumi) vs `synopsisEn` / `synopsisJa` (Jikan categories) by UI language.

> `next-intl` route-level locale is not introduced to avoid altering current App Router structure; if `/en/library` is needed later, evolve from current base.

#### 7.5.2 Backend (NestJS, Read-path Enhancement)

- **Data sources**: Jikan (`AnimeMeta` / mirror `data`) + Bangumi mapping (`AnimeMirror.titles`, `bangumi.summaryCn`).
- **`AnimeMetaService.attachMirrorI18n`**: merges `titleCn` / `titleJp` / `titleEn` / `synopsisCn` into responses of **`findByMalIds`**, **`getOrFetchByMalId`**, **`randomSeasonalFromMirror`**, **`getTimetable`** (prioritize persisted DB fields, then merge from `AnimeMirror.titles` / `bangumi.summaryCn`).
- **Legacy watchlist mapping**: `BeeService.ensureBangumiMappingForMalId` -> Bangumi v0 **POST** `/search/subjects` (not GET); on success writes **`AnimeMeta.titleCn`** etc. Ops endpoint: `POST /api/bee/map-mal-ids`; daily behavior relies on background batches in list read path + page refresh.
- **Search `GET /api/anime-meta/search`**: still based on real-time Jikan results and may **not** include Bangumi Chinese names (unless that `malId` already has mirror mapping).

---

## 8. Implementation Roadmap (Coding Phase: 3 Stages)

### Stage 1 (Backend Foundation)
> Following Anitrack architecture design, create backend API routes via Next.js App Router. Implement MongoDB connection logic and define CRUD endpoints for `/api/anime`, ensuring fields follow OpenAPI specifications.

**Deliverables**
- Next.js App Router project skeleton
- MongoDB connection (reusable, testable)
- `/api/anime`:
  - `GET` list
  - `POST` create
  - `GET/PATCH/DELETE /{id}`
- Initial OpenAPI (at minimum anime + heatmap coverage)

### Stage 2 (Logic & Testing) - **Completed (Current Repository State)**
> Current backend provides `/api/stats/heatmap`: monthly aggregation output (`{ start,end,months[] }`) as life grid; old implementation/tests are kept only as historical reference.

**Deliverables (Aligned)**
- Heatmap aggregation logic (pure functions + pipeline; **mixed `Date`/`string` storage fix**)
- `GET /api/stats/heatmap` route
- Vitest: heatmap **integration** + **unit** (intensity mapping and week structure)

### Stage 3 (Frontend Rendering) - **Course Core Path: Completed**
> Planned modules including **Jikan relay/cache (`AnimeMeta`)**, **multi-page main UI**, and **Watchlist / Heatmap / Dashboard seasonal recommendation / Timetable** are all implemented. Future changes focus on **UX optimization and optional features** (see **§10.5**), not course-delivery blockers.

> Main pages: Dashboard / Library / Profile; heatmap is **monthly life grid**; component renders colors based on API **`intensity` 0-4**, with narrow-screen **`overflow-x-auto`** scrolling.

**Deliverables (Aligned with Repository)**
- [x] Frontend API foundation: unified `fetcher`, default direct backend `http://localhost:3001/api`
- [x] Jikan search relay: `GET /api/anime-meta/search?q=...` (writes into `AnimeMeta`)
- [x] Prototype closed loop: search -> add (`POST /api/anime { malId }`) -> refresh watchlist (`GET /api/anime`)
- [x] Desktop-finished style (prototype page): 4-column watchlist card grid, cover placeholders, status color badges, compact search result cards
- [x] Real page/component split (`/` Dashboard, `/library`, `/profile`), with watchlist edit/delete/status transition (Dialog)
- [x] Heatmap: Profile upgraded from "past-year daily calendar grid" to "monthly life grid" (12 months per row); backend output upgraded to `{ start,end,months[] }` (added/completed/episodes + intensity)
- [x] Dashboard seasonal recommendation: `GET /api/anime-meta/seasonal-random` (`AnimeMirror` / `$sample`, see **§3.8.5**) + frontend refresh batch / add to watchlist (Sonner) + **`SeasonalPickDetailDialog`** (click for details)
- [x] Seasonal timetable: `/timetable` + `GET /api/anime-meta/timetable` (Bangumi weekday + mirrored data); **broadcast-time TBD issue deferred** (see **§1.2**)
- [x] **Site-wide bilingual support**: zh/en UI copy switch + title/synopsis displayed by UI language (see **§7.5**, `TASK_PROGRESS.md` §4.9)
- [ ] Standalone Seasonal Schedule page (if pure Jikan schedule view is still desired, can be optional stage 6 and coexist/replace current Bangumi-driven timetable)

---

## 11. Course Requirements and Anitrack Mapping (For Defense, 2026-05-28)

> **Course compliance (one sentence)**: Anitrack already satisfies all required **content requirements** in code and repository form; **organizational requirements** (about 7 minutes per person, role explanation, presentation + live demo) must be completed on defense day using `Project_Intro` materials.

> Original course text (German + Chinese): **`Project_Intro/项目要求.md`**  
> Defense checklist: **`Project_Intro/答辩清单.md`** · PPT outline: **`演讲大纲.md`** · Script: **`PPT文字稿大纲.md`**

| Course Requirement | Anitrack Implementation |
|----------|----------------|
| Backend framework **NestJS** | `anitrack-backend/` (NestJS 11) |
| Backend: business logic + persistence | State machine, heatmap aggregation, Bee; MongoDB |
| HTTP API, CRUD | `/api/anime` GET/POST/PATCH/DELETE |
| **API first** | `swagger.json` + `/api-docs`; contract testing |
| API for frontend + script clients | Next.js `fetcher`; `anitrack-tester` |
| Integration tests (API) | Jest e2e/smoke; Vitest integration; contract-validator |
| Unit tests (business logic) | `heatmap-calc`; Jest unit tests |
| Frontend: minimal business logic | statistics/validation in backend; frontend for rendering + forms |
| Responsive design | §7, `TASK_PROGRESS.md` §4.11 |
| Presentation ~7 min/person, role split | role split written on PPT page 2 (`Project_Intro/演讲大纲.md`); `.pptx` pending |

**Swagger**: maintained in `anitrack-backend/swagger.json` (English description); showing Swagger UI in defense is sufficient, no need to rewrite a full API manual.

**Visuals (slides)**: `anitrack-visuals/figures/*.png` (English).

---

## 9. Notes (Scratchpad)

- **Auth**: keep single-user + `TEMP_USER_ID` if course does not require auth; multi-user plan in **§3.10**. This is **nice-to-have**, not a current blocker.
- **Jikan**: **backend relay + §3.8 Cache-Aside (`AnimeMeta`)** and **Bee mirror** are implemented; direct call remains miss-path only.
- OpenAPI: repository **`anitrack-backend/swagger.json`** is loaded on Nest startup; browser **`http://localhost:3001/api-docs`**; contract smoke sends requests to **every declared method** in `paths` (including Bee **POST**, see **§3.9.12**). Long-term optional path: one-way generation via **zod-to-openapi** etc.
- **Final exam topic · Promise and Bootstrap (repository status)**:
  - **Bootstrap (application startup)**: yes. In `anitrack-backend/src/main.ts`, **`async function bootstrap()`** -> `NestFactory.create` -> global pipes/filters -> load `swagger.json` -> `listen`. This is **not** the frontend CSS framework Bootstrap (not used in this repository).
  - **Promise / async-await**: yes, across full stack. Examples: frontend `lib/api.ts` `fetcher`; React Query `queryFn`; backend Bee `Promise.all` parallel `countDocuments`; `new Promise` + `setTimeout` for polite backoff. See **`TASK_PROGRESS.md` §4.10**.
  - **If explicit demonstration is desired (optional increment)**: use `Promise.all` in Dashboard for `getStatsSummary` + `getAnimeEntries`; or add frontend startup health check `Promise.all([fetch('/api'), fetch('/api/bee/status')])`.
- **Site-wide UI language (zh/en)**: implemented, see **§7.5**; shell copy and anime-display language are decoupled.
- **Timetable**: behavior under data-gap and dual-source mismatch is documented in **§1.2**, **§10.5**.

---

## 10. Implementation Progress Snapshot (Repo-Synced, **2026-05-28: defense scripts + visuals + blueprint sync**; **2026-05-21: Swagger / i18n / responsive**; **2026-05-14: core delivery closed-loop**)

| Dimension | Status |
|------|------|
| Course **content** requirements (NestJS, CRUD, API-first, testing, thin frontend, responsive) | **Satisfied** |
| Core features (Watchlist, statistics/heatmap, Bee, Dashboard/Library/Profile/Timetable) | **Delivered** |
| Defense **organization** requirements (7 min/person, role split, live demo) | **To complete on defense day** |
| Defense materials (outline/script/checklist/visuals) | **Ready** |
| Defense materials (`.pptx`, English screenshots, rehearsal) | **Pending** |

Conclusions below are based on **real HTTP requests + DB read/write** (`anitrack-tester/api-test-suite/run-all.js`), **repository Vitest** (`npm test` / `npm run test:integration`), and **Contract Testing** (`anitrack-tester/contract-validator/run-contract-test.js`, **strict mode** with empty `CONTRACT_PENDING_PATHS`).

### 10.1 Scope Considered "Established" (Stage 1 + Stage 2)

- **MongoDB integration**: `MONGODB_URI` in `anitrack/.env.local` (Atlas); connection, **Aggregation Pipeline**, and writes work in both development and integration tests.
- **`/api/anime` contract and behavior**:
  - CRUD and paginated list conform to Chapter 3 draft, with additional `totalPages` for direct frontend paginator rendering.
  - Supports sort whitelist (`updatedAt/createdAt/rating`).
  - **State machine**: invalid transitions return **409**, with `error.code` as **`INVALID_STATUS_TRANSITION`**.
  - **`COMPLETED` side effects**: `completedDates` auto-maintained as **`YYYY-MM-DD`**; `DELETE` returns **204**.
- **`GET /api/stats/heatmap`**: current output `{ start,end,months[] }` (aggregated by `userId`: added=`createdAt`; completed/episodes=`completedAt + episodesWatched`) for monthly life grid; supports `start/end=YYYY-MM`.
- **OpenAPI / Swagger UI (main API)**: **`http://localhost:3001/swagger.json`** + **`http://localhost:3001/api-docs`** (Nest loads `anitrack-backend/swagger.json`), with **Try it out** directly against Nest. Frontend entry remains **`http://localhost:3000/`**; if `public/swagger.json` exists, it is historical reference only and **must not be confused with 3001 contract**.
- **Contract Testing**: **AJV** (OpenAPI 3.0 meta-schema) + **SwaggerParser** + HTTP smoke; strict mode is **all green**, implementation and contract are consistent.
- **Vitest**: `heatmapCalc` unit tests + heatmap **integration test** (real Mongo, inserts **COMPLETED** entries and asserts **count > 0**).
- **Data seeding**: `api-test-suite/heatmap-seeder.js` reliably appends around 20 **COMPLETED** entries (without clearing DB), suitable for intensity 0-4 integration checks.

### 10.2 Incremental Focus (Non-mandatory for Course: UX and Data Completeness)

- **Jikan/search**: `GET /api/anime-meta/search` is paginated; `AnimeMeta` already includes `synopsis/genres/totalEpisodes`.
- **Timetable**: real data + Jikan weekday fallback is online; **TBD / missing-column** issues still depend on upstream data and mapping rate (§1.2).
- **Frontend**: Dashboard / Library / Profile / Timetable are integrated; **site-wide i18n (§7.5) is online**; auth, recommendation algorithms, pure Jikan schedule secondary view remain optional (see **§10.5**).

### 10.3 Implementation Notes (Avoid Repeating Pitfalls)

- **`PATCH` and Zod defaults**: parsing `AnimeEntryPatch` may default `completedDates` to empty array; route-layer detection of "whether completion-date fields are touched" should inspect **whether raw JSON contains the key**, to avoid misclassifying "status-only update" as completion-field write.
- **Heatmap aggregation**: any **normalization** involving calendar strings and BSON `Date` must happen **before `$group`**, and **closed-interval `$match`** must apply to the **same normalized field**, otherwise silent empty results are likely.
- **Swagger (main API)**: backend `http://localhost:3001/api-docs`; OpenAPI JSON `http://localhost:3001/swagger.json`. Frontend development entry `http://localhost:3000/`.

### 10.4 Stage 4-5 Milestones (2026-04-29)

- **Multi-page architecture**: Next.js App Router split into `/` (Dashboard), `/library` (management), `/profile` (user center), with shared components like `TopNav/AppShell/AnimeCard/Pagination`.
- **Search UX evolution**: Jikan paginated search (backend passthrough + frontend paginator), debounce(500ms) auto-search, Enter triggers immediate search and resets to page 1.
- **Deep management**: Library uses a single global Dialog for details and edits (`status/rating/episodesWatched`), with cross-page sync via React Query `invalidateQueries(["anime"])`.
- **Meta enrichment**: `AnimeMeta` adds `synopsis/genres(string[])/totalEpisodes`; frontend limits displayed tags (default 3) to prevent overflow.

### 10.5 Course Core vs Nice-to-Have: Not Developed / Recommended / Recommended to Drop (2026-05-14)

> **Conclusion (repository-aligned)**: all **initially expected usable functions** at project start (Watchlist CRUD, statistics and heatmap, Jikan search and metadata cache, Bee mirror, Dashboard, Library, Profile, seasonal recommendation, Bangumi-driven timetable + Jikan weekday fallback, contract and test baseline) are **already in place**. The following are **non-mandatory deliveries**; prioritize by effort-to-value.

| Type | Content |
|------|------|
| **Not yet developed (optional)** | **Login and multi-user isolation** (§3.10); **personalized recommendation** (weighted/daily recommendation based on `AnimeEntry`) |
| **Recommended (nice-to-have, high ROI)** | small **UI consistency** refinements (spacing/empty states); **footer and troubleshooting copy** (Bangumi unmapped / TBD); **URL-level locale**; **defense PPT/scripts** (`Project_Intro/`) |
| **Completed (defense visuals)** | **`anitrack-visuals/figures/`** — tech-stack / architecture / user-flow / data-flow (**English labels**, see `TASK_PROGRESS.md` §12) |
| **Recommended to drop or long-term defer (low ROI or duplicate with current path)** | timetable "zero TBD / full mapping" data campaign (same class as known gaps in §1.2: impossible to guarantee 100% without stable free source); parallel maintenance of "pure Jikan `/schedule` weekly view + new page"; pursuing 100% non-TBD broadcast times; premature full zod-to-openapi generation |
| **Keep as-is** | single-user + `TEMP_USER_ID`; timetable **Europe/Berlin**, **+-2 week date bars** (`pastDays`/`futureDays`); Bee **65s/3 items**; title display prioritized by UI language (§7.5); **responsive layout complete** (`TASK_PROGRESS.md` §4.11) |


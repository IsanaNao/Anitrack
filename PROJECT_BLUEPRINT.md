# Anitrack — Project Blueprint（项目全景总结）

> 本文档是 Anitrack 的“设计与实现总纲 / 杂项笔记入口”。内容允许很杂、持续追加。  
> 课程目标导向：**API-First、前后端解耦、逻辑在后端、可测试、响应式 UI**。

> **项目状态（2026-06-07）**：**课程内容要求已在代码库闭环**；答辩侧文案与图示已就绪（`Project_Intro/`、`anitrack-visuals/`），**待** `.pptx`、英文截图与现场排练。进度细节见 **`TASK_PROGRESS.md` §0**。

---

## 0. 项目概览

- **项目名称**：Anitrack（Personal Anime Watchlist & Analytics）
- **核心目标**：开发一个符合 Web-Technologies I 课程要求的全栈 Web 应用，重点展示：
  - **API-First**：后端 API 可独立运行，能被脚本客户端调用
  - **前后端解耦**：前端只渲染与交互，后端提供稳定数据契约
  - **业务逻辑封装**：统计计算、状态机校验等逻辑严格在后端
  - **响应式 UI**：移动端与桌面端体验一致且合理
- **运行时端口（Truth）**：
  - **Backend**：NestJS（`http://localhost:3001`，API Base：`/api`，Swagger UI：`/api-docs`）
  - **Frontend**：Next.js（`http://localhost:3000`）

---

## 1. 核心功能（MVP → 可扩展）

### 1.1 Watchlist CRUD（核心）
围绕番剧条目状态做增删改查。

- **状态**（枚举）：
  - `PLANNED`（想看）
  - `WATCHING`（在看）
  - `ON_HOLD`（搁置）
  - `DROPPED`（抛弃）
  - `COMPLETED`（已看过）
- **核心能力**：
  - 创建条目（前端仅提交 `malId`；后端通过影子库缓存拉取元数据）
  - 更新条目（尤其是状态变更、完成日期记录）
  - 删除条目
  - 列表查询（按状态筛选、分页/排序）

### 1.2 Seasonal Schedule / 新番时间表（集成外部数据）
现行实现以 **Bee `AnimeMirror`（当季 Jikan 镜像）** 为主，**Bangumi 映射优先**、**Jikan `broadcast` 为星期与钟点兜底**；不单独依赖 Jikan 的 schedule 端点。

- **后端**：`GET /api/anime-meta/timetable?pastDays=14&futureDays=14`（兼容旧 `days=` 仅向未来）— 当季 `tier=seasonal` 镜像；**分桶星期**优先 `bangumi.weekday`，缺失时回退 **`broadcast.day` / `broadcast.string`**（与 Bangumi 同为 1=周一…7=周日）；东京墙钟经 **`dayjs`（`Asia/Tokyo`）→ `Europe/Berlin`** 落到各**柏林日历日**列（详见 **§3.8.6**）。未映射 Bangumi 时响应中 **`bgmId` 可为 `0`**，详情区不展示 Bangumi 链。
- **前端**：`/timetable` — **多列横向滚动**（固定列宽约 200px，参考 animeko）；每列为一天，列内 **全量渲染** API 返回的 `items`；左右箭头导航、**今天列高亮**；**星期标签**由前端 `formatWeekdayBerlin(date, locale)` 按 UI 语言格式化（不依赖后端 `weekdayLabel`）。点击条目打开详情并可 **加入清单（PLANNED / WATCHING）** 或跳转已有条目的 `AnimeEntryDialog`；详情 Dialog **`z-50`**，避免被日期列头遮挡。
- **展示语言（时间表域）**：API 返回多语言快照（`title` / `titleCn` / `titleJp` / `titleEn`，`synopsisCn` / `synopsisEn` / `synopsisJa`）；**前端按 UI 语言选取主标题与简介**（见 **§7.5**），不再在时间表页写死英文优先。

> **暂缓（已知缺口）**：**部分番剧不出现在某一列**：Bangumi 标题未匹配则无 enrich；且若 Jikan **`broadcast.day` 为 Unknown** 且无 `bangumi.weekday`，则无法分桶。**播出钟点 TBD**（`airTimeLocal` 为空）：上游无可靠 `airTime`/时刻字段时仍会出现。已做 **`parseBangumiWallClockWithExtendedHours`**、`airDate` 含 `T` 时刻、`broadcast.time` 合并、**`POST /api/bee/sync-step?refreshSeasonalAirTimes=true`**、响应 **`airTime`** 与 F12 日志。**完整排钟与 100% 映射**依赖数据源或运营策略，属**锦上添花**，不阻塞课程核心交付（见 **§10.5**）。

### 1.3 Anime Heatmap（Highlight：绿墙）
基于用户追番行为，生成类似 GitHub contributions 的“人生纸格”（按月）。

- **坐标系**：纵轴 = 月份（Jan–Dec），横轴 = 年份（从起始年到当前年）
- **输入信号（后端聚合）**：
  - `addedCount`：当月加入清单的条目数（按 `createdAt` 月份）
  - `completedCount`：当月看完的条目数（按 `completedAt` 月份，`status=COMPLETED`）
  - `episodeCount`：当月累计观看集数（按 `completedAt` 月份累加 `episodesWatched`）
- **输出结构**：`months[]`（每月一个格子），包含 `intensity`（0–4）
- **交互（前端）**：
  - 悬停：GitHub 风格浮动 Tooltip（`pointer-events: none`；窄屏/底部格子 **智能上翻**，避免被容器裁切）
  - 点击：锁定月份，在热力图下方展示 “Activity for YYYY-MM”（Added/Completed 时间轴列表）
  - 起始月：`StartMonthPicker`（i18n 年/月下拉，替代 `<input type="month">` 的浏览器原生语言）
  - 桌面端格子 **16×16px**（间距 3px），年份标签 **防重叠** 绝对定位

### 1.4 Data Persistence（MongoDB）
使用 MongoDB 存储用户与个性化 watchlist、以及 heatmap 统计所需的日期维度数据。

---

## 2. 技术约束（课程对应）

### 2.1 API-First
- 后端以 **OpenAPI/Swagger** 明确契约（字段、状态码、错误结构）
- 前端只依赖 API（不得在前端复制统计/校验逻辑）
- API 可被脚本客户端调用（curl / node 脚本 / postman）

### 2.2 Logic Separation（逻辑在后端）
- 前端：渲染、表单收集、路由、状态管理（UI state），调用 API
- 后端：数据校验、状态机转换约束、统计计算、聚合逻辑、鉴权（若做）

### 2.3 Testing（必须包含）
- **Integration Tests**：针对 API 端点，验证：
  - HTTP 状态码
  - 响应结构（schema）
  - 数据持久化副作用（创建/更新后能查到）
- **Unit Tests**：针对核心算法/纯函数（例如 heatmap 强度等级计算）

### 2.4 Responsive（必须包含）
至少覆盖手机端与桌面端，并明确断点下布局策略（见第 7 章）。

---

## 3. OpenAPI / Swagger：核心 API 端点与结构（Draft）

> 说明：本节为契约草案；**运行时 OpenAPI 文档**由 Nest 在启动时加载 **`anitrack-backend/swagger.json`**（`main.ts` → `SwaggerModule.setup('api-docs', …)`），浏览器访问 **`http://localhost:3001/api-docs`**，JSON：**`http://localhost:3001/swagger.json`**。  
> **覆盖范围提示**：该文件当前**至少**包含 `GET/POST /api/anime`、`GET/PATCH/DELETE /api/anime/{id}`、`GET /api/stats/heatmap` 及若干 **GET** 发现类路径（Bee / `anime-meta`）；**仅 POST** 的端点（如 `POST /api/bee/sync-step`）若直接写入 `paths` 且未改契约冒烟逻辑，会导致 `contract-smoke-test` 对同一路径误发 **GET** 而失败，故可能仅写在 Blueprint 或 `@ApiOperation` 注释中。扩展契约时请同步 **`anitrack-tester/contract-validator`**。  
> API Base：`/api`

### 3.1 公共约定

#### 3.1.1 Content-Type
- 请求：`application/json`
- 响应：`application/json`

#### 3.1.2 通用错误结构

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

#### 3.1.3 通用分页结构（可选）

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
获取 watchlist 条目列表（支持按状态筛选、分页、排序）。

#### Query
- `status`（可选）：`PLANNED|WATCHING|ON_HOLD|DROPPED|COMPLETED`
- `page`（可选）：number，默认 1
- `pageSize`（可选）：number，默认 20
- `sort`（可选）：例如 `updatedAt:desc`（具体格式实现期再定）

#### 200 Response（分页）

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
创建 watchlist 条目。

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

#### 字段规则（后端强制）
- `malId`：number，同一用户下唯一（数据库层面通过 `(userId, malId)` 复合唯一索引保证）
- `status`：必须是枚举之一
- `rating`：可选，建议 1-10（或 0-10），由后端校验
- `completedAt` / `completedDates`：
  - 仅当 `status=COMPLETED` 时允许写入（或由状态转换自动填充）
  - 日期格式：`YYYY-MM-DD`（heatmap 统计更稳定）

#### 201 Response
返回创建后的条目（结构同 `GET /api/anime` items）。

---

### 3.4 `GET /api/anime/{id}`
获取单条条目详情。

#### 200 Response
条目对象（同上）。

#### 404 Response
资源不存在。

---

### 3.5 `PATCH /api/anime/{id}`
更新条目（重点：状态变更、日期维护）。

#### Request Body（部分字段）

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
更新后的条目对象。

#### 409 Response（推荐）
当状态机转换不合法（例如从 `DROPPED` 直接到 `WATCHING` 被禁止）时返回。

---

### 3.6 `DELETE /api/anime/{id}`
删除条目。

#### 204 Response
无 body。

---

### 3.7 `GET /api/stats/heatmap`
返回 heatmap 数据（现行：人生纸格“按月”）。

#### Query（建议）
- `start`（可选）：`YYYY-MM`，默认：过去 12 个月
- `end`（可选）：`YYYY-MM`，默认：本月
- `tz`（可选）：IANA 时区标识（现阶段仅做校验；聚合按 UTC 月份计算）

#### 200 Response（按月聚合）

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

#### 强度等级（0-4，后端定义）
- `intensity=0` 表示该月无活动
- 权重 `score = addedCount + completedCount`；阈值见 **§5.2**（现行：1→1，2–4→2，5–8→3，≥9→4）

> 备注：旧版“按天绿墙（weeks→days）”已移除，不再作为契约或测试目标。
> 兼容策略：前端 `anitrack/src/app/api/stats/heatmap/route.ts` 已改为 **代理到 NestJS**（`http://localhost:3001/api/stats/heatmap`），全仓对外语义以 NestJS 为准。
> 前端 Activity 列表筛选口径：使用 `dayjs.utc(...).format('YYYY-MM')` 统一与后端 UTC 月聚合，避免时区跨月导致的“统计有数据但列表为空”。

---

### 3.7.1 `GET /api/stats/activity?month=YYYY-MM`
返回某个月份的 Activity 列表（Added/Completed），用于 Profile 页点击热力图格子后展示明细。

#### Query
- `month`：`YYYY-MM`（必填）

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
用于 Dashboard/Profile 顶部统计卡片的一次性聚合接口，避免前端分页拉取造成性能与一致性问题。

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

### 3.8 数据缓存层（AnimeMeta Cache，战略预留）

> **目标**：将 Jikan（MyAnimeList 公开数据）的读路径从「每次直连外部 API」迁移为「以 MongoDB 为影子库的 **Cache-Aside**」，在课程与后续个人博客场景下均可复用。

- **集合角色**：新增 **`AnimeMeta`**（名称可调整），作为 **Jikan 响应体的规范化快照**（例如 `malId`、`title`、`images`、`aired` 等稳定字段），与业务表 **`AnimeEntry`** 解耦：前者偏「目录元数据」，后者偏「用户观看状态」。
- **Cache-Aside 模式**：
  1. **读路径**：按 `malId`（或搜索关键词哈希）先查 **`AnimeMeta`**；**命中**则直接返回本地文档，避免触发 Jikan **Rate Limiting**。
  2. **未命中**：同步请求 Jikan；成功后将 payload **异步写入** `AnimeMeta`（`setImmediate` / 队列 / 后台 `Promise` 均可，实现期再定），并返回本次响应。
  3. **失效策略（可选）**：TTL 索引、`updatedAt` 阈值、或手动 purge；初期可采用「长期缓存 + 手动刷新」降低复杂度。
- **工程收益**：显著降低对外部 API 的耦合与 **429** 风险；本地索引（如 `malId` unique）支撑「类 **10 亿级**」夸张表述下的 **常数级主键查找**（相对每次 HTTP 往返的数量级差异）。

> **实现状态**：已在 NestJS 后端落地为双表结构：`AnimeMeta`（公有缓存）与 `AnimeEntry`（用户私有进度）。创建条目时采用 **Cache-Aside**：先查/写 `AnimeMeta`，再写 `AnimeEntry`，并在返回体中嵌套 `animeMeta`。

#### 3.8.1 Jikan 搜索中转（Search → Upsert → Return）
为避免前端直连外部 API，新增后端中转接口：
- `GET /api/anime-meta/search?q=...`：
  - 上游：`GET https://api.jikan.moe/v4/anime?q={q}&limit=5`
  - 处理：对结果按 `malId` **bulk upsert** 写入 `AnimeMeta`（去重、保持顺序）
  - 返回：规范化后的 `AnimeMeta[]`（含 `id`；不暴露 `_id/__v`）

#### 3.8.2 429 Rate Limit 策略
- 当上游返回 429：后端以 **HTTP 429** 透传语义，并使用错误码 `UPSTREAM_RATE_LIMIT`（前端提示稍后重试）。

#### 3.8.3 “柔性模式”（Soft Mode）
考虑到 Jikan 的可用性与限流波动，`POST /api/anime` 支持柔性创建：
- 若抓取/读取 `AnimeMeta` 失败：记录错误日志但 **不阻断** `AnimeEntry` 创建
- 此时响应体中的 `animeMeta` 为 `null`

#### 3.8.4 运行时缓存（CacheModule，24h）
除 MongoDB 的影子库缓存外，后端已引入 NestJS `CacheModule`，对所有 Jikan HTTP 请求做 24h 缓存（cache key 基于完整 URL），用于从根源降低 429（Rate Limit）发生概率。

#### 3.8.5 当季随机推荐（`seasonal-random`，纯 Mongo / 无 Jikan HTTP）

> Dashboard「当季推荐」读路径：**不调用 Jikan**，仅依赖 Bee 已写入的 `AnimeMirror`（当季队列需已同步 `data`）。**展示语言与抽样解耦**：API 一次返回 `titleCn` / `titleEn` / `titleJp` 等全量字段；前端 `pickAnimeTitle(locale, …)` 按 UI 语言选取；**切换语言不重新 `$sample`**。

- **Endpoint**：`GET /api/anime-meta/seasonal-random?limit=`（`limit` 可选，默认 4；后端将请求限制在约 1–12 条）
- **数据源**：集合 `AnimeMirror`，匹配 `tier=seasonal` 且 `data` 已存在；MongoDB 聚合 **`$sample`** 随机抽样；**优先**已有 `titles.cn` 的文档，减少中文界面英文标题
- **Bangumi 映射（读路径）**：
  - 每次抽样后对缺 `titleCn` 的 `malId` **同步** `ensureI18nForMalIds`（最多一批），再返回；并 fire-and-forget 全池 `scheduleSeasonalMirrorI18nSync`
  - 客户端启动：`POST /api/anime-meta/mirror-i18n-sync` → 后台分批映射整个 seasonal 池；`MirrorI18nBootstrap`（挂 `(main)/layout`）触发，映射完成后可选 invalidate 推荐/时间表缓存
- **响应**：`{ items: [...] }`，单项字段与 `AnimeMeta` 展示模型对齐（`malId/title/titleCn/titleEn/titleJp/imageUrl/score/genres/totalEpisodes/synopsis/synopsisCn/...`）
- **前端（Dashboard）**：
  - React Query **`queryKey` 不含 `locale`**；仅 **`seasonalPickNonce`**（「换一批」）触发重新抽样
  - 推荐卡片可点击打开 **`SeasonalPickDetailDialog`**；列表下方「加入清单」按钮保留
- **空数据**：若当季镜像尚未写入或仍在同步中，可能返回 `items: []`（前端应展示空态与 Bee 运行提示）

#### 3.8.6 新番时间表（`GET /api/anime-meta/timetable`）

> 读路径：**不调用 Jikan HTTP**（依赖 `AnimeMirror` 中已写入的 `data` + Bee 维护的 Bangumi 字段；**星期**在应用层合并 Bangumi 与 Jikan `broadcast`）。

- **Endpoint**：`GET /api/anime-meta/timetable?pastDays=14&futureDays=14`（默认前后各 2 周；兼容旧 `days=` 仅向未来）
- **过滤条件（Mongo）**：`tier=seasonal`、`malId>0`；应用层再保留 **`resolveTimetableWeekdayBangumi` 可解析出 1–7** 的文档（优先 `bangumi.weekday`，否则 Jikan **`broadcast.day` / `broadcast.string`**）。
- **响应**：`{ timezone: "Europe/Berlin", days: [ { date, dateLabel, weekdayLabel, items[] } ] }`
- **单项 `items[]`（要点）**：
  - `malId` / **`bgmId`**（未映射 Bangumi 时为 **`0`**）、`imageUrl`（来自镜像内 Jikan payload）
  - `title`：英文优先显示串；`titleJp` / `titleEn`：多语言快照
  - `airTime`：参与换算的**原始播出字符串**（排障用，可与 `airTimeLocal` 对照）
  - `airTimeLocal` / `nextAirAtIso`：东京墙钟（**含扩展记法**）经 **`dayjs`（`Asia/Tokyo`）** 转 **`Europe/Berlin`**；解析前合并 `bangumi.airTime`、`airDate` 中含 `T` 的时刻、Jikan **`broadcast`** 等；缺失则为空（前端 **TBD**）
  - `synopsisEn` / `synopsisJa`：来自 Jikan 镜像 `synopsis`（非 Bangumi 中文简介）
  - `episodeLabel`：当前为 **`Seasonal`**（当季条目标记）

---

### 3.9 Bee：Anime Mirror System（Cron 镜像同步）

> 目标：为 Schedule / Recommendation 等“读多写少且强依赖第三方”的功能提供 **本地数据镜像**，用受控速率后台抓取 Jikan 并写入 MongoDB，做到：
> - **礼貌爬取**：低频、可控批次，带 `User-Agent`
> - **断点续爬**：重启后从 DB 的 `lastUpdated` 状态继续，不重新从头刷
> - **数据保鲜**：当季番更新快（3 天），老番更新慢（30 天）
> - **读路径 Mirror-first**：需要元数据时优先用镜像，缺失再被动抓取

#### 3.9.1 目录结构（后端）

```text
anitrack-backend/src/modules/bee/
├── bee.module.ts
├── bee.service.ts
├── bee.cron.ts
└── schemas/
    └── anime-mirror.schema.ts
```

#### 3.9.2 Collection：`AnimeMirror`
- `malId: number`（unique index）
- `data: object`（Jikan 返回全量 JSON）
- `lastUpdated: Date`
- `source: 'seasonal' | 'general'`
- `tier: 'seasonal' | 'top_1y' | 'top_5y' | 'top_all' | 'backfill'`（抓取梯队）
- `priority: number`（越小优先级越高）
- **`bgmId`（可选）**：Bangumi `subject_id`；与 `ApiMapping` 对齐，用于日历匹配与 enrich
- **`titles`（可选）**：`{ cn?, jp?, en? }` — 标题多语言快照（时间表英文优先展示依赖此结构 + Jikan `title_english`）
- **`bangumi`（可选）**：`weekday`（1–7）、`airTime`（东京墙钟，允许 **25:00–47:59** 记法）、`airDate`（日历 `air_date`）、`summaryCn`、`detailFetchedAt` 等

#### 3.9.3 调度节奏（避免 60 秒边界）
- **每 65 秒**执行一次
- 每次同步 **3 个**条目（`/anime/{id}`）

#### 3.9.4 优先级策略（多级梯队）
按 `priority`（越小越优先）：
1. `seasonal`（当季，priority=0）
2. `top_1y`（热门 Top 40，priority=10）
3. `top_5y`（热门 Top 100，priority=20）
4. `top_all`（历史热门 Top 200，priority=30）
5. `backfill`（季度回滚补漏，priority=90，仅当 1-4 全部跑满后才启动）

> 注：Jikan 的 `top` 端点不提供严格的“近 1 年/近 5 年”过滤参数；当前实现采用“分层数量梯度（40/100/200）+ 优先级”来逼近你要的策略。若要严格按年份窗口，可在镜像数据里基于 `aired.from` 做二次分类与重打标签。

#### 3.9.5 数据保鲜（TTL）
按 tier：
- `seasonal`：7 天
- `top_1y`（Top40）：30 天
- `top_5y`（Top100）：60 天
- `top_all`（Top200）：180 天
- `backfill`：60 天

#### 3.9.6 读路径适配（Mirror-first）
`AnimeMetaService.getOrFetchByMalId()`：
- 优先查 `AnimeMirror` 的 fresh 数据，命中则直接落地 `AnimeMeta`
- miss 时再走 Jikan（并被动 enqueue general，交给 Bee 后台补齐）

#### 3.9.7 环境变量（开发环境特化）
- `SYNC_ENABLED=true`：启用 Bee 静默同步与启动 seed
- `JIKAN_USER_AGENT=...`：可选，覆盖默认 UA（建议写联系邮箱）

#### 3.9.8 断点续爬状态（BeeState）
为实现“季度回滚补漏”的断点续爬，后端新增 `BeeState`（key-value），用来持久化回滚游标（上一季/年份），重启后从上次位置继续。

#### 3.9.9 Seed 重试（抗 429/网络抖动）
为避免启动 seed 过程中遇到 429 或网络异常导致“只有部分 tier 被播种”，Cron 会以低频（例如每 30 分钟）重试执行 seed（全部为 upsert + `$setOnInsert`，不会产生重复写入）。

#### 3.9.10 429 限流排障（Runbook）
当日志出现 `status=429 code=UPSTREAM_RATE_LIMIT`：
1. 先看当前进度快照：`GET /api/bee/status`
2. 关注：
   - `tiers.top_5y.total` / `tiers.top_all.total`：是否已经播种入队（未播种时为 0）
   - `backoffUntil`：退避时间戳（到点前不建议继续触发 seed）
3. 到 `backoffUntil` 后，可手动触发一次轻量播种：
   - `POST /api/bee/seed-step`
4. 播种成功后应看到 `top_5y.total=100`、`top_all.total=200`，随后 tick 日志会开始出现 `top_5y=3` / `top_all=3` 的同步记录。

#### 3.9.11 Bangumi 映射与 subject enrich（时间表数据链）

> 目标：为当季 `AnimeMirror` 找到 **Bangumi 条目**，写入 **`bgmId` + 放送星期 +（尽力）播出时刻**，并可选拉取 subject 详情。

- **入口**：Bee 服务内 `tryBangumiMapSeasonal()`（由 Cron 周期触发）：拉取 Bangumi `/calendar` 扁平化后与 Jikan 标题做模糊匹配，命中则 `upsert` **`ApiMapping(malId, bgmId)`** 并更新镜像上的 `titles` / `bangumi.weekday` / `bangumi.airTime`。
- **Enrich**：`enrichBangumiSubject(malId, bgmId)` 拉取 Bangumi v0 subject，合并 `summaryCn`、`air_weekday`、`time`/`air_time` 等；`airTime` 写入前经 **`normalizeBangumiWallClock`**（兼容 `2330` → `23:30`）。
- **与 §3.8.6 的关系**：时间表 API **消费**镜像中的 `bangumi.*` + Jikan **`data`**；**星期**可由 Bangumi 或 Jikan 广播字段推导；**钟点**仍依赖 `bangumi.airTime` / `airDate` / `broadcast` 等上游字段，缺失则 `airTimeLocal` 为空（前端 **TBD**）。Bangumi **仅未匹配**时条目仍可能入表（凭 Jikan 星期），但 **`bgmId=0`**，无中文摘要链。

#### 3.9.12 Bee 运维 POST（已写入 `swagger.json`，2026-05-21）

| 方法 | 路径 | 作用 |
|------|------|------|
| **POST** | `/api/bee/seed-step` | 轻量播种重试一步 → 返回 `BeeProgressSnapshot` |
| **POST** | `/api/bee/sync-step` | 手动同步 batch（`batchSize` 1–10；可选 `refreshSeasonalAirTimes` / `airTimeRefreshLimit`）→ `BeeSyncStepResponse` |
| **POST** | `/api/bee/bangumi-map` | 手动触发 Bangumi 标题映射 → `BeeBangumiMappingSnapshot` |
| **POST** | `/api/bee/map-mal-ids` | 清单老番按需映射（query `malIds=38000,8861`）→ `{ attempted, mapped }`；内部用 Bangumi v0 **POST** `search/subjects` |

> **契约冒烟**：`anitrack-tester/contract-validator` 已按 OpenAPI **声明的 HTTP 方法**探测（不再对 POST-only 路径误发 GET）。Bee POST 可能返回 **429**（Jikan/Bangumi 限流），冒烟记为**警告**而非失败。

> **清单中文标题（非 HTTP 新路由）**：`GET /api/anime` 列表读路径在返回前**后台**触发最多 8 个缺 `titleCn` 的 `malId` 映射（不阻塞响应）；终端日志前缀 **`[i18n-map]`**。

- **Query**
  - `batchSize`（可选）：本次 Jikan 镜像同步批大小，默认 `3`，上限 `10`
  - `refreshSeasonalAirTimes`（可选）：`true` / `1` 时，在同步前先对最多 **`airTimeRefreshLimit`** 条 **`tier=seasonal` 且已映射 `bgmId`** 的文档调用 **`enrichBangumiSubject`**，用于纠正 **`bangumi.airTime` / `weekday` / `airDate`**
  - `airTimeRefreshLimit`（可选）：与上一参数联用，默认 `50`，上限 `200`
- **200 响应**：在默认情况下与 `GET /api/bee/status` 的快照结构一致；若执行了刷新，则额外包含 **`seasonalAirTimeRefresh: { attempted, refreshed, errors }`**

---

### 3.10 多用户扩展性备忘（未来迁移至个人博客）

> 当前仓库以 **单用户 / 无鉴权** 为主，便于课程交付；以下约束便于未来引入 **`userId` 隔离** 时少改表结构。

- **数据隔离**：`AnimeEntry`（及未来的 `AnimeMeta` 若存用户级偏好）采用 **`userId: ObjectId`**（或 `sub` / `email` 的稳定外键）与业务字段组成 **复合唯一索引**，例如 **`(userId, malId)` unique**，所有列表与热力图 **Aggregation Pipeline** 的首个 **`$match`** 必须带 **`userId`**。
- **鉴权层**：Next.js Route Handlers 或 Middleware 校验 **Session / JWT**；将 `userId` 注入请求上下文，**禁止**由客户端自由传入未校验的 `userId`。
- **OpenAPI**：扩展 `securitySchemes`（如 `bearerAuth`）；现有单用户路径可标记 `optional` 或保留 **dev-only** 默认用户。
- **迁移路径**：先加可空 `userId` + 回填默认用户 → 再强制非空 → 最后删除「全局共享」代码路径；**Contract Testing** 应同步增加「跨用户不可读」用例。

---

### 3.11 NestJS Backend Migration（Next.js → NestJS，架构平移）

> 目标：在 **不改变任何 API 字段名** 的前提下，将后端从 Next.js Route Handlers 平移到 NestJS，保持业务规则（状态机、完成日期维护、热力图聚合）与契约测试一致。

#### 目录与端口约定

- `anitrack/`：Next.js 前端（端口 `3000`）
- `anitrack/anitrack-backend/`：NestJS 后端（端口 `3001`，全局前缀 `/api`，Swagger UI `/api-docs`，OpenAPI JSON `/swagger.json`）

#### 分层架构（Controller / Service / Repository）

- **Controller**：只负责路由与 DTO 校验，路径保持 `GET/POST /api/anime`、`GET/PATCH/DELETE /api/anime/:id`、`GET /api/stats/heatmap`
- **Service（业务灵魂）**：承载状态机迁移校验、`COMPLETED` 自动维护 `completedAt/completedDates`、以及热力图统计逻辑
- **Repository（Mongoose Model）**：通过 `@nestjs/mongoose` 注入 `AnimeEntry` 模型；索引（如 `malId unique`）保持一致

#### 兼容性约束（必须保持）

- **错误信封**：所有错误统一返回 `{ "error": { "code", "message", "details" } }`
- **状态机**：遵循 §5.1 的 allowed edges（非法迁移返回 `409 INVALID_STATUS_TRANSITION`）
- **热力图聚合**：保持 `$unwind` + 规范化（`$dateToString` / `$toString` + `$trim`）以兼容历史 `Date/string` 混存

---

## 4. MongoDB 数据模型（Schema Design）

> 目标：既能支撑 watchlist CRUD，也能支撑 heatmap 的日期维度统计，并且便于测试与聚合。

### 4.1 `User`（可选，若课程不要求登录可先跳过）
- `_id`
- `email`（唯一）
- `passwordHash`（若做 auth）
- `createdAt` / `updatedAt`

### 4.2 `AnimeEntry`（用户私有 watchlist 主表）

建议字段（以 Mongoose/TypeScript 的思路表达）：
- `_id`：ObjectId
- `userId`：string（阶段 3 占位符 `TEMP_USER_ID`；阶段 4 迁移为从 Token 解析出的真实用户 id）
- `malId`：number（来自 Jikan / MyAnimeList）
- `status`：enum
- `rating`：number（可选）
- `episodesWatched`：number（可选；用于“已看 x / 全 y 集”的进度管理）
- `notes`：string（可选）
- `startedAt`：string(`YYYY-MM-DD`)（可选）
- `completedAt`：string(`YYYY-MM-DD`)（可选）
- `completedDates`：string[](`YYYY-MM-DD`)（用于记录“完成日期轨迹”，也可作为历史的按天统计信号；现行月聚合主要使用 `completedAt`）
- `createdAt` / `updatedAt`

> **Ownership 约束**：`AnimeEntry` 中禁止出现 `title/imageUrl/score/episodes` 等番剧客观信息；这些字段必须属于 `AnimeMeta`。

#### 为什么需要 `completedDates`
- 最简：每次完成一部番就记 1 个日期，用于贡献计数
- 可扩展：未来若做 “episode completion”，可记录多个日期（同一天多次也可通过 count 累加）

#### 索引建议
- `(userId, malId)` unique（防重复收藏）
- `(userId, status)`
- `(userId, updatedAt)`（列表排序）
- `completedDates`（多键索引）用于范围查询/聚合（视实现而定）

### 4.3 `AnimeMeta`（番剧公有元数据缓存 / 影子库）

- `_id`：ObjectId
- `malId`：number（全局唯一）
- `title`：string
- `imageUrl`：string（可选）
- `episodes`：number（可选）
- `totalEpisodes`：number（可选；优先使用，`episodes` 为历史兼容字段）
- `score`：number（可选）
- `synopsis`：string（可选；可能较长）
- `genres`：string[]（可选；从 Jikan genres 对象数组规范化为字符串数组，便于前端 Tag 渲染）
- `createdAt` / `updatedAt`

#### 关系
- `AnimeEntry.malId` → `AnimeMeta.malId`（以 `malId` 进行关联；列表/详情响应中嵌套 `animeMeta`）

### 4.4 双表关联返回逻辑（`AnimeMeta` ↔ `AnimeEntry`）

> 目标：让 `AnimeEntry` 保持“用户私有进度”，让 `AnimeMeta` 承担“公有元数据缓存”，并且前端拿到的数据天然适合渲染（`animeMeta` 已嵌套在返回体中）。

- **数据职责拆分**：
  - **`AnimeMeta`**：以 `malId` 为全局唯一键，保存标题/封面/集数/评分等“客观元数据”（可由 Jikan 拉取并缓存）。
  - **`AnimeEntry`**：以 `userId + malId` 唯一，保存状态/评分/笔记/完成日期等“用户私有进度”。
- **关联键**：`AnimeEntry.malId` ↔ `AnimeMeta.malId`（用 `malId` 进行 join）
- **读路径（列表/详情）**（文字流程图）：
  - `GET /api/anime` / `GET /api/anime/:id`
  - 查 `AnimeEntry`（按 `userId` 过滤）得到 entries
  - 取出 entries 的 `malId[]`
  - 查 `AnimeMeta`（`malId in [...]`）
  - 组装响应：对每个 entry，注入 `animeMeta`（若未命中，可为 `null` 或触发后端补写；以实现为准）
- **写路径（创建）**（Cache-Aside 思路）：
  - `POST /api/anime`（客户端仅提交 `malId` + 私有字段）
  - 先查/写 `AnimeMeta(malId)`（未命中则从外部源拉取并写入缓存）
  - 再写 `AnimeEntry(userId, malId, ...)`
  - 返回 `AnimeEntry`，并在返回体中嵌套 `animeMeta`

---

## 5. 后端业务逻辑层划分（严格后端）

### 5.1 状态机转换验证（后端）
定义允许的状态迁移图（示例，最终可调整）：
- `PLANNED` → `WATCHING|ON_HOLD|DROPPED|COMPLETED`
- `WATCHING` → `ON_HOLD|DROPPED|COMPLETED`
- `ON_HOLD` → `WATCHING|DROPPED|COMPLETED`
- `DROPPED` → `PLANNED`（可选是否允许“捡回来”）/ `WATCHING`（可选）
- `COMPLETED` → `WATCHING`（重刷，re-watch，可选）/ 其他（通常禁止）

后端负责：
- 拒绝非法迁移（返回 409 或 400）
- 在 `status` 变为 `COMPLETED` 时，自动维护 `completedAt/completedDates`

### 5.2 Heatmap 聚合与强度计算（后端）
接口：`GET /api/stats/heatmap`

后端必须负责：
- 读取 `AnimeEntry` 中 `status=COMPLETED` 的条目
- 提取与聚合信号（现行）：
  - `addedCount`：按 `createdAt` 所在月份计数
  - `completedCount`：按 `completedAt` 所在月份计数（`status=COMPLETED`）
  - `episodeCount`：按 `completedAt` 所在月份累加 `episodesWatched`
- （现行）按月聚合为“人生纸格（月）”：返回 `months[]`，每个月包含 `addedCount/completedCount/episodeCount/intensity`

#### 建议的强度阈值策略（现行）
权重 `score = addedCount + completedCount`（`episodeCount` 仅用于 tooltip，不参与强度）：

| 权重 `score` | `intensity` |
|-------------|-------------|
| 0 | 0 |
| 1 | 1 |
| 2–4 | 2 |
| 5–8 | 3 |
| ≥ 9 | 4 |

实现：`anitrack-backend/src/common/utils/monthly-heatmap-intensity.ts`（Jest 单测同目录 `.spec.ts`）。

> 优点：易解释、稳定；对重度用户需更高权重才到深绿。  
> 备选：按分位数动态阈值（更“自适应”，但更难解释，且测试要更精确）。

---

## 6. 测试策略（Test Cases）

> 工具约束：后端基于 Next.js App Router 的 API routes；测试使用 Vitest。  
> 目标：同时覆盖 Integration Tests 与 Unit Tests（课程要求）。

### 6.1 集成测试（Integration Tests）：`/api/stats/heatmap`

#### Case A：空数据（按月）
- **Given**：用户无条目（或无 completed/episodes 贡献）
- **When**：请求 `GET /api/stats/heatmap?start=2026-01&end=2026-03`
- **Then**：
  - 状态码 **200**
  - 返回包含 `start/end/months`
  - `months` 覆盖范围内每个月（包含 2026-01/02/03）
  - 每个月 `addedCount/completedCount/episodeCount` 为 0，`intensity=0`

#### Case B：多数据（按月聚合）
- **Given**：
  - 多条条目分布在不同月份，且 `COMPLETED` 的条目带 `completedAt` 与 `episodesWatched`
- **When**：请求覆盖这些月份的范围
- **Then**：
  - 状态码 **200**
  - 对应月份的 `completedCount` 与 `episodeCount` 聚合正确
  - `intensity` 按阈值映射正确（基于 `addedCount+completedCount` 的权重）

#### Case C：参数校验（可选但加分）
- **Given**：`start > end` 或月份格式错误
- **When**：请求 heatmap
- **Then**：状态码 **400**，错误结构符合通用错误体

### 6.2 单元测试（Unit Tests）：heatmap 月度强度映射
纯函数：`calculateMonthlyIntensity`（`monthly-heatmap-intensity.ts`）

- `score=0 → 0`
- `score=1 → 1`
- `score=2-4 → 2`
- `score=5-8 → 3`
- `score≥9 → 4`
- 非法输入（负数/NaN）→ 按截断后计算（与实现一致并测试）

---

## 6.3 测试导航（Troubleshooting Toolbox）

> 目的：当“前后端联调/数据库/契约/第三方 API”出问题时，**知道先跑哪个测试、在哪里看结果、怎么定位问题**。

### 6.3.1 快速排障顺序（推荐）

- **API 是否活着（最基础）**：后端 Swagger 能打开？
  - `http://localhost:3001/api-docs`
  - `http://localhost:3001/swagger.json`
- **后端自检（不依赖外部 Jikan）**：跑 NestJS 的 e2e/smoke（会 mock `AnimeMetaService`，且可用内存 Mongo）
  - 适合定位：错误信封、状态机、heatmap 结构、CRUD 基础链路
- **前端代理集成**：Vitest `heatmap.integration.test.ts`（断言 Next.js heatmap 路由转发 NestJS 并返回 `{ start,end,months[] }`）
- **契约回归（Swagger vs 运行时）**：`anitrack-tester/contract-validator`
  - 适合定位：路径缺失/字段不一致/错误码与信封不一致/分页结构偏差
- **端到端冒烟（HTTP 层）**：`anitrack-tester/api-test-suite/run-all.js`
  - 适合定位：创建→更新→冲突→完成日期副作用→删除的“真实 HTTP 闭环”

### 6.3.2 后端测试（NestJS / Jest）

目录：`anitrack/anitrack-backend/`

- **单元/集成（Jest）**
  - `npm test`（含 `monthly-heatmap-intensity.spec.ts`）
- **e2e 与 smoke**
  - `test/app.e2e-spec.ts`：最小 e2e（`GET /api`）
  - `test/app.smoke-spec.ts`：覆盖 heatmap、状态机、CRUD（mock `AnimeMetaService`；无 `MONGODB_URI` 时启用 `mongodb-memory-server`）

### 6.3.3 前端测试（Next.js / Vitest）

目录：`anitrack/`

- **单测**：`npm test`（Vitest；无 heatmap 纯函数单测，强度逻辑在后端 Jest）
- **集成测试**：`npm run test:integration`
  - 例：`src/__tests__/integration/heatmap.integration.test.ts`（NestJS 代理契约）

### 6.3.4 契约测试（Contract Validator）

目录：`anitrack-tester/contract-validator/`

- **一键运行（结构 + HTTP 冒烟）**：`npm run contract`（或 `node run-contract-test.js`）
- **环境变量**
  - `BASE_URL`（默认 `http://localhost:3001/api`，用于推导 `origin`）
  - `CONTRACT_ORIGIN`（覆盖站点根，如 `http://localhost:3001`）
  - `CONTRACT_SWAGGER_URL`（覆盖 swagger.json 地址）
  - `CONTRACT_PENDING_PATHS`（逗号分隔；允许暂未实现路径降级为 warning）

### 6.3.5 HTTP 冒烟脚本（API Test Suite）

目录：`anitrack-tester/api-test-suite/`

- **一键跑通（smoke + batch）**：`node run-all.js`
- **播种 heatmap 数据**：`node heatmap-seeder.js`
- **环境变量**
  - `BASE_URL`（默认 `http://localhost:3000/api`，历史原因；如需直连 NestJS，建议：`http://localhost:3001/api`）

---

## 7. 响应式 UI 规范（Breakpoints & Layout）

> 目标：手机端可用、桌面端信息密度更高；热力图在窄屏可横向滚动。

### 7.1 断点建议（Tailwind 默认）
- `sm`：≥ 640px
- `md`：≥ 768px
- `lg`：≥ 1024px

### 7.2 页面布局行为（主界面）

#### 移动端（< md）
- 布局：纵向堆叠
  - 顶部：Heatmap（可横向滚动）
  - 下方：Watchlist（按状态分组或 tab 切换）
  - Schedule 可作为单独页面或折叠区块

#### 桌面端（≥ md）
- 布局：两列或三段
  - 左侧：Watchlist（列表/分组）
  - 右侧上方：Heatmap（固定可见）
  - 右侧下方：Seasonal Schedule（表格/卡片）

#### Dashboard（`/`）— 当季推荐
- 「当季推荐」：**卡片可点击**打开 **`SeasonalPickDetailDialog`**（封面、评分、话数、类型、简介去 HTML、**加入清单 PLANNED**）；列表内保留「加入清单」快捷按钮；成功写入后关闭 Dialog 并刷新清单缓存
- **换一批**递增 `seasonalPickNonce` 重新抽样；**切换 UI 语言不触发**重新请求（见 **§3.8.5**、**§7.5**）

#### Timetable（时间表页）
- 形态：**多列横向滚动**（列宽约 200px，参考 animeko）；每列为柏林日历日；列内 **`items-start`** 对齐，**全量渲染** API 返回条目；条目按 `airTimeLocal` 字符串排序；**今天列**高亮并初始滚动居中
- 数据：`GET /api/anime-meta/timetable?pastDays=14&futureDays=14`（见 **§3.8.6**）；无本地钟点时显示 **TBD**；缺 Bangumi 映射时可能 **`bgmId=0`**（见 **§1.2**、**§10.5**）
- 交互：左右箭头横向滚动；**星期**由 `formatWeekdayBerlin` 按 UI locale 渲染；**点击卡片** → 详情 Dialog（`z-50`，移动端近全屏可滚动；MAL / Bangumi ID、Synopsis、`POST /api/anime` 追更或打开已有条目的编辑 Dialog）

#### Dialog（共用）
- 样式：`lib/dialogUi.ts` — 移动端近全屏 + 可滚动 body；桌面居中 modal；**`z-50`** 覆盖 sticky 页头/日期列
- 删除：`AnimeEntryDialog` 需 **二次确认**（i18n：`entryDialog.deleteConfirm*`）

### 7.3 Heatmap 组件规范
- 单元格：桌面 **16×16px**（间距 3px）；窄屏随容器缩放；间距 2–3px
- 颜色：按 `intensity 0-4` 对应 5 档绿色（0 为灰/背景）
- 窄屏：容器 `overflow-x-auto`，保持单元格不被压扁；tooltip 智能上/下翻转
- 起始月：`StartMonthPicker`（中/英年月标签，与壳层 i18n 一致）

### 7.4 Schedule 组件规范
- 移动端：按“星期”折叠分组，卡片流
- 桌面端：表格或多列栅格，支持快速扫视

### 7.5 整站国际化（UI 文案 + 作品展示语言，2026-05-21）

> **原则**：**壳层 UI 语言**（按钮、导航、Toast、空态）与 **番剧元数据展示语言**（标题、简介）**解耦**。切换语言只改前端渲染与字段优先级，**不改** `AnimeEntry.status` 等 API 枚举值。

#### 7.5.1 前端（Next.js）

| 模块 | 路径 / 职责 |
|------|-------------|
| 文案词典 | `anitrack/src/i18n/messages/zh.ts`、`en.ts` |
| 运行时 | `I18nProvider` + `useI18n().t(key, params)`；根级挂在 `app/providers.tsx` |
| 切换器 | `TopNav` → `LanguageSwitcher`；偏好 **`localStorage`** 键 `anitrack.locale`（`zh` \| `en`），并设置 `document.documentElement.lang` |
| 作品标题/简介 | `anime-display.ts`：`pickAnimeTitle` / `pickAnimeSynopsis`；组件侧用 `useAnimeDisplay()` |
| Mirror 当季映射 | `MirrorI18nBootstrap` → `POST /api/anime-meta/mirror-i18n-sync`；后台补全 seasonal 池 Bangumi 字段 |

**`pickAnimeTitle` 优先级（简述）**

- UI = **zh**：`titleCn` → `title`（含 CJK）→ `titleJp` → `titleEn`
- UI = **en**：`titleEn` → `title` → `titleJp` → `titleCn`

**当季推荐与语言切换**

- API **不带 `locale` 参数**；响应含多语言快照
- Dashboard **`queryKey` 不含 `locale`**：切语言只重算 `displayTitle`，**不换一批番剧**
- 仅用户点击「换一批」或（可选）Bootstrap 映射完成后的 cache invalidate 会重新请求列表

简介同理：`synopsisCn`（Bangumi）与 `synopsisEn` / `synopsisJa`（Jikan 分类）按 UI 语言择优。

> 未引入 `next-intl` 路由级 locale，避免改动 App Router 结构；若未来需要 `/en/library`，可在此基础上演进。

#### 7.5.2 后端（NestJS，读路径增强）

- **数据源**：Jikan（`AnimeMeta` / 镜像 `data`）+ Bangumi 映射（`AnimeMirror.titles`、`bangumi.summaryCn`）。
- **`AnimeMetaService.attachMirrorI18n`**：在 **`findByMalIds`**、**`getOrFetchByMalId`**、**`randomSeasonalFromMirror`**、**`getTimetable`** 响应中合并 `titleCn` / `titleJp` / `titleEn` / `synopsisCn`（优先 DB 已持久化字段，再合并 `AnimeMirror.titles` / `bangumi.summaryCn`）。
- **当季推荐映射**：`randomSeasonalFromMirror` 抽样后 **同步** `ensureI18nForMalIds`（缺中文时）；`scheduleSeasonalMirrorI18nSync` 全池后台批次；`POST /api/anime-meta/mirror-i18n-sync` 供客户端启动触发。
- **清单老番映射**：`BeeService.ensureBangumiMappingForMalId` → Bangumi v0 **POST** `/search/subjects`（非 GET）；成功则写入 **`AnimeMeta.titleCn`** 等。运维：`POST /api/bee/map-mal-ids`；日常依赖列表读路径后台批次 + 刷新页面。
- **搜索 `GET /api/anime-meta/search`**：仍以 Jikan 即时结果为主，**不一定**带 Bangumi 中文名（除非该 `malId` 已有镜像映射）。

---

## 8. 实施路线图（进入代码阶段：3 个阶段）

### 阶段 1（后端基座）
> 根据 Anitrack 的架构设计，使用 Next.js App Router 创建后端 API 路由。实现 MongoDB 的连接逻辑，并定义 `/api/anime` 的 CRUD 接口，确保遵循 OpenAPI 规范中的字段定义。

**交付物清单**
- Next.js App Router 项目骨架
- MongoDB 连接（可复用、可测试）
- `/api/anime`：
  - `GET` 列表
  - `POST` 创建
  - `GET/PATCH/DELETE /{id}`
- 初版 OpenAPI（最少覆盖 anime 与 heatmap）

### 阶段 2（逻辑与测试）— **已完成（仓库现状）**
> 现行后端 `/api/stats/heatmap`：按月聚合（人生纸格），输出 `{ start,end,months[] }`；强度映射见 **§5.2**。

**交付物清单（已对齐）**
- heatmap 聚合 Pipeline + 月度强度纯函数（**`Date`/`string` 混存修复**）
- `GET /api/stats/heatmap` 路由
- Jest：`monthly-heatmap-intensity` 单测；Vitest：heatmap **integration**（Next 代理）

### 阶段 3（前端渲染）— **课程核心路径：已完成**
> 原规划中的 **Jikan 代理/缓存（`AnimeMeta`）**、**多页主界面**、**Watchlist / Heatmap / Dashboard 当季推荐 / Timetable** 等均已落地。后续改动以 **体验优化与可选功能**为主（见 **§10.5**），不再作为课程交付阻塞项。

> 主界面：Dashboard / Library / Profile；热力图为 **人生纸格（月）**；热力图组件根据 API 的 **`intensity` 0–4** 渲染色深，窄屏 **`overflow-x-auto`** 横向滚动。

**交付物清单（与仓库现状对齐）**
- [x] 前端 API 基座：统一 `fetcher`，默认直连 `http://localhost:3001/api`
- [x] Jikan 搜索中转：`GET /api/anime-meta/search?q=...`（写入 `AnimeMeta`）
- [x] 原型页闭环：搜索 → 添加（`POST /api/anime { malId }`）→ 刷新我的清单（`GET /api/anime`）
- [x] 桌面端成品化样式（原型页）：我的清单 4 列卡片网格、封面占位、状态配色 badge、搜索结果紧凑卡片
- [x] 拆分真实页面与组件（`/` Dashboard、`/library`、`/profile`），并完成 Watchlist 编辑/删除/状态迁移（Dialog）
- [x] Heatmap：Profile 页从“过去一年日历格”升级为“人生纸格（月）”（每行 12 个月）；后端 heatmap 输出升级为 `{ start,end,months[] }`（added/completed/episodes + intensity）
- [x] Dashboard 当季推荐：`GET /api/anime-meta/seasonal-random`（`AnimeMirror` / `$sample`，见 **§3.8.5**）+ 前端换一批 / 加入清单（Sonner）+ **`SeasonalPickDetailDialog`**（卡片点击详情）
- [x] 新番时间表：`/timetable` + `GET /api/anime-meta/timetable`（Bangumi 星期 + 镜像数据）；**播出钟点 TBD 问题暂缓**（见 **§1.2**）
- [x] **整站双语**：UI 文案中/英切换 + 作品标题/简介按 UI 语言展示（见 **§7.5**、`TASK_PROGRESS.md` §4.9）
- [ ] 独立 Seasonal Schedule 页面（若仍希望纯 Jikan schedule 视图，可作为阶段 6 可选，与现行 Bangumi 驱动时间表并存或取舍）

---

## 11. 课程要求与 Anitrack 映射（答辩用，2026-05-28）

> **课程符合性（一句话）**：Anitrack 在代码与仓库层面已满足课程全部**内容要求**；**组织要求**（三人各约 7 分钟、分工说明、Präsentation + Live-Demo）需在答辩现场由 `Project_Intro` 材料完成。

> 课程原文（德文 + 中文）：**`Project_Intro/项目要求.md`**  
> 答辩清单：**`Project_Intro/答辩清单.md`** · PPT 大纲：**`演讲大纲.md`** · 稿：**`PPT文字稿大纲.md`**

| 课程要求 | Anitrack 实现 |
|----------|----------------|
| Backend-Framework **NestJS** | `anitrack-backend/`（NestJS 11） |
| Backend: Business-Logik + Datenhaltung | 状态机、Heatmap 聚合、Bee；MongoDB |
| HTTP-API, CRUD | `/api/anime` GET/POST/PATCH/DELETE |
| **API first** | `swagger.json` + `/api-docs`；契约测试 |
| API für Frontend + Script-Clients | Next.js `fetcher`；`anitrack-tester` |
| Integrationstests (API) | Jest e2e/smoke；Vitest integration；contract-validator |
| Unittests (Business-Logik) | `monthly-heatmap-intensity`；Jest 单测 |
| Frontend: wenig Business-Logik | 统计/校验在后端；前端渲染 + 表单 |
| Responsive Design | §7、`TASK_PROGRESS.md` §4.11 |
| Präsentation ~7 min/Person, Rollen | 分工写入 PPT 第 2 页（`Project_Intro/演讲大纲.md`）；`.pptx` 待建 |

**Swagger**：已维护于 `anitrack-backend/swagger.json`（英文描述），**答辩展示 UI 即可，无需重复撰写完整 API 手册**。

**图示（幻灯片）**：`anitrack-visuals/figures/*.png`（英文）。

---

## 9. 备注区（随手记）

- **Auth**：课程未要求时可维持单用户 + `TEMP_USER_ID`；多用户见 **§3.10**。属**锦上添花**，非当前阻塞。
- **Jikan**：**后端代理 + §3.8 Cache-Aside（`AnimeMeta`）** 与 **Bee 镜像** 已落地；直连仅作 miss 路径。
- OpenAPI：仓库内 **`anitrack-backend/swagger.json`** 由 Nest 启动时加载；浏览器 **`http://localhost:3001/api-docs`**；契约冒烟对 `paths` 中**每个已声明方法**发请求（含 Bee **POST**，见 **§3.9.12**）。长期可选 **zod-to-openapi** 等单向生成。
- **期末会考 · Promise 与 Bootstrap（仓库现状）**：
  - **Bootstrap（应用启动）**：有。`anitrack-backend/src/main.ts` 中 **`async function bootstrap()`** → `NestFactory.create` → 全局管道/过滤器 → 加载 `swagger.json` → `listen`。**不是**前端 CSS 框架 Bootstrap（本仓库未使用）。
  - **Promise / async-await**：有，贯穿全栈。例：前端 `lib/api.ts` 的 `fetcher`；React Query 的 `queryFn`；后端 Bee `Promise.all` 并行 `countDocuments`；`new Promise` + `setTimeout` 做礼貌退避。详见 **`TASK_PROGRESS.md` §4.10**。
  - **若要更显式展示（可选增量）**：Dashboard 用 `Promise.all` 合并 `getStatsSummary` + `getAnimeEntries`；或在前端增加「启动健康检查」`Promise.all([fetch('/api'), fetch('/api/bee/status')])`。
- **整站 UI 语言（中/英）**：已落地，见 **§7.5**；壳层文案与作品展示语言解耦。
- **Timetable**：数据缺口与双源未对齐时的表现见 **§1.2**、**§10.5**。

---

## 10. 实施进度快照（与仓库同步，**2026-06-07：Mirror i18n / 当季推荐 / 时间表 & 热力图体验**；**2026-05-28：答辩材料**；**2026-05-21：Swagger / i18n / 响应式**；**2026-05-14：核心交付闭环**）

| 维度 | 状态 |
|------|------|
| 课程**内容**要求（NestJS、CRUD、API-first、测试、薄前端、响应式） | **已满足** |
| 核心功能（Watchlist、统计/热力图、Bee、Dashboard/Library/Profile/Timetable） | **已交付** |
| 答辩**组织**要求（7 min/人、分工、Live-Demo） | **答辩当天完成** |
| 答辩材料（大纲/稿/清单/图示） | **已就绪** |
| 答辩材料（`.pptx`、英文截图、排练） | **待完成** |

以下结论基于 **真实请求 + 数据库读写**（`anitrack-tester/api-test-suite/run-all.js`）、**仓库内 Vitest**（`npm test` / `npm run test:integration`），以及 **Contract Testing**（`anitrack-tester/contract-validator/run-contract-test.js`，**严格模式**：`CONTRACT_PENDING_PATHS` 为空）。

### 10.1 已可认为“成立”的范围（阶段 1 + 阶段 2）

- **MongoDB 接入**：`anitrack/.env.local` 中 `MONGODB_URI`（Atlas）；开发与集成测试下连接、**Aggregation Pipeline**、写入均可用。
- **`/api/anime` 契约与行为**：
  - CRUD 与分页列表符合第 3 章草案，并增强返回 `totalPages`（前端分页器可直接渲染）。
  - 支持 sort 白名单（`updatedAt/createdAt/rating`）。
  - **状态机**：非法迁移 **409**，`error.code` 为 **`INVALID_STATUS_TRANSITION`**。
  - **`COMPLETED` 副作用**：`completedDates` 自动维护为 **`YYYY-MM-DD`**；`DELETE` **204**。
- **`GET /api/stats/heatmap`**：现行输出为 `{ start,end,months[] }`（按 `userId` 聚合：added=`createdAt`；completed/episodes=`completedAt + episodesWatched`），用于“人生纸格（月）”；支持 `start/end=YYYY-MM`。
- **OpenAPI / Swagger UI（主 API）**：**`http://localhost:3001/swagger.json`** + **`http://localhost:3001/api-docs`**（Nest 加载 `anitrack-backend/swagger.json`），**Try it out** 直连 Nest。前端 **`http://localhost:3000/`** 为页面入口；早期若存在 `public/swagger.json` 仅为历史对照，**勿与 3001 契约混淆**。
- **Contract Testing**：**AJV**（OpenAPI 3.0 元模式）+ **SwaggerParser** + HTTP 冒烟；严格模式下 **全绿**，与实现 **契约一致**。
- **Vitest**：heatmap **integration test**（Next 代理 NestJS，断言 `months[]` 结构）。
- **Jest**：`monthly-heatmap-intensity.spec.ts`（月度强度 0–4 映射）。
- **数据播种**：`api-test-suite/heatmap-seeder.js` 可稳定追加约 20 条 **COMPLETED**（不清库），用于联调 **intensity 0–4**。

### 10.2 增量焦点（非课程硬性：体验与数据完备）

- **Jikan / 搜索**：`GET /api/anime-meta/search` 已分页；`AnimeMeta` 已含 `synopsis/genres/totalEpisodes`。
- **Timetable**：真实数据 + Jikan 星期兜底已上线；UI 为多列横向滚动 + 前端柏林星期 i18n；**TBD / 缺列**仍受上游与映射率约束（§1.2）。
- **当季推荐 i18n**：Mirror 抽样优先 `titles.cn`；读路径同步 Bangumi 映射；切换 UI 语言不 reshuffle。
- **前端**：Dashboard / Library / Profile / Timetable 已对接；**整站 i18n（§7.5）已上线**；Auth、推荐算法、纯 Jikan Schedule 第二视图等见 **§10.5**。

### 10.3 实现侧备忘（避免重复踩坑）

- **`PATCH` 与 Zod 默认值**：`AnimeEntryPatch` 解析时可能为 `completedDates` 填入默认空数组；路由层判断“是否触碰完成日期字段”应以 **原始 JSON 是否包含对应 key** 为准，避免把“仅更新 status”误判为“在写 completed 字段”。
- **热力图 Aggregation**：任何涉及 **日历字符串** 与 **BSON `Date`** 的 **Normalization** 必须在 **`$group` 之前**完成，且 **`$match` 闭区间** 作用于 **同一规范化字段**，否则易出现 **静默空结果**。
- **Swagger（主 API）**：后端 `http://localhost:3001/api-docs`；OpenAPI JSON `http://localhost:3001/swagger.json`。前端开发入口 `http://localhost:3000/`。

### 10.4 阶段 4–5 里程碑（2026-04-29）

- **多页面架构**：Next.js App Router 拆分为 `/`（Dashboard）、`/library`（管理）、`/profile`（用户中心），并抽出 `TopNav/AppShell/AnimeCard/Pagination` 等公共组件
- **搜索体验进化**：Jikan 搜索分页（后端透传 + 前端分页器），输入 debounce(500ms) 自动搜索，Enter 立即触发并回到第 1 页
- **深度管理**：Library 采用“单全局 Dialog”展示详情与编辑（`status/rating/episodesWatched`），并通过 React Query `invalidateQueries(["anime"])` 实现跨页面同步
- **Meta 丰富化**：`AnimeMeta` 追加 `synopsis/genres(string[])/totalEpisodes`，前端 Tag 渲染限制展示数量（默认 3 个）避免溢出

### 10.5 课程核心 vs 锦上添花：未开发 / 建议开发 / 建议放弃（2026-05-14）

> **结论（与仓库对齐）**：项目**启动时期望的可用功能**（Watchlist CRUD、统计与热力图、Jikan 搜索与元数据缓存、Bee 镜像、Dashboard、Library、Profile、当季推荐、Bangumi 驱动时间表 + Jikan 兜底星期、契约与测试基线）**已全部具备**。下列均为**非硬性交付**；按投入产出自行排序即可。

| 类型 | 内容 |
|------|------|
| **尚未开发（可选）** | **登录与多用户隔离**（§3.10）；**推荐个性化**（基于 `AnimeEntry` 的加权/每日推荐） |
| **建议开发（锦上添花、性价比高）** | 小范围 **UI 一致性**（间距、空态）；**页脚与排障文案**（Bangumi 未映射 / TBD）；**URL 级 locale**；**答辩 PPT/稿**（`Project_Intro/`） |
| **已完成（答辩图示）** | **`anitrack-visuals/figures/`** — tech-stack / architecture / user-flow / data-flow（**English labels**，见 `TASK_PROGRESS.md` §12） |
| **建议放弃或长期搁置（ROI 低或与现行路线重复）** | **Timetable「零 TBD / 全映射」数据专项**（与 §1.2 已知缺口同类：无稳定免费源时难 100% 无待定钟点）；**并行维护「纯 Jikan `/schedule` 周视图 + 新页面」**；**追求 100% 播出钟点无 TBD**；**过早 zod-to-openapi 全量生成** |
| **保持现状即可** | 单用户 + `TEMP_USER_ID`；时间表 **Europe/Berlin**、**±2 周日期条**（`pastDays`/`futureDays`）；Bee **65s/3 条**；作品标题按 UI 语言择优（§7.5）；**响应式布局已完成**（`TASK_PROGRESS.md` §4.11） |


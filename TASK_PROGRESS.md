# Anitrack — 任务进度 & 备注（Working Log）

> 目的：让“当前做到哪里了、下一步做什么、卡点是什么、做过哪些决定”一眼可见。  
> 约定：每次变更/讨论后，至少更新 **当前状态** 和 **下一步**。

---

## 0. 当前状态（每次更新这里）

- **当前阶段**：阶段 5+（增量交付）：Dashboard / Profile / Library 成熟；**Timetable 已接真实 API**；**播出钟点 TBD** 暂缓（待数据源或产品策略）
- **正在做**：—（文档同步：记录 Timetable 契约与已知限制）
- **下一步**：
  - **Timetable 播出时间**：在 Bangumi/Jikan 侧有可靠 `airTime` 或备选字段前保持 **TBD** 空态可接受；后续可评估 subject 补全、二次 enrich、或 Jikan broadcast 解析等
  - 推荐：在现有「镜像 `$sample` 随机当季」基础上，可选升级为每日个性化（结合 `AnimeEntry` / 标签偏好等；读路径仍以 Mirror 为主）
  - Bee 镜像系统：在开发环境持续镜像 Jikan 元数据到 Atlas `AnimeMirror`；Bangumi 映射 / enrich 继续跑通映射覆盖率
  - Auth：替换 `TEMP_USER_ID`（JWT/Session）
- **阻塞/风险**：Auth 未接入前，`CurrentUser` 仍会回退到 `TEMP_USER_ID`（技术债，见下）
- **最后更新时间**：2026-05-13

---

## 1. 总里程碑（按课程要求对齐）

- [x] **阶段 1（后端基座）**：Next.js App Router API + MongoDB + `/api/anime` CRUD + **OpenAPI / Swagger UI** + **Contract Testing**（`anitrack-tester/contract-validator`）
- [x] **阶段 2（后端重构与测试）**：**100% Completed**（NestJS 平移 + 双表 Ownership 拆分 + heatmap 测试/契约对齐）
- [x] **阶段 3（Jikan 搜索集成 & 前端对接）**：建立前端 API 基座 → 接入 Jikan 搜索/读取 → 前端联调（闭环跑通）
- [x] **阶段 4（架构重构与页面扩展）**：多页面路由 `/`、`/library`、`/profile` + 公用组件拆分 + 后端分页/CurrentUser 抽象
- [x] **阶段 5（深度交互与搜索体验进化）**：Jikan 搜索分页 + debounce + 全局单实例 Dialog 编辑 + Profile 热图与统计卡片

---

## 2. 阶段 1：后端基座（已完成）

### 2.1 项目骨架
- [x] 初始化 Next.js（App Router）
- [x] 目录结构确定（`app/api/**`、`lib/**`、`models/**` 等）
- [x] 环境变量约定（`MONGODB_URI` 等；本地使用 `anitrack/.env.local`）

### 2.2 MongoDB 连接
- [x] 连接模块（可复用、可在 dev 下复用连接）
- [x] 开发连接验证（MongoDB Atlas + `mongo-check` / API 预检通过）

### 2.3 数据模型（MongoDB Schema）
- [x] `AnimeEntry` schema：字段与索引（含 `completedDates`）
- [x] 基础校验（status 枚举、rating 范围、日期格式；Zod + 路由层）

### 2.4 `/api/anime` CRUD
- [x] `GET /api/anime`（支持 status filter / pagination 基础版）
- [x] `POST /api/anime`
- [x] `GET /api/anime/{id}`
- [x] `PATCH /api/anime/{id}`（含状态机校验与 `COMPLETED` 时日期维护）
- [x] `DELETE /api/anime/{id}`
- [x] 错误返回结构统一（validation / not found / conflict；含 `INVALID_STATUS_TRANSITION` → 409）

### 2.5 OpenAPI（最小可交付）
- [x] 列出 endpoints（anime + heatmap）
- [x] 定义 request/response schema（与实现一致）
- [x] 明确错误体与状态码

### 2.6 外部 API 契约脚本（补充，非课程硬性交付物）
- [x] `anitrack-tester/api-test-suite`：`run-all.js` 一键跑通（smoke：状态机 + `completedDates` 副作用 + 删除；batch：分页结构）
- [x] `anitrack-tester/contract-validator`：`npm run contract` — AJV+SwaggerParser 校验 OpenAPI；冒烟比对路径、AnimeEntry 键、`pageSize` 上限、非法 PATCH→409 与 `ApiErrorBody`（`CONTRACT_PENDING_PATHS` 默认为空；未实现路径可手动加入逗号列表以降级为警告）

---

## 3. 阶段 2：逻辑与测试（已完成）

### 3.1 Heatmap 后端逻辑
- [x] 数据提取：筛选 `status=COMPLETED`，读取 `completedDates`
- [x] 计数聚合：按天 count（MongoDB **Aggregation Pipeline**：`$match` → `$unwind` → **`$addFields` 日期 Normalization**（`$dateToString` / `$trim`）→ 闭区间 `$match` → `$group`）
- [x] **混合类型修复**：历史或驱动层导致的 **BSON `Date` / `string` 混存** 不再使 `$gte`/`$lte` 静默失败（曾表现为 **count 全 0**）
- [x] （历史/遗留）按天绿墙：曾输出 `weeks -> days`（`from/to`），作为阶段 2 的聚合与类型兼容性验证
- [x] （现行）`GET /api/stats/heatmap`：升级为“人生纸格（月）”，支持 `start/end=YYYY-MM`，返回 `months[]`（added/completed/episodes + intensity）

### 3.2 单元测试（Unit）
- [x] 强度映射与周结构：`src/lib/__tests__/heatmap-calc.test.ts`（Vitest）

### 3.3 集成测试（Integration，Vitest）
- [x] `npm run test:integration`：`src/__tests__/integration/heatmap.integration.test.ts`（断言 Next.js `app/api/stats/heatmap` 已变为 **NestJS 代理**：转发 `start/end/tz` 并返回 `{ start,end,months[] }`）
- [x] Case C：heatmap 参数错误（400 + 错误体）已补齐（`start > end`、非法 `tz`），并在 NestJS e2e/smoke 中覆盖

### 3.4 自动化播种与契约回归
- [x] **`heatmap-seeder.js`**：`api-test-suite` 下约 20 条 COMPLETED 播种；不清库；冲突重试；播种成功提示
- [x] **Contract Testing**：`run-contract-test.js` 在 **`CONTRACT_PENDING_PATHS` 为空（严格模式）** 下与 `swagger.json`、运行时行为对齐（含 `/api/stats/heatmap` 路径存在性）

---

## 4. 阶段 3：前端渲染（TODO）

### 4.0 数据库重构（Ownership / 双表拆分）
- [x] 新增 `AnimeMeta`（公有元数据缓存）：以 `malId` 作为全局唯一键，缓存 Jikan 元数据（cache-aside）
- [x] 重构 `AnimeEntry`（用户私有进度）：仅保留 `userId + malId + status/completedDates` 等个性化字段
- [x] `AnimeEntry` 复合唯一索引：`(userId, malId)`（允许不同用户拥有各自的同名条目）
- [x] 列表/详情返回结构：`AnimeEntry` 中嵌套 `animeMeta`（前端展示更干净）
- [x] `Stats/heatmap` 聚合：首个 `$match` 带 `userId=TEMP_USER_ID`

### 4.1 UI 基础
- [ ] Tailwind 配置
- [x] 主页面原型（桌面端优先）：搜索 + 添加 + “我的清单”卡片网格（4 列）

### 4.2 Watchlist
- [x] 列表渲染（最小版）：`GET /api/anime` 拉取并以卡片网格展示
- [x] 创建交互（最小版）：从搜索结果 “添加” → `POST /api/anime { malId }`
- [ ] CRUD 完整交互：编辑/删除/状态迁移 UI（下一步）

### 4.3 Heatmap（绿墙）
### 4.3 人生纸格（月 Heatmap）
- [x] 拉取 `/api/stats/heatmap?start=YYYY-MM`
- [x] 年-月坐标系：纵轴 12 行（Jan–Dec），横轴年份列（起始年→当前年），支持起始偏移与“未来月份解锁”
- [x] 悬停提示：GitHub 风格浮动 Tooltip（`pointer-events: none`）展示 added/completed/episodes
- [x] 点击锁定：选中格子高亮（`ring-2 ring-blue-500`），下方展示 “Activity for YYYY-MM”（Added/Completed 时间轴列表）
- [x] Activity 后端化：新增 `GET /api/stats/activity?month=YYYY-MM`，前端不再全量拉取再过滤（Profile 页点击月份 → 拉取该月 Added/Completed 列表）
- [x] Legend：为 intensity 0-4 增加颜色图例

### 4.4 Seasonal Schedule（Jikan）
- [ ] 后端可选 `GET /api/anime-meta/schedule`：若需要「纯 Jikan 放送表」视图，可作为与现行 Bangumi 驱动 Timetable **并存**的第二条读路径（需缓存与 429 策略）
- [ ] 前端可选 `/schedule` 页面：按周一到周日分组展示（与 `/timetable` 按日历分列不同）

### 4.5 Jikan 搜索中转 & 自动化入库（本次会话新增）
- [x] `GET /api/anime-meta/search?q=...`：后端调用 Jikan V4 Search（limit=5）
- [x] 搜索结果写入 `AnimeMeta`：bulk upsert（按 `malId` 唯一键），并去重保持顺序
- [x] 429 限流处理：上游 429 → 后端 429（`UPSTREAM_RATE_LIMIT`）
- [x] “柔性模式”：`POST /api/anime` 中抓取/读取 `AnimeMeta` 失败不阻断创建，`animeMeta=null` 并记录错误日志

### 4.6 Dashboard（The Pulse，计划）
- [x] 激活 Profile & Stats：新增 `GET /api/stats/summary`，Dashboard 顶部展示总量/完成/评分等指标
- [x] Watching Now：横向滚动流 + onWheel 劫持（区块内垂直滚轮映射为水平滚动），卡片统一 `aspect-[2/3]`、封面 `h-48 object-cover`、进度条
- [x] Watching Now 卡片可点击：复用 `AnimeEntryDialog` 编辑进度/状态/评分
- [x] Dashboard「新番随机推荐」：`GET /api/anime-meta/seasonal-random` 从 `AnimeMirror`（`tier=seasonal`）`$sample` 抽样，**读路径不调用 Jikan**；前端换一批 + 加入清单（Sonner 成功/重复/错误提示）
- [ ] 推荐增强（可选）：每日个性化 / Library 标签加权等

### 4.7 Timetable（新番时间表）
- [x] 后端：`GET /api/anime-meta/timetable?days=` — `AnimeMirror`（`tier=seasonal`，已映射 `bgmId` + `bangumi.weekday`）按柏林日历日分列；东京墙钟 → `Europe/Berlin`（`timetable.util`）；条目含 `synopsisEn`/`synopsisJa`（Jikan 镜像）、`episodeLabel: "Seasonal"`、标题英文优先
- [x] 后端：`normalizeBangumiWallClock`（`HH:mm` / `HHmm`）+ 写入/读取链路；**仍有不少条目无 `airTimeLocal`（前端 TBD）** — **暂缓专项**
- [x] 前端：`/timetable` 真实数据、横向日期列、7/14 天、点击 **`TimetableItemDetailDialog`**（修复 Bangumi ID 展示）；追更 `POST /api/anime`；已移除「番剧索引」占位
- [ ] **后续**：可靠播出钟点（上游 enrich、或备选数据源）

### 4.8 Bee（Anime Mirror System，后台镜像同步）
- [x] 新增 `Bee` 模块：`src/modules/bee/*`（Cron + 受控速率抓取）
- [x] 新增集合 `AnimeMirror`：`malId(unique) + data(JSON) + lastUpdated + source + tier + priority`
- [x] 新增集合 `BeeState`：用于“季度回滚补漏”的断点游标（重启继续）
- [x] Cron 节奏：每 65 秒执行一次，每次同步 3 个条目（礼貌抓取，带 User-Agent）
- [x] 断点续爬：基于 `lastUpdated` 选择缺失/过期条目，重启后从 DB 状态继续
- [x] 数据保鲜（按 tier）：seasonal 7 天 / top40 30 天 / top100 60 天 / top200 180 天 / backfill 60 天
- [x] 多级优先级：seasonal ＞ top40 ＞ top100 ＞ top200 ＞ 季度回滚 backfill（全部跑满后才启动回滚）
- [x] 读路径适配：`AnimeMetaService.getOrFetchByMalId` 先查 mirror（fresh 命中则落 `AnimeMeta`），miss 时再走 Jikan，并被动 enqueue general
- [x] **Bangumi**：`tryBangumiMapSeasonal` + `enrichBangumiSubject` — 日历匹配写入 `bgmId` / `titles` / `bangumi.weekday` / `airTime`（规范化）；时间表依赖此数据链
- [x] 推荐读路径：`AnimeMirror` 当季随机抽样接口（见上 4.6），与 `getOrFetchByMalId` 的 Mirror-first 互补
- [x] 开关：`SYNC_ENABLED=true` 时启动后自动 seed `/seasons/now` 并开始静默同步（控制台输出进度）
- [x] Seed 重试：每 30 分钟低频重试播种 top tiers（upsert，不会重复写入），避免启动时短暂 429 导致 tier 不完整
- [x] 手动触发/排障：
  - `GET /api/bee/status`：查看 tiers 进度 + `backoffUntil`
  - `POST /api/bee/seed-step`：在 backoff 结束后，手动触发一次轻量播种（只播种一档）
  - `POST /api/bee/sync-step?batchSize=3`：手动触发一次同步 batch

---

## 5. 决策记录（ADR / Decisions）

> 写清楚“为什么这么做”，避免后续来回推翻。

- 2026-04-20：Heatmap 强度阈值（Draft）：0→0，1→1，2→2，3-4→3，5+→4（可调整）
- 2026-04-20：日期格式统一为 `YYYY-MM-DD`（便于统计与时区处理）

---

## 6. 问题清单（Open Questions）

- [ ] 是否需要登录/鉴权？（课程若不要求，可先单用户模式；多用户见 Blueprint **§3.10**）
- [x] Jikan：已落地 **AnimeMeta Cache-Aside（Blueprint §3.8）**，并在创建条目时按 `malId` 自动抓取/缓存元数据
- [x] Heatmap `from/to` 默认范围：**已实现**为「`to`= 指定 `tz` 的日历今天，`from` = `to` 往前 365 日」（闭区间）

---

## 7. 变更日志（Changelog）

- 2026-04-20：创建 `PROJECT_BLUEPRINT.md` 与本文档 `TASK_PROGRESS.md`
- 2026-04-20：MongoDB Atlas 接入（`.env.local`）；`/api/anime` 经外部脚本 `anitrack-tester/api-test-suite/run-all.js` 全绿；修复 `PATCH` 在仅传 `status` 时误触发 `completedDates` 默认值的校验问题（见 Blueprint「实施进度快照」）
- 2026-04-20：新增 `public/swagger.json`（anime CRUD + heatmap 契约）与 `/api-docs`（`swagger-ui-dist`），本地可 Try it out
- **2026-04-20（阶段 2 收口）**：攻克热力图 **MongoDB `Date` / `string` 混合类型** 在 **Aggregation Pipeline** 中与查询边界比较失效的问题（通过 **`$unwind` 后 Normalization** + `$dateToString` 等）；**Vitest** 单测 + 集成测试落地；`heatmap-seeder.js` 与 **Contract Testing**（`anitrack-tester/contract-validator`）在严格模式下与 OpenAPI 契约 **100% 对齐**（运行时冒烟全绿）
- **2026-04-22（架构平移）**：后端从 Next.js Route Handlers 平移至 **NestJS**（端口 `3001`，全局前缀 `/api`，Swagger UI `/api-docs`）；`/api/anime` CRUD + `/api/stats/heatmap` 聚合逻辑已迁移并保持字段名不变；契约测试默认指向 `3001`（NestJS 作为主 API 供应方）
- **2026-04-22（Ownership 拆分）**：引入双表：`AnimeMeta`（公有缓存）与 `AnimeEntry`（用户私有进度）；`POST /api/anime` 仅需 `malId`；响应中嵌套 `animeMeta`；`Stats/heatmap` 加入 `TEMP_USER_ID` 过滤；契约测试与 e2e 全绿
- **2026-04-29（阶段 3 闭环 + UI 原型成品化）**：
  - 后端新增 `GET /api/anime-meta/search?q=...`：Jikan 搜索中转 + **bulk upsert** 写入 `AnimeMeta`（去重、保持顺序）
  - 429：上游限流返回 429（`UPSTREAM_RATE_LIMIT`）
  - `POST /api/anime`：引入“柔性模式”，meta 抓取失败不阻断写入，响应 `animeMeta=null`
  - 前端：`page.tsx` 原型页完成“搜索→添加→我的清单”闭环，并做桌面端卡片网格布局（4 列）与状态配色 badge

- **2026-04-29（阶段 4–5 里程碑：多页 + 深交互 + Profile）**：
  - 前端：完成多页面路由 `/`（Dashboard）、`/library`（管理）、`/profile`（用户中心）；抽出 `TopNav/AppShell/AnimeCard/Pagination` 等组件
  - 后端：`GET /api/anime` 增强分页返回 `totalPages`，并支持 sort 白名单（`updatedAt/createdAt/rating`）
  - 后端：引入 `@CurrentUser()`（dev fallback 仍为 `TEMP_USER_ID`），清理业务层散落的 userId 读取
  - 后端：`GET /api/anime-meta/search` 支持 `page/pageSize`，并返回 Jikan `pagination`（完整透传）
  - 后端：`AnimeMeta` 扩字段 `synopsis/genres(string[])/totalEpisodes`；`AnimeEntry` 新增 `episodesWatched`
  - 前端：搜索体验升级（debounce 500ms + Enter 立即搜 + 分页器）；搜索结果中已存在条目显示“已在清单”；新增“智能提示 Banner + 搜索建议标签”（面向大型系列，如 Love Live）
  - 前端：Library 采用“全局单实例 Dialog”编辑条目（status/rating/episodesWatched）+ 删除；所有写操作统一 `invalidateQueries(["anime"])`
  - 前端：`/profile` 从“过去一年日历绿墙”升级为“人生纸格（月）”，支持自定义起始月份（先以 `START_DATE` 常量占位），并提供悬停详情（added/completed/episodes）
  - 前端：热力图进一步重构为“年(横轴)×月(纵轴)”坐标系 + 浮动 Tooltip + 点击 Activity 列表；Next.js `app/api/stats/heatmap` 统一为 NestJS 代理

- **2026-05-07（The Pulse 增量交付）**：
  - 后端：新增 `GET /api/stats/activity?month=YYYY-MM`（月度 Activity 聚合）与 `GET /api/stats/summary`（Profile/Dashboard 顶部指标）
  - 后端：引入 NestJS `CacheModule`，Jikan 请求统一缓存 24h（彻底缓解 429）
  - 后端：补齐 heatmap 参数校验 e2e（`start > end`、非法 `tz` → 400 错误信封）
  - 后端：新增 Bee 镜像系统（Cron 受控速率抓取 Jikan → Mongo `AnimeMirror`），并在 `AnimeMetaService` 中实现 Mirror-first
  - 前端：Dashboard “正在观看”改为横向滚动流 + onWheel 映射；AnimeCard 统一比例与进度条；卡片可点击打开编辑 Dialog
  - 前端：Profile Heatmap 增加 Legend；Activity 面板改为后端接口驱动
  - 前端：新增 `/timetable` 页面骨架（后于 **2026-05-13** 接真实 `GET /api/anime-meta/timetable`）；Dashboard 底部「新番随机推荐」后接 `seasonal-random`

- **2026-05-13（Timetable 真实数据 + 文档同步）**：
  - 后端：`GET /api/anime-meta/timetable` — Bangumi 星期驱动 + 柏林时区；`normalizeBangumiWallClock`；条目 `synopsisEn`/`synopsisJa`、英文优先 `title`
  - 前端：`/timetable` 接 API；详情 Dialog；移除「番剧索引」
  - **暂缓**：多数条目 **播出钟点 TBD**（`airTimeLocal`），待后续数据源/策略；`PROJECT_BLUEPRINT` / `README` / 本文档已记录

- **2026-05-13（Dashboard 当季推荐：Mirror-only）**：
  - 后端：`GET /api/anime-meta/seasonal-random?limit=` — 对 `AnimeMirror` 中 `tier=seasonal` 且已写入 `data` 的文档做 MongoDB `$sample`，映射为 `AnimeMeta` 形状；**该接口不发起 Jikan HTTP**
  - 前端：Dashboard「新番随机推荐」对接上述接口；换一批 / 加入清单；Sonner 提示（含重复添加 `toast.info`）

---

## 9. 技术债务（Tech Debt）

- **TEMP_USER_ID**：仍作为 dev fallback 存在；但已通过 `@CurrentUser()` 装饰器集中收口。接入 Auth 后应把 `CurrentUser` 的来源替换为 token/session 注入的真实 user id
- **Timetable `airTimeLocal`**：大量条目仍为 **TBD**（Bangumi/Jikan 侧播出字段不完整或映射未覆盖）；已做 `airTime` 字符串规范化，**完整排钟待专项**
- **索引迁移风险**：旧集合上可能残留 `{ malId: 1 } unique` 索引会阻止新结构插入  
  - 已在服务启动时调用 `this.animeEntryModel.syncIndexes()`（无 DB 时跳过）  
  - 若 Atlas 上仍异常，建议在网页端 **Drop `animeentries` collection** 后重启，让新索引干净重建

---

## 8. 随手备注（Scratchpad）

- `api-test-suite/heatmap-seeder.js`：约 20 条 COMPLETED 播种（2026-04-11～19 分布），用于热力图联调
- （把杂七杂八的想法先丢这里，后续再搬运到 Blueprint / 任务清单）

---

## 10. 测试/排障速查（Runbook）

> 目标：项目“哪里坏了”时，快速知道该跑哪一条命令定位问题。

### 10.1 后端（NestJS）测试

目录：`anitrack/anitrack-backend/`

- `npm test`：Jest（包含 e2e/smoke）
  - `test/app.smoke-spec.ts`：mock `AnimeMetaService` + 可用内存 Mongo（不依赖 Jikan）

### 10.2 前端（Next.js）测试

目录：`anitrack/`

- `npm test`：Vitest 单测（heatmapCalc 等）
- `npm run test:integration`：Vitest 集成（需要 `MONGODB_URI`，由 `vitest.integration.config.ts` 读取 `anitrack/.env.local`）

### 10.3 契约/HTTP 冒烟工具

目录：`anitrack-tester/`

- `contract-validator/`：`npm run contract`（swagger 结构 + HTTP 契约冒烟；默认指向 NestJS `3001`）
- `api-test-suite/`：
  - `node run-all.js`：HTTP smoke + batch（注意 `BASE_URL` 默认 `http://localhost:3000/api`；直连 NestJS 时请改为 `http://localhost:3001/api`）
  - `node heatmap-seeder.js`：热力图播种（不清库、可重复跑）

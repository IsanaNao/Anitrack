# Anitrack — 任务进度 & 备注（Working Log）

> 目的：让“当前做到哪里了、下一步做什么、卡点是什么、做过哪些决定”一眼可见。  
> 约定：每次变更/讨论后，至少更新 **当前状态** 和 **下一步**。

---

## 0. 当前状态（每次更新这里）

- **当前阶段**：**课程规划内的核心功能已全部交付**；当前仓库处于「可演示 / 可交付」状态
- **增量阶段（锦上添花）**：Auth、推荐算法、纯 Jikan Schedule 第二视图 — **非硬性**；**整站双语（§4.9）**、**清单 Bangumi 按需映射**、**响应式设计（§4.11）** 已完成
- **正在做**：—（本阶段增量 UI 已收口）
- **下一步（按兴趣选做）**：见 **§11**；**下次启动项目**见 **§12 备忘**（架构图 + 功能示意图）
- **阻塞/风险**：无课程级阻塞；**`TEMP_USER_ID`** 在接入 Auth 前仍为技术债（见 §9）
- **最后更新时间**：2026-05-21（响应式验收通过；文档与检阅收尾）

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
- [x] **Contract Testing**：`run-contract-test.js` 在 **`CONTRACT_PENDING_PATHS` 为空（严格模式）** 下与 `anitrack-backend/swagger.json`、运行时行为对齐（含 `GET /api/stats/heatmap` 及 Bee / `anime-meta` 的 **GET** 路径存在性）

---

## 4. 阶段 3：前端渲染（**核心项：已完成**；下列勾选为历史清单）

### 4.0 数据库重构（Ownership / 双表拆分）
- [x] 新增 `AnimeMeta`（公有元数据缓存）：以 `malId` 作为全局唯一键，缓存 Jikan 元数据（cache-aside）
- [x] 重构 `AnimeEntry`（用户私有进度）：仅保留 `userId + malId + status/completedDates` 等个性化字段
- [x] `AnimeEntry` 复合唯一索引：`(userId, malId)`（允许不同用户拥有各自的同名条目）
- [x] 列表/详情返回结构：`AnimeEntry` 中嵌套 `animeMeta`（前端展示更干净）
- [x] `Stats/heatmap` 聚合：首个 `$match` 带 `userId=TEMP_USER_ID`

### 4.1 UI 基础
- [x] Tailwind：全局 `globals.css` + 各页 utility 已贯穿（无单独「再配一遍 tailwind.config」任务）
- [x] 主页面原型（桌面端优先）：搜索 + 添加 + “我的清单”卡片网格（4 列）

### 4.2 Watchlist
- [x] 列表渲染（最小版）：`GET /api/anime` 拉取并以卡片网格展示
- [x] 创建交互（最小版）：从搜索结果 “添加” → `POST /api/anime { malId }`
- [x] CRUD 完整交互：Library **全局 Dialog** 编辑/删除/状态迁移 + `invalidateQueries(["anime"])`

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
- [x] 后端：`GET /api/anime-meta/timetable?days=` — 当季 `AnimeMirror`；**星期**优先 `bangumi.weekday`，否则 **Jikan `broadcast.day` / `string`**；柏林日历列 + 东京墙钟 → `Europe/Berlin`；未映射 Bangumi 时 **`bgmId` 可为 `0`**
- [x] 后端：`normalizeBangumiWallClock` + `airDate` / `broadcast` 兜底；**仍有不少条目无 `airTimeLocal`（前端 TBD）** — **数据侧暂缓**，非 UI 截断
- [x] 前端：`/timetable` 真实数据、横向日期列、7/14 天、列 **`items-start`** 全量列表；**`TimetableItemDetailDialog`**；追更 `POST /api/anime`；已移除「番剧索引」占位
- [ ] **后续（可选）**：更强 enrich、第三方放送表、或接受部分 **TBD / 缺列**（见 Blueprint §10.5）

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

### 4.9 整站双语切换（UI 国际化）— **已完成（2026-05-21）**

**原理（简要）**

1. **两层语言**：**壳层**（按钮、导航、Toast）走 `t('key')` 词典；**作品**（标题、简介）走 `pickAnimeTitle` / `pickAnimeSynopsis`，按当前 `locale` 在 API 返回的多语言字段中选主显示串。
2. **数据从哪来**：Jikan 提供 `title` / `synopsis` 等；Bee 映射 Bangumi 后，镜像上带有 `titles.cn` 与 `bangumi.summaryCn`，后端读时 **`attachMirrorI18n`** 合并进响应（清单、当季推荐、时间表）。
3. **清单老番按需映射（2026-05-21 增补）**：当季以外条目原先只有 Jikan 英文/罗马字标题。读清单时 **`findByMalIds`** **后台**触发缺 `titleCn` 的 `malId`（每批最多 8 个，不阻塞「加载中」）→ **`BeeService.ensureBangumiMappingForMalId`**（Bangumi v0 **POST** `search/subjects` + subject），写入 `AnimeMirror.titles` 并持久化 **`AnimeMeta.titleCn`**。终端日志 **`[i18n-map]`**。手动批量：`POST /api/bee/map-mal-ids?malIds=8861,38000`（已写入 **`swagger.json`**）。
4. **为何不绑路由**：用 `I18nProvider` + `localStorage`，避免改动 App Router；与课程「API-First、前端只渲染」一致。

- [x] **文案抽离**：`src/i18n/messages/{zh,en}.ts` + `I18nProvider` / `useI18n()`；覆盖导航、各页区块、Dialog、Sonner、分页与状态筛选等
- [x] **语言切换 UX**：`TopNav` 内 **`LanguageSwitcher`**（中 / EN）；偏好 **`localStorage`**（`anitrack.locale`），并同步 `document.documentElement.lang`
- [x] **作品展示语言**：`anime-display.ts` + `useAnimeDisplay()`；后端 `AnimeMetaService` 在 `findByMalIds` / `getOrFetchByMalId` / `seasonal-random` / `timetable` 附带 `titleCn`、`synopsisCn` 等可选字段
- [x] **清单 Bangumi 按需映射**：`BangumiService.searchSubjectsCached`；`BeeService.ensureBangumiMappingForMalId`；`AnimeMeta` 持久化 `titleCn` / `titleJp` / `titleEn` / `synopsisCn`

### 4.11 响应式设计 — **已完成（2026-05-21）**

**原理（简要）**

1. **移动优先 + 断点增强**：Tailwind `sm` / `md`；`viewport` + 安全区；窄屏不依赖横向撑满视口。
2. **时间表**：统一为顶部可滑日期条（`pastDays=14` & `futureDays=14`），单日列表；桌面与手机同一交互。
3. **卡片**：`AnimeCard` 的 `density="compact"` 保证仪表盘双列/横滑时**标题 + 进度**可见。
4. **热力图**：固定列宽网格 + `overflow-x-auto` + 月份列 `sticky`，避免溢出卡片。

- [x] **`viewport`** + 安全区内边距（`AppShell` / `TopNav`）
- [x] **移动端导航**：`TopNav` 汉堡菜单（`md+` 横排链接）
- [x] **Dashboard / Library**：区块头与工具栏小屏纵向堆叠；`AnimeCard` compact；分页换行
- [x] **时间表**：横向日期条 ±2 周；移除 7/14 天切换；「现在」时间线
- [x] **档案热力图**：固定列宽 + 横向滚动 + sticky 月份列
- [x] **构建验收**：`anitrack` 与 `anitrack-backend` 的 `npm run build` 通过（2026-05-21）

**可选后续**：真机抽查（iOS Safari / Android Chrome）与 Dialog 触控间距微调。

### 4.10 Swagger Bee POST + 契约按方法冒烟 + 期末会考考点（2026-05-21）

- [x] **`swagger.json`**：补充 **`POST /api/bee/seed-step`**、**`POST /api/bee/sync-step`**（含 query）、**`POST /api/bee/bangumi-map`**、**`POST /api/bee/map-mal-ids`**；`AnimeMeta` 增加 `titleCn` 等可选字段；修正 `GET /api/bee/bangumi-mapping` 响应 schema
- [x] **`contract-smoke-test.js`**：对每条 path 的 **get/post/…** 分别探测；Bee `sync-step` 冒烟使用 `?batchSize=1`；**429** 记警告；**404+JSON** / **204** 视为端点存在（修复 `{id}` 路径误报）

**期末会考 · Promise 与 Bootstrap（检阅结论）**

| 考点 | 仓库中是否有 | 位置 / 说明 |
|------|----------------|-------------|
| **Bootstrap（Nest 启动）** | **有** | `anitrack-backend/src/main.ts`：`async function bootstrap()` 创建应用、挂全局管道、加载 Swagger、`listen` |
| **Bootstrap（CSS 框架）** | **无** | 样式为 Tailwind；未引入 bootstrap.min.css |
| **Promise / async-await** | **有（广泛）** | 前端 `src/lib/api.ts` `fetcher`；各页 `async` 处理函数；React Query；后端 Bee/Stats 的 `Promise.all`、限流 `new Promise`+`setTimeout` |
| **建议补强（可选）** | — | Dashboard 用 **`Promise.all`** 并行拉 summary + watching 列表并写进文档示例；或 `/api` 健康检查页演示启动链 |

---

## 5. 决策记录（ADR / Decisions）

> 写清楚“为什么这么做”，避免后续来回推翻。

- 2026-04-20：Heatmap 强度阈值（Draft）：0→0，1→1，2→2，3-4→3，5+→4（可调整）
- 2026-04-20：日期格式统一为 `YYYY-MM-DD`（便于统计与时区处理）
- 2026-05-21：**i18n 双层解耦** — UI 词典与作品字段优先级分离；不引入 `next-intl` 路由 locale；Bangumi 中文依赖镜像映射率（搜索路径仍可能仅英文标题）
- 2026-05-21：**Swagger 含 Bee POST** — 契约冒烟改为按 OpenAPI 方法探测，避免 POST 路由被误 GET

---

## 6. 问题清单（Open Questions）

- [x] **整站双语切换**：见 **§4.9**（已完成）
- [ ] 是否需要登录/鉴权？（课程若不要求，可先单用户模式；多用户见 Blueprint **§3.10**）
- [x] Jikan：已落地 **AnimeMeta Cache-Aside（Blueprint §3.8）**，并在创建条目时按 `malId` 自动抓取/缓存元数据
- [x] Heatmap `from/to` 默认范围：**已实现**为「`to`= 指定 `tz` 的日历今天，`from` = `to` 往前 365 日」（闭区间）

---

## 7. 变更日志（Changelog）

- 2026-04-20：创建 `PROJECT_BLUEPRINT.md` 与本文档 `TASK_PROGRESS.md`
- 2026-04-20：MongoDB Atlas 接入（`.env.local`）；`/api/anime` 经外部脚本 `anitrack-tester/api-test-suite/run-all.js` 全绿；修复 `PATCH` 在仅传 `status` 时误触发 `completedDates` 默认值的校验问题（见 Blueprint「实施进度快照」）
- 2026-04-20：新增 **`anitrack-backend/swagger.json`**（初期为 anime CRUD + heatmap；后随 Bee / 时间表扩展 **GET** 路径）；早期若存在 `public/swagger.json` 为历史对照，**主契约以后端 3001 为准**
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
  - 前端：Dashboard「新番随机推荐」对接上述接口；换一批 / 加入清单；Sonner 提示（含重复添加 `toast.info`）；卡片可点开 **`SeasonalPickDetailDialog`**

- **2026-05-13（文档与 OpenAPI 增量）**：
  - `PROJECT_BLUEPRINT.md`：§1.2 / §3.8.5–3.8.6 / §3.9.12（`sync-step` 查询参数）/ §7.2 Dashboard 详情 / §9–§10 与 **3001** Swagger 源文件路径对齐
  - `README.md`、`TASK_PROGRESS.md`：契约说明、当季推荐详情 Dialog
  - `anitrack-backend/swagger.json`：补充 **`GET /api/bee/status`**、**`GET /api/bee/bangumi-mapping`**、**`GET /api/anime-meta/seasonal-random`**、**`GET /api/anime-meta/timetable`**（与契约冒烟 **GET-only** 策略一致；**POST** 端点仍以 Blueprint 为准）

- **2026-05-21（Swagger Bee POST + 契约 + 期末会考笔记）**：
  - `swagger.json`：Bee POST 三端点 + schema；`contract-smoke-test.js` 按方法冒烟
  - 文档：§4.10 Promise/Bootstrap 检阅表（**有 bootstrap 启动函数；无 CSS Bootstrap**）

- **2026-05-21（整站双语 i18n + 三份文档同步）**：
  - 前端：`I18nProvider`、`LanguageSwitcher`、各主页面与 Dialog / Toast 文案双语；番剧标题与简介按 UI 语言从 `titleCn`/`titleEn`/`synopsisCn` 等字段选取
  - 后端：`AnimeMetaService` 读路径从 `AnimeMirror` 合并多语言标题与 Bangumi 中文简介（清单、当季推荐、时间表）
  - 文档：`PROJECT_BLUEPRINT.md` 新增 **§7.5**；`README.md` 路线图与特性；本文 **§4.9** 原理说明

- **2026-05-21（清单 Bangumi 按需映射 + 响应式收口）**：
  - 后端：`BangumiService.searchSubjectsCached`（**POST**）；`ensureBangumiMappingForMalId`；`POST /api/bee/map-mal-ids`；`AnimeMeta.titleCn` 持久化；日志 `[i18n-map]`
  - 前端：响应式（汉堡导航、时间表日期条 ±2 周、`AnimeCard` compact、热力图横向滚动）；仪表盘文案「已看完」等审校
  - 文档：§4.11 完成；§12 下次启动备忘（架构图/功能图）；`swagger.json` 更新

- **2026-05-14（文档：核心闭环 vs 锦上添花）**：
  - `PROJECT_BLUEPRINT.md`：§1.2 / §3.8.6 / §3.9.11 / §7.2 Timetable 与实现对齐；§8 阶段 3 标为已完成；**新增 §10.5**（未开发 / 建议开发 / 建议放弃）
  - `README.md`：里程碑说明、路线图阶段 5+ 改为可选、**后续增量**小表、修正 Bee Runbook 代码块 `PowerShell`、Timetable 描述（Jikan 星期兜底、`bgmId=0`）
  - `TASK_PROGRESS.md`：§0 当前状态、§4.1/4.2/4.7 勾选与表述；**新增 §11**


## 9. 技术债务（Tech Debt）

- **TEMP_USER_ID**：仍作为 dev fallback 存在；但已通过 `@CurrentUser()` 装饰器集中收口。接入 Auth 后应把 `CurrentUser` 的来源替换为 token/session 注入的真实 user id
- **Timetable `airTimeLocal`**：大量条目仍为 **TBD**（Bangumi/Jikan 侧播出字段不完整或映射未覆盖）；已做 `airTime` 字符串规范化，**完整排钟待专项**
- **OpenAPI 与冒烟策略**：`swagger.json` 已含 Bee **GET + POST**；契约冒烟按 path 下声明的 **HTTP 方法** 探测（Bee POST 可能 **429**，记警告）
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

---

## 11. 核心已交付 vs 锦上添花（与 Blueprint §10.5 对齐）

> **核心（课程启动期望）**：已在仓库闭环 — Watchlist CRUD、统计/热力图/Activity、Jikan 搜索 + `AnimeMeta`、Bee `AnimeMirror`、Dashboard / Library / Profile、当季随机推荐 + 详情 Dialog、Timetable（Bangumi 为主 + Jikan 星期兜底）、契约测试与后端 Jest 基线。

| 分类 | 说明 |
|------|------|
| **尚未开发（可选）** | **Auth / 多用户**（§6）；**推荐个性化**（§4.6 未勾选项） |
| **建议开发（性价比高）** | 页脚/空态里解释 **TBD、`bgmId=0`**；统一间距；URL 级 locale（可选） |
| **建议放弃或长期搁置** | **Timetable 零 TBD / 全映射**（数据专项）；**独立纯 Jikan `/schedule` 全站周视图**；**过早全自动 OpenAPI 生成** |
| **保持现状** | 单用户 `TEMP_USER_ID`；Bee 65s/3 条；柏林时区时间表 ±2 周日期条；作品标题按 UI 语言择优（§4.9）；**响应式布局**（§4.11） |

详细表格式叙述以 **`PROJECT_BLUEPRINT.md` §10.5** 为准（本表为速查）。

---

## 12. 下次启动备忘（架构图 & 功能示意图）

> **触发时机**：下次重新打开本仓库、准备答辩/文档/演示材料时，优先做**图示**，不必再大块改功能代码（除非 §11 可选项）。

### 12.1 建议交付物

| 图示 | 建议内容 | 可参考文档 / 代码 |
|------|----------|-------------------|
| **架构图（Architecture）** | 浏览器 → Next.js `3000` → NestJS `3001` → MongoDB；Bee 定时任务 → Jikan / Bangumi；`AnimeMeta` vs `AnimeEntry` vs `AnimeMirror` | `PROJECT_BLUEPRINT.md` §3、§3.8–3.9 |
| **功能示意图（Feature / User Flow）** | 四页用户路径：Dashboard / Timetable / Library / Profile；搜索→加入清单→编辑→热力图点击 | `README.md` 核心特性、各 `app/(main)/*` |
| **数据流（可选）** | `malId` 写入 → `AnimeMeta` 缓存；Bangumi 按需映射 `[i18n-map]`；时间表 `pastDays/futureDays` | `TASK_PROGRESS.md` §4.9、§4.11 |

### 12.2 制图工具（任选）

- **Mermaid**（可写在 Blueprint / README 附录，随仓库版本管理）
- **draw.io / Excalidraw / Figma**（导出 PNG/SVG 放进 `docs/` 或课程报告目录）
- 若课程要求 C4：补一张 **Context + Container** 即可，不必过度细化

### 12.3 启动项目检查清单（图示工作前）

1. `anitrack-backend`：`npm run start:dev`（`3001`）+ `anitrack`：`npm run dev`（`3000`）
2. 确认 `.env` / `.env.local` 含 `MONGODB_URI`、`SYNC_ENABLED=true`
3. 浏览器走查四页（**中文 + 英文**各一遍）：`/ · `/timetable` · `/library` · `/profile`
4. 可选：`cd anitrack-tester/contract-validator && npm run contract`（后端需已启动）

### 12.4 图示与实现一致性要点（避免画错）

- API **主供应方是 NestJS `3001`**，不是 Next Route Handlers 为主
- 时间表：**无 7/14 切换**；**±2 周**日期条 + 选中日列表
- 双语：**UI 词典** 与 **作品字段** 两层；中文标题依赖 Bangumi 映射（非所有条目即时有 `titleCn`）
- Bee：**65s / 3 条** 礼貌镜像；Dashboard 当季推荐**不调用 Jikan**

# Anitrack — 任务进度 & 备注（Working Log）

> 目的：让“当前做到哪里了、下一步做什么、卡点是什么、做过哪些决定”一眼可见。  
> 约定：每次变更/讨论后，至少更新 **当前状态** 和 **下一步**。

---

## 0. 当前状态（每次更新这里）

- **当前阶段**：**阶段 5 已完成（里程碑）**：多页面架构 + 深度交互（搜索分页、编辑弹窗、Profile 热图）
- **正在做**：进入“收口与打磨”（契约/文档同步、UI polish、可选：Seasonal Schedule 与 Auth）
- **下一步**：补齐（可选）Seasonal Schedule；完善契约/测试；评估是否接入 Auth（将 CurrentUser 从 dev fallback 升级为真实 user）
- **阻塞/风险**：Auth 未接入前，`CurrentUser` 仍会回退到 `TEMP_USER_ID`（技术债，见下）
- **最后更新时间**：2026-04-29

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
- [x] 输出结构：按周 `weeks -> days` 填满日期范围（周一起算，首尾周补齐）
- [x] 强度映射：0-4（纯函数 `calculateIntensity`，见 `src/lib/heatmapCalc.ts`）
- [x] `GET /api/stats/heatmap`：`tz` 默认 `Europe/Berlin`，`from`/`to` 默认「今天往前 365 日」

### 3.2 单元测试（Unit）
- [x] 强度映射与周结构：`src/lib/__tests__/heatmap-calc.test.ts`（Vitest）

### 3.3 集成测试（Integration，Vitest）
- [x] `npm run test:integration`：`src/__tests__/integration/heatmap.integration.test.ts`（真实 Mongo + 直接调用 `GET` handler；插入 COMPLETED 后断言目标日 **count > 0**；`weeks` 结构与 `public/swagger.json` 中 **HeatmapResponse** 对齐）
- [ ] Case C：heatmap 参数错误（400 + 错误体）可选加分

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
- [ ] 拉取 `/api/stats/heatmap`
- [ ] 强度 → 颜色映射（5 档）
- [ ] 手机端 `overflow-x-auto` 横向滚动

### 4.4 Seasonal Schedule（Jikan）
- [ ] 获取当前季度 schedule（直连或走后端代理）
- [ ] 移动端分组折叠 / 桌面端表格或栅格

### 4.5 Jikan 搜索中转 & 自动化入库（本次会话新增）
- [x] `GET /api/anime-meta/search?q=...`：后端调用 Jikan V4 Search（limit=5）
- [x] 搜索结果写入 `AnimeMeta`：bulk upsert（按 `malId` 唯一键），并去重保持顺序
- [x] 429 限流处理：上游 429 → 后端 429（`UPSTREAM_RATE_LIMIT`）
- [x] “柔性模式”：`POST /api/anime` 中抓取/读取 `AnimeMeta` 失败不阻断创建，`animeMeta=null` 并记录错误日志

---

## 5. 决策记录（ADR / Decisions）

> 写清楚“为什么这么做”，避免后续来回推翻。

- 2026-04-20：Heatmap 强度阈值（Draft）：0→0，1→1，2→2，3-4→3，5+→4（可调整）
- 2026-04-20：日期格式统一为 `YYYY-MM-DD`（便于统计与时区处理）

---

## 6. 问题清单（Open Questions）

- [ ] 是否需要登录/鉴权？（课程若不要求，可先单用户模式；多用户见 Blueprint **§3.9**）
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
  - 前端：搜索体验升级（debounce 500ms + Enter 立即搜 + 分页器）；搜索结果中已存在条目显示“已在清单”
  - 前端：Library 采用“全局单实例 Dialog”编辑条目（status/rating/episodesWatched）+ 删除；所有写操作统一 `invalidateQueries(["anime"])`
  - 前端：`/profile` 使用 `react-calendar-heatmap` 渲染绿墙，并做空数据保护（values=`[]`），增加统计卡片

---

## 9. 技术债务（Tech Debt）

- **TEMP_USER_ID**：仍作为 dev fallback 存在；但已通过 `@CurrentUser()` 装饰器集中收口。接入 Auth 后应把 `CurrentUser` 的来源替换为 token/session 注入的真实 user id
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

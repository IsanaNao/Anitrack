# Anitrack — 任务进度 & 备注（Working Log）

> 目的：让“当前做到哪里了、下一步做什么、卡点是什么、做过哪些决定”一眼可见。  
> 约定：每次变更/讨论后，至少更新 **当前状态** 和 **下一步**。

---

## 0. 当前状态（每次更新这里）

- **当前阶段**：**阶段 3 进行中**（Jikan 影子库缓存 + Ownership 拆分；前端尚未开始）
- **正在做**：数据库重构：实现 `AnimeMeta`（公有）/ `AnimeEntry`（私有）双表与关联返回
- **下一步**：前端基础布局（Tailwind 响应式骨架）→ Watchlist / Heatmap 绿墙 / Seasonal UI
- **阻塞/风险**：阶段 4 引入 Auth 前，`userId` 暂用 `TEMP_USER_ID`（技术债，见下）
- **最后更新时间**：2026-04-22

---

## 1. 总里程碑（按课程要求对齐）

- [x] **阶段 1（后端基座）**：Next.js App Router API + MongoDB + `/api/anime` CRUD + **OpenAPI / Swagger UI** + **Contract Testing**（`anitrack-tester/contract-validator`）
- [x] **阶段 2（逻辑与测试）**：`/api/stats/heatmap`（Aggregation Pipeline + 日期 **Normalization**）+ Vitest 单元/集成 + 播种脚本与数据验证
- [ ] **阶段 3（前端渲染）**：Tailwind 响应式主界面 + heatmap 渲染 + 移动端横向滚动

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
- [ ] 主页面布局（移动端纵向、桌面端左右/上下分区）

### 4.2 Watchlist
- [ ] 列表渲染（按 status 筛选/分组）
- [ ] CRUD 交互（创建/编辑/删除）

### 4.3 Heatmap（绿墙）
- [ ] 拉取 `/api/stats/heatmap`
- [ ] 强度 → 颜色映射（5 档）
- [ ] 手机端 `overflow-x-auto` 横向滚动

### 4.4 Seasonal Schedule（Jikan）
- [ ] 获取当前季度 schedule（直连或走后端代理）
- [ ] 移动端分组折叠 / 桌面端表格或栅格

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

---

## 9. 技术债务（Tech Debt）

- **TEMP_USER_ID**：阶段 3 暂用静态占位符（`default_user`），阶段 4 接入 Auth 后需要替换为从 Token 解析的真实用户 id
- **索引迁移风险**：旧集合上可能残留 `{ malId: 1 } unique` 索引会阻止新结构插入  
  - 已在服务启动时调用 `this.animeEntryModel.syncIndexes()`（无 DB 时跳过）  
  - 若 Atlas 上仍异常，建议在网页端 **Drop `animeentries` collection** 后重启，让新索引干净重建

---

## 8. 随手备注（Scratchpad）

- `api-test-suite/heatmap-seeder.js`：约 20 条 COMPLETED 播种（2026-04-11～19 分布），用于热力图联调
- （把杂七杂八的想法先丢这里，后续再搬运到 Blueprint / 任务清单）


# Anitrack — Project Blueprint（项目全景总结）

> 本文档是 Anitrack 的“设计与实现总纲 / 杂项笔记入口”。内容允许很杂、持续追加。  
> 课程目标导向：**API-First、前后端解耦、逻辑在后端、可测试、响应式 UI**。

---

## 0. 项目概览

- **项目名称**：Anitrack（Personal Anime Watchlist & Analytics）
- **核心目标**：开发一个符合 Web-Technologies I 课程要求的全栈 Web 应用，重点展示：
  - **API-First**：后端 API 可独立运行，能被脚本客户端调用
  - **前后端解耦**：前端只渲染与交互，后端提供稳定数据契约
  - **业务逻辑封装**：统计计算、状态机校验等逻辑严格在后端
  - **响应式 UI**：移动端与桌面端体验一致且合理

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
  - 创建条目（可从 Jikan 数据导入基础字段）
  - 更新条目（尤其是状态变更、完成日期记录）
  - 删除条目
  - 列表查询（按状态筛选、分页/排序）

### 1.2 Seasonal Schedule（集成外部 API）
集成 **Jikan API**，展示当前季度番剧更新时间表（前端展示，后端可选做缓存代理）。

- **展示重点**：
  - 按星期/更新时间分组
  - 显示标题、封面、播出信息、外链

### 1.3 Anime Heatmap（Highlight：绿墙）
基于用户“已看过”的时间数据，生成类似 GitHub contributions 的观看活跃度热力图。

- **输入数据**：用户完成番剧的日期（可扩展到“看完一集”的日期）
- **输出数据**：按周聚合、每天一个强度值（0-4）

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

> 说明：本节为契约草案；**运行时源文件**以仓库 `public/swagger.json` 为准，可视化文档为 **`/api-docs`**。后续可扩展 auth、**§3.8 元数据缓存**、导入等能力。  
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
      "malId": 5114,
      "title": "Fullmetal Alchemist: Brotherhood",
      "imageUrl": "https://...",
      "status": "COMPLETED",
      "rating": 9,
      "notes": "optional",
      "startedAt": "2026-04-01",
      "completedAt": "2026-04-12",
      "completedDates": ["2026-04-12"],
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
  "title": "Fullmetal Alchemist: Brotherhood",
  "imageUrl": "https://...",
  "status": "PLANNED",
  "rating": 9,
  "notes": "optional",
  "startedAt": "2026-04-01",
  "completedAt": "2026-04-12",
  "completedDates": ["2026-04-12"]
}
```

#### 字段规则（后端强制）
- `malId`：number，建议唯一（同一用户不重复）
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
返回 heatmap 数据（用于前端渲染绿墙）。

#### Query（建议）
- `from`（可选）：`YYYY-MM-DD`，默认：过去 365 天
- `to`（可选）：`YYYY-MM-DD`，默认：今天
- `tz`（可选）：时区标识（或简化为 offset），默认 `Europe/Berlin`（课程背景）

#### 200 Response（按周聚合）

```json
{
  "from": "2025-04-20",
  "to": "2026-04-20",
  "weeks": [
    {
      "weekStart": "2026-04-13",
      "days": [
        { "date": "2026-04-13", "intensity": 0, "count": 0 },
        { "date": "2026-04-14", "intensity": 1, "count": 1 },
        { "date": "2026-04-15", "intensity": 0, "count": 0 },
        { "date": "2026-04-16", "intensity": 2, "count": 2 },
        { "date": "2026-04-17", "intensity": 0, "count": 0 },
        { "date": "2026-04-18", "intensity": 4, "count": 5 },
        { "date": "2026-04-19", "intensity": 0, "count": 0 }
      ]
    }
  ]
}
```

#### 强度等级（0-4，后端定义）
- `count=0` → `intensity=0`
- 其余按阈值映射到 1-4（阈值策略见第 5 章）

---

### 3.8 数据缓存层（AnimeMeta Cache，战略预留）

> **目标**：将 Jikan（MyAnimeList 公开数据）的读路径从「每次直连外部 API」迁移为「以 MongoDB 为影子库的 **Cache-Aside**」，在课程与后续个人博客场景下均可复用。

- **集合角色**：新增 **`AnimeMeta`**（名称可调整），作为 **Jikan 响应体的规范化快照**（例如 `malId`、`title`、`images`、`aired` 等稳定字段），与业务表 **`AnimeEntry`** 解耦：前者偏「目录元数据」，后者偏「用户观看状态」。
- **Cache-Aside 模式**：
  1. **读路径**：按 `malId`（或搜索关键词哈希）先查 **`AnimeMeta`**；**命中**则直接返回本地文档，避免触发 Jikan **Rate Limiting**。
  2. **未命中**：同步请求 Jikan；成功后将 payload **异步写入** `AnimeMeta`（`setImmediate` / 队列 / 后台 `Promise` 均可，实现期再定），并返回本次响应。
  3. **失效策略（可选）**：TTL 索引、`updatedAt` 阈值、或手动 purge；初期可采用「长期缓存 + 手动刷新」降低复杂度。
- **工程收益**：显著降低对外部 API 的耦合与 **429** 风险；本地索引（如 `malId` unique）支撑「类 **10 亿级**」夸张表述下的 **常数级主键查找**（相对每次 HTTP 往返的数量级差异）。

> **实现状态**：本节为 **§3 架构战略升级**；路由与 Schema 可在阶段 3 并行落地，与 `GET /api/anime` 导入流衔接。

---

### 3.9 多用户扩展性备忘（未来迁移至个人博客）

> 当前仓库以 **单用户 / 无鉴权** 为主，便于课程交付；以下约束便于未来引入 **`userId` 隔离** 时少改表结构。

- **数据隔离**：`AnimeEntry`（及未来的 `AnimeMeta` 若存用户级偏好）采用 **`userId: ObjectId`**（或 `sub` / `email` 的稳定外键）与业务字段组成 **复合唯一索引**，例如 **`(userId, malId)` unique**，所有列表与热力图 **Aggregation Pipeline** 的首个 **`$match`** 必须带 **`userId`**。
- **鉴权层**：Next.js Route Handlers 或 Middleware 校验 **Session / JWT**；将 `userId` 注入请求上下文，**禁止**由客户端自由传入未校验的 `userId`。
- **OpenAPI**：扩展 `securitySchemes`（如 `bearerAuth`）；现有单用户路径可标记 `optional` 或保留 **dev-only** 默认用户。
- **迁移路径**：先加可空 `userId` + 回填默认用户 → 再强制非空 → 最后删除「全局共享」代码路径；**Contract Testing** 应同步增加「跨用户不可读」用例。

---

## 4. MongoDB 数据模型（Schema Design）

> 目标：既能支撑 watchlist CRUD，也能支撑 heatmap 的日期维度统计，并且便于测试与聚合。

### 4.1 `User`（可选，若课程不要求登录可先跳过）
- `_id`
- `email`（唯一）
- `passwordHash`（若做 auth）
- `createdAt` / `updatedAt`

### 4.2 `AnimeEntry`（watchlist 主表）

建议字段（以 Mongoose/TypeScript 的思路表达）：
- `_id`：ObjectId
- `userId`：ObjectId（若无登录，可先用单用户默认值或省略）
- `malId`：number（来自 Jikan / MyAnimeList）
- `title`：string
- `imageUrl`：string（可选）
- `status`：enum
- `rating`：number（可选）
- `notes`：string（可选）
- `startedAt`：string(`YYYY-MM-DD`)（可选）
- `completedAt`：string(`YYYY-MM-DD`)（可选）
- `completedDates`：string[](`YYYY-MM-DD`)（**为 heatmap 关键**）
- `createdAt` / `updatedAt`

#### 为什么需要 `completedDates`
- 最简：每次完成一部番就记 1 个日期，用于贡献计数
- 可扩展：未来若做 “episode completion”，可记录多个日期（同一天多次也可通过 count 累加）

#### 索引建议
- `(userId, malId)` unique（防重复收藏）
- `(userId, status)`
- `(userId, updatedAt)`（列表排序）
- `completedDates`（多键索引）用于范围查询/聚合（视实现而定）

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
- 提取 `completedDates`（日期数组），做“按天计数”
- 将日期范围切成“按周聚合”的输出结构（weeks → days）
- 将 `count` 映射到 `intensity` 0-4（纯函数，便于单测）

#### 建议的强度阈值策略（可调整）
为了适配不同用户数据量，建议使用“固定阈值 + 上限截断”的简单可解释策略：
- `count = 0` → 0
- `count = 1` → 1
- `count = 2` → 2
- `count = 3-4` → 3
- `count >= 5` → 4

> 优点：易解释、稳定；缺点：对重度用户可能全是 4。  
> 备选：按分位数动态阈值（更“自适应”，但更难解释，且测试要更精确）。

---

## 6. 测试策略（Test Cases）

> 工具约束：后端基于 Next.js App Router 的 API routes；测试使用 Vitest。  
> 目标：同时覆盖 Integration Tests 与 Unit Tests（课程要求）。

### 6.1 集成测试（Integration Tests）：`/api/stats/heatmap`

#### Case A：空数据
- **Given**：数据库中没有 `status=COMPLETED` 的条目（或 `completedDates` 为空）
- **When**：请求 `GET /api/stats/heatmap?from=2026-04-01&to=2026-04-07`
- **Then**：
  - 状态码 **200**
  - 返回包含 `from/to/weeks`
  - `weeks[].days[]` 覆盖范围内所有日期
  - 每天 `count=0` 且 `intensity=0`

#### Case B：多数据（同一天多次）
- **Given**：
  - 两个已完成条目，`completedDates` 包含同一天（例如 `2026-04-05`）
  - 另一个日期也有 1 次完成
- **When**：请求相同范围
- **Then**：
  - 状态码 **200**
  - `2026-04-05` 的 `count` 等于完成次数总和
  - `intensity` 按阈值映射正确（例如 `count=2 → intensity=2`）

#### Case C：参数校验（可选但加分）
- **Given**：`from > to` 或日期格式错误
- **When**：请求 heatmap
- **Then**：状态码 **400**，错误结构符合通用错误体

### 6.2 单元测试（Unit Tests）：heatmap 强度映射纯函数
- `count=0 → 0`
- `count=1 → 1`
- `count=2 → 2`
- `count=3 → 3`
- `count=4 → 3`（若采用 3-4 → 3）
- `count=5 → 4`
- 非法输入（负数/NaN）→ 抛错或归零（由实现决定，但要一致并测试）

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

### 7.3 Heatmap 组件规范
- 单元格：正方形（例如 10-14px），间距 2px
- 颜色：按 `intensity 0-4` 对应 5 档绿色（0 为灰/背景）
- 窄屏：容器 `overflow-x-auto`，保持单元格不被压扁

### 7.4 Schedule 组件规范
- 移动端：按“星期”折叠分组，卡片流
- 桌面端：表格或多列栅格，支持快速扫视

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
> 在后端实现 `/api/stats/heatmap`：对 **`status=COMPLETED`** 的 **`completedDates`** 执行 **Aggregation Pipeline**（含 **`$unwind`** 与 BSON 类型 **Normalization**），按周输出 **`weeks → days`**，强度 **0–4**。配套 **Vitest** 纯函数单测、**integration test**（真实 Mongo）、**Contract Testing** 与播种脚本。

**交付物清单（已对齐）**
- heatmap 聚合逻辑（纯函数 + Pipeline；**`Date`/`string` 混存修复**）
- `GET /api/stats/heatmap` 路由
- Vitest：heatmap **integration** + **unit**（强度映射与周结构）

### 阶段 3（前端渲染）— **当前首要任务**
> **优先序（建议）**：① **Jikan API 的后端代理或缓存读路径**（与 §3.8 `AnimeMeta` 战略衔接，规避 **Rate Limiting**）；② **Tailwind 响应式主布局骨架**（断点与容器，见第 7 章）。随后实现 Watchlist、热力图绿墙（`intensity` → 色阶）、Seasonal 区块。

> 构建 Anitrack 的主界面：左侧 / 纵向为追番列表，热力图为 **GitHub-style contributions**；热力图组件根据 API 返回的 **`intensity` 0–4** 渲染色深，窄屏 **`overflow-x-auto`** 横向滚动。

**交付物清单**
- 主页面布局（响应式）
- Watchlist 组件（调用 `/api/anime`）
- Heatmap 组件（调用 `/api/stats/heatmap`）
- 移动端 heatmap 横向滚动与桌面端并排布局

---

## 9. 备注区（随手记）

- TODO：是否需要 auth？若课程不要求，可先做“单用户模式”（数据库不加 `userId` 或固定 `userId`）；多用户见 **§3.9**。
- **Jikan**：阶段 3 优先落地 **后端代理 + §3.8 Cache-Aside（`AnimeMeta`）**；直连模式仅作 fallback。
- OpenAPI：当前以 `public/swagger.json` 为源 + **`/api-docs`**（Swagger UI）；长期可选 **zod-to-openapi** 等单向生成（实现期再定）。

---

## 10. 实施进度快照（与仓库同步，**2026-04-20 更新**）

以下结论基于 **真实请求 + 数据库读写**（`anitrack-tester/api-test-suite/run-all.js`）、**仓库内 Vitest**（`npm test` / `npm run test:integration`），以及 **Contract Testing**（`anitrack-tester/contract-validator/run-contract-test.js`，**严格模式**：`CONTRACT_PENDING_PATHS` 为空）。

### 10.1 已可认为“成立”的范围（阶段 1 + 阶段 2）

- **MongoDB 接入**：`anitrack/.env.local` 中 `MONGODB_URI`（Atlas）；开发与集成测试下连接、**Aggregation Pipeline**、写入均可用。
- **`/api/anime` 契约与行为**：
  - CRUD 与分页列表符合第 3 章草案（`items/page/pageSize/total`）。
  - **状态机**：非法迁移 **409**，`error.code` 为 **`INVALID_STATUS_TRANSITION`**。
  - **`COMPLETED` 副作用**：`completedDates` 自动维护为 **`YYYY-MM-DD`**；`DELETE` **204**。
- **`GET /api/stats/heatmap`**：已实现；**`$unwind` 后对 `completedDates` 做 Normalization**（`$dateToString` / `$trim`），解决 **BSON `Date` / `string` 混存** 导致的 **count 全 0**；`from`/`to` **闭区间** 与存储字符串对齐；默认 **`tz=Europe/Berlin`**。
- **OpenAPI / Swagger UI**：`http://localhost:3000/swagger.json` + **`http://localhost:3000/api-docs`**（`swagger-ui-dist`）已可用，**Try it out** 同源测 API。
- **Contract Testing**：**AJV**（OpenAPI 3.0 元模式）+ **SwaggerParser** + HTTP 冒烟；严格模式下 **全绿**，与实现 **契约一致**。
- **Vitest**：`heatmapCalc` 单测 + heatmap **integration test**（真实 Mongo，插入 **COMPLETED** 后断言 **count > 0**）。
- **数据播种**：`api-test-suite/heatmap-seeder.js` 可稳定追加约 20 条 **COMPLETED**（不清库），用于联调 **intensity 0–4**。

### 10.2 下一阶段焦点（阶段 3）

- **Jikan**：后端 **API 代理**（及 §3.8 **`AnimeMeta` Cache-Aside** 的渐进落地）。
- **前端**：Tailwind 主布局、Watchlist、热力图绿墙、Seasonal；`src/app/page.tsx` 仍为脚手架首页，待替换为业务壳。

### 10.3 实现侧备忘（避免重复踩坑）

- **`PATCH` 与 Zod 默认值**：`AnimeEntryPatch` 解析时可能为 `completedDates` 填入默认空数组；路由层判断“是否触碰完成日期字段”应以 **原始 JSON 是否包含对应 key** 为准，避免把“仅更新 status”误判为“在写 completed 字段”。
- **热力图 Aggregation**：任何涉及 **日历字符串** 与 **BSON `Date`** 的 **Normalization** 必须在 **`$group` 之前**完成，且 **`$match` 闭区间** 作用于 **同一规范化字段**，否则易出现 **静默空结果**。
- 防止启动打架**Set-Location "C:\Users\HP\Desktop\my_page"; npm run dev**


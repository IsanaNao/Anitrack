# 双表重构与 NestJS 迁移总结报告（Anitrack）

> 范围：本报告总结本次“从单表到双表（Ownership 拆分）”以及“后端迁移到 NestJS（主 API 供应方）”的工程改造。  
> 目标：在阶段 3 提前理清数据权属，避免阶段 4 多用户时出现毁灭性数据库重构，并通过测试体系确保底座平移不翻车。

---

## 数据权属图谱（Data Ownership）

### 1) `AnimeMeta`（公有 / 外部抓取 / 影子库缓存）

- **性质**：公有、跨用户共享、以“番剧客观信息”为中心的缓存表（Cache-Aside shadow library）。
- **数据来源**：Jikan API（MyAnimeList 的公共元数据）。
- **唯一标识**：`malId`（全局唯一）。
- **允许包含的字段（典型）**：
  - `malId`、`title`、`imageUrl`、`episodes`、`score`
  - `createdAt` / `updatedAt`
- **禁止包含的字段**（强约束）：
  - 任何用户行为或进度字段，例如 `status`、`completedDates`、`notes` 等
- **存在意义**：
  - **缓存**：多个用户看同一部番时，元数据只存一份
  - **降压**：减少对 Jikan 的重复请求，降低 429 / 限流风险
  - **解耦**：把“客观元信息”与“用户私有进度”分离，后续多用户扩展更自然

### 2) `AnimeEntry`（私有 / 用户行为 / 可变）

- **性质**：私有、可变、以“用户进度记录”为中心的业务表。
- **数据来源**：用户行为（添加、修改状态、打分、写笔记等）。
- **外键关联**：通过 `malId` 关联 `AnimeMeta.malId`。
- **允许包含的字段（典型）**：
  - `userId`（当前阶段为占位符 `TEMP_USER_ID`）
  - `malId`
  - `status`、`rating`、`notes`
  - `startedAt`、`completedAt`、`completedDates`（热力图统计关键字段）
  - `createdAt` / `updatedAt`
- **禁止包含的字段**（强约束）：
  - `title` / `imageUrl` / `episodes` / `score` 等元数据字段（这些必须属于 `AnimeMeta`）
- **索引策略**：
  - **复合唯一索引**：`(userId, malId)`  
    作用：同一用户不能重复添加同一部番；不同用户允许拥有各自的条目。

### 3) 为什么必须拆分（Ownership 的工程收益）

- **避免交叉污染**：用户 B 改状态，不会影响用户 A 的状态。
- **避免数据冗余**：不会因为多用户而在数据库里复制 N 份相同的番剧基础信息。
- **后续 Auth 平滑迁移**：`userId` 只是“数据隔离维度”，从占位符升级到真实 token user id 时，不需要重做表结构。

---

## 核心链路时序（Logic Flow）

本节描述从用户“选择一部番剧”到数据入库、再到读路径返回的全生命周期，重点强调 **Cache-Aside** 命中/未命中逻辑。

### 1) 写入链路：用户添加（`POST /api/anime`）

#### 输入（阶段 3 形态）

- 前端只提交最小信息：`malId`（可选 `status/rating/notes/...` 作为用户进度）
- `userId` 不由前端传入（当前由后端临时固定为 `TEMP_USER_ID`）

#### 时序（Cache-Aside）

1. **收到创建请求**（携带 `malId`）
2. **先处理元数据**：后端调用 `AnimeMetaService.getOrFetchByMalId(malId)`
   - **命中**：MongoDB 已存在该 `malId` 的 `AnimeMeta` → 直接返回（不触发外部请求）
   - **未命中**：调用 Jikan API 拉取元数据 → 写入 `AnimeMeta`（以 `malId` 唯一）→ 返回写入后的 meta
3. **再写入用户条目**：创建 `AnimeEntry`
   - 写入字段包含：`userId=TEMP_USER_ID`、`malId`、以及用户进度字段（`status/completedDates/...`）
4. **响应返回**：返回 `AnimeEntry`，并嵌套 `animeMeta`（便于前端一次渲染）

### 2) 读路径：列表/详情（`GET /api/anime`、`GET /api/anime/:id`）

1. **先读 `AnimeEntry`**（过滤 `userId=TEMP_USER_ID`，并支持 `status` 过滤、分页/排序）
2. **批量拉取 `AnimeMeta`**：将 entries 的 `malId` 去重后一次性查询 `AnimeMeta`
3. **拼装返回体**：每条 entry 附带 `animeMeta`（如果 meta 缺失则返回 `null`，但正常情况下 create 已保证存在）

### 3) 统计链路：热力图（`GET /api/stats/heatmap`）

1. **第一步 `$match`**：过滤 `userId=TEMP_USER_ID`
2. **只统计完成数据**：`status=COMPLETED` 且 `completedDates` 非空
3. **`$unwind completedDates`**：按天打散
4. **日期规范化**：兼容历史 `Date/string` 混存（统一为 `YYYY-MM-DD`）
5. **按天 `$group` 计数**：输出 weeks → days（包含 count 与 intensity）

---

## 测试防御体系（Testing Pyramid）

本次重构的核心策略是：**先在工程结构上升级（双表 + 关联返回），再用测试把外部契约与内部业务不变性锁死**。

### Unit Test（单元测试）

#### 覆盖点

- **目标模块**：`AnimeMetaService`（Cache-Aside 的核心）
- **验证内容**：
  - **命中缓存**：当 `AnimeMeta` 已存在时，不应触发对外部（mock 的）Jikan `fetch` 调用
  - **未命中缓存**：当 `AnimeMeta` 不存在时，应触发 `fetch`，并将结果写入 Mongo（mock model.create），最终返回写入后的对象

#### 价值

- 把最关键的“先查库、不命中再抓取”的行为固定住，避免后续重构把缓存逻辑悄悄破坏。

### E2E Test（端到端测试）

#### 覆盖点

- **业务流**：create → get → patch → delete（验证 CRUD 的基本链路仍成立）
- **状态机约束**：非法状态迁移必须返回 `409 INVALID_STATUS_TRANSITION`（错误信封稳定）
- **热力图接口**：`GET /api/stats/heatmap` 返回结构正确（weeks/weekStart/days[count,intensity]）
- **内存 DB 兼容**：
  - 使用 `mongodb-memory-server`，确保在 CI/本地无 Atlas 环境时仍可跑通
  - 通过在 e2e 中 mock `AnimeMetaService`，避免对外网 Jikan 的依赖（保证可重复、稳定）

#### 价值

- 证明“双表重构”没有破坏既有业务规则（状态机、完成日期维护、删除语义等）。

### Contract Test（契约测试）

#### 覆盖点

- **OpenAPI 文档结构校验**：AJV + SwaggerParser 确保 `swagger.json` 自洽、可解析
- **运行时契约冒烟**：
  - 路径存在性（已声明的 endpoints 必须可访问）
  - 分页上限契约（pageSize=101 应被 clamp 到 100）
  - 关键对象 shape（`AnimeEntry` / `AnimeListPage` / 错误体）
  - 非法 PATCH → 409 与错误体结构一致

#### 价值

- **对外承诺**：确保“我们对外宣布的 API（Swagger）”与“实际运行行为”一致，是重构期间最重要的回归指示灯。

---

## 遗留点与待办（Pending）

### 1) `TEMP_USER_ID` 硬编码位置（阶段 3 占位符）

- **定义位置**：`src/shared/auth/temp-user.ts`
  - `export const TEMP_USER_ID = 'default_user';`
- **使用位置（关键）**：
  - `AnimeService`：所有 `list/get/patch/delete/create` 默认以 `TEMP_USER_ID` 作为 owner 过滤/写入
  - `StatsService`：Aggregation Pipeline 的首个 `$match` 过滤 `userId=TEMP_USER_ID`

### 2) 接入 Auth（阶段 4）时的替换点

将当前的“常量 userId”替换为“从 Token 解析出的真实 user id”，典型改造点：

- **Controller 层**：通过 Guard/Interceptor 将 `req.user.sub`（或等价字段）注入到请求上下文
- **Service 层**：
  - 将 `TEMP_USER_ID` 替换为 `getUserIdFromRequestContext()`（或参数注入）
  - 任何查询（find/list/aggregate）必须携带 `userId`
- **OpenAPI**：
  - 增加 `securitySchemes`（例如 `bearerAuth`）
  - 标注需要鉴权的 endpoints

### 3) 数据与索引迁移注意事项

- **旧索引风险**：历史上存在 `{ malId: 1 } unique` 的单字段唯一索引会阻止新结构插入
- **当前防护**：服务启动时调用 `this.animeEntryModel.syncIndexes()`（无数据库连接时会跳过）
- **推荐清理动作**（重构后一次性操作）：
  - 在 MongoDB Atlas 控制台 **Drop 旧的 `animeentries` collection**
  - 让应用按新 schema + 新索引干净重建

---

## 附：本次改造对外接口的“最重要变化”

- **`POST /api/anime`**：从“提交 title/imageUrl”等元数据 → 改为 **最小提交 `malId`**（元数据由后端通过 Jikan→AnimeMeta 自动补齐）
- **`GET /api/anime` / `GET /api/anime/:id`**：返回对象新增 `userId` 与嵌套 `animeMeta`
- **Heatmap**：统计范围被限定在当前用户（`TEMP_USER_ID`），为阶段 4 多用户隔离提前铺路


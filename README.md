# 📺 Anitrack (Ani-Tracker)

基于 **Next.js（前端）+ NestJS（后端）+ MongoDB** 的番剧进度管理系统，支持自动化热力图统计与多维契约测试。

## 🗂️ 仓库结构（双文件夹架构）

- `anitrack/`：Next.js 前端（也保留了早期的 Next.js Route Handlers 版本，便于对照）
- `anitrack/anitrack-backend/`：NestJS 后端（**当前主 API 供应方**，默认端口 `3001`）
- `anitrack-tester/`：集成测试与契约测试工具集

## 🚀 项目愿景

Anitrack 不仅仅是一个简单的“看番记录本”。它旨在通过自动化数据聚合提供深度的情感反馈：通过仿 GitHub 风格的“绿墙（Heatmap）”，将用户的观影行为转化为可视化的时间轨迹。

## ✨ 核心特性（已实现）

### 1) 健壮的后端逻辑（Logic-Heavy Backend）

- **状态机约束**：严格校验番剧状态迁移（如：只有 `WATCHING` 或 `DROPPED` 可以转为 `COMPLETED`），防止非法数据入库。
- **自动时间戳管理**：当番剧标记为“已完成”时，系统会自动维护 `completedDates` 数组，支持多周目（Rewatch）记录。
- **高性能聚合查询**：使用 MongoDB Aggregation Pipeline 进行数据规范化与统计，后端直接输出带“强度值（Intensity）”的热力图 JSON。
- **统计接口后端化**：
  - `GET /api/stats/summary`：Profile/Dashboard 顶部指标（总量、完成数、在看数、平均评分、已看总集数）
  - `GET /api/stats/activity?month=YYYY-MM`：月度 Activity（Added/Completed 列表），前端不再全量拉取再过滤
  - `GET /api/anime-meta/seasonal-random`：Dashboard 当季推荐卡片池（MongoDB `$sample` / `AnimeMirror`，**不调用 Jikan**）；卡片可点开 **`SeasonalPickDetailDialog`**（封面、简介、加入清单）
- **Ownership 双表建模（阶段 3 关键底座）**：将番剧“客观元数据”与用户“个人进度”拆分为 `AnimeMeta`（公有缓存）与 `AnimeEntry`（用户私有），避免未来多用户场景的毁灭性重构。
- **基于 `malId` 的 Cache-Aside 缓存层**：创建条目时按 `malId` 先查 `AnimeMeta`，未命中则抓取 Jikan 并缓存，降低第三方 API 压力与 429 风险。
- **Jikan 请求缓存（24h）**：后端引入 NestJS `CacheModule`，所有 Jikan 三方请求统一走缓存，显著缓解 429。
- **新番时间表（Timetable）**：前端 **`/timetable`** 对接 **`GET /api/anime-meta/timetable`**（7/14 天、`Europe/Berlin` 日期列）；数据来自 **当季 `AnimeMirror` + Bangumi 映射**（非 Jikan schedule 直连）。条目可点开详情并 **加入清单（PLANNED / WATCHING）** 或编辑已有条目。**已知限制**：部分条目 **播出钟点仍显示 TBD**（`airTimeLocal` 依赖上游 `airTime` 等字段，已做格式规范化，完整排期待后续方案）。
- **🐝 Intelligent Data Mirroring（Bee System）**：
  - 内置后台同步引擎，以 **65s / 3 req** 的“礼貌频率”自动镜像 Jikan 元数据至 MongoDB（`AnimeMirror`）。
  - 支持**断点续爬**与**被动抓取信号**：重启后基于 `lastUpdated` 继续同步，不会从头重复；读路径 miss 会 enqueue，后台逐步补齐热点数据。
  - **多级优先级镜像**：`seasonal`（当季）＞ `top_1y`（Top40）＞ `top_5y`（Top100）＞ `top_all`（Top200）＞ `backfill`（季度回滚补漏），并通过 `tier/priority` 在数据库中持久化队列状态。
  - **Mirror-first** 策略：Schedule、按 `malId` 补全元数据等路径优先走本地镜像；**Dashboard 当季推荐**使用 `GET /api/anime-meta/seasonal-random`，仅从 `AnimeMirror`（`tier=seasonal`）抽样，**该读路径不发起 Jikan HTTP**。
  - 显著降低对三方 API 的依赖与 **429** 风险（配合 24h 缓存进一步加固）。

### 2) 契约驱动开发（Contract-Driven）

- **OpenAPI / Swagger 3.0**：仓库 **`anitrack/anitrack-backend/swagger.json`** 由 Nest 启动时加载；交互式文档 **`http://localhost:3001/api-docs`**（JSON：**`/swagger.json`**）。`anitrack-tester/contract-validator` 会对 `paths` 里声明的每条路径发 **GET** 做路径存在性冒烟；**仅 POST** 的接口（例如 `POST /api/bee/sync-step`）若未同步调整冒烟逻辑，不宜单独写入 `paths`，参数与语义以 **`PROJECT_BLUEPRINT.md`** 与控制器 `@ApiOperation` 为准。
- **多层级测试套件**：
  - **Vitest 单元测试**：覆盖核心算法与日期计算
  - **集成测试**：验证 API 与 MongoDB 的真实交互
  - **契约回归测试**：自动化校验代码实现与 Swagger 规范的 **100% 对齐**

### 3) 工程化工具集

- **自动化播种机（Seeder）**：一键填充测试数据，快速模拟真实使用场景。
- **严格规范化**：处理 BSON `Date` 与 `String` 的混合存储问题，确保时区一致性（默认 `Europe/Berlin`）。

## 🛠 技术栈

- **Frontend**: Next.js (App Router), Tailwind CSS
- **Backend**: NestJS 11, Mongoose, Swagger (OpenAPI 3.0)
- **Database**: MongoDB Atlas
- **Validation**: class-validator / class-transformer（NestJS）
- **Testing**: Vitest, AJV (JSON Schema Validation)
- **Docs**: Swagger (OpenAPI 3.0)

## 📅 路线图（Roadmap）

- [x] 阶段 1：核心 Watchlist CRUD 与数据库持久化
- [x] 阶段 2：统计聚合逻辑与多维自动化测试
- [x] 阶段 3：Jikan 影子库缓存（`AnimeMeta`）+ 前端主界面开发（Dashboard/The Pulse、Profile Heatmap、Library Dialog）
- [x] 阶段 4（进行中收尾）：**`/timetable`** 已对接 **`GET /api/anime-meta/timetable`**；Dashboard 当季推荐已对接 **`GET /api/anime-meta/seasonal-random`**，并支持 **`SeasonalPickDetailDialog`** 详情
- [ ] 阶段 5+：**Timetable 播出钟点**在数据不全时仍为 **TBD**（暂缓，待数据源或策略）；**整站双语切换**（UI 文案中/英，详见 `TASK_PROGRESS.md` **§4.9**）；用户认证与多用户数据隔离

## 🛠 快速开始（给队友）

### 1) 克隆并安装

```bash
git clone https://github.com/YourUsername/anitrack.git
cd Anitrack
```

> 提示：仓库根目录（也就是你现在所在的 `Anitrack/`）**没有** `package.json`，不能在这里直接 `npm run dev`。  
> 前端与后端分别在 `Anitrack/anitrack/` 与 `Anitrack/anitrack/anitrack-backend/`。

### 2) 环境配置

在 `anitrack/anitrack-backend/` 目录创建 `.env`（**该文件已在 `.gitignore` 中忽略，不会上传到 GitHub**）：

```plaintext
MONGODB_URI=你的MongoDB连接字符串
JIKAN_BASE_URL=https://api.jikan.moe/v4
SYNC_ENABLED=true
# 可选：控制 Bee 启动时/重试时播种哪些 Top 队列（避免频繁触发 429）
# 例：只跑 Top100/Top200：top_5y,top_all
BEE_ENABLED_TOP_TIERS=top_1y,top_5y,top_all
# 可选：礼貌爬取标识
JIKAN_USER_AGENT=AnitrackBee/1.0 (+contact=you@example.com)
```

### 3) 启动开发服务器

```bash
# 终端 1：启动后端（NestJS），端口 3001
cd anitrack/anitrack-backend
npm install
npm run start:dev

# 终端 2：启动前端（Next.js），端口 3000
cd ..
npm install
npm run dev
```

- **Swagger UI（新后端）**：`http://localhost:3001/api-docs`
- **OpenAPI JSON（契约测试读取）**：`http://localhost:3001/swagger.json`
- **前端页面（Next.js）**：`http://localhost:3000/`

## 🧪 测试指令

```bash
# 算法单测
npm test

# 集成测试
npm run test:integration
```

## 🧾 契约校验（Contract Test）

前置条件：保持后端（`anitrack/anitrack-backend/`）开发服务器开启（默认 `3001`）。

在另一个终端执行：

```bash
cd ../anitrack-tester/contract-validator
node run-contract-test.js
```
## 关于小蜜蜂系统
### 429 限流后的“下次怎么继续”（Runbook）

当启动或手动触发播种时，如果看到：

- `seed failed (...): status=429 code=UPSTREAM_RATE_LIMIT ...`

说明 Jikan 限流了。此时 Bee 会进入**退避窗口**（backoff），并把下一次允许播种的时间写入 `backoffUntil`。

#### 1) 查看当前镜像进度与 backoff

仪表盘式查询爬取进程可以通过：
```PowerSchell
curl.exe -s http://localhost:3001/api/bee/status
```

你会拿到类似：

- `tiers.top_5y.total` / `tiers.top_all.total`：是否已经成功播种进队列（未播种时 total=0）
- `backoffUntil`：若 >0 表示在该时间点之前不要继续触发 seed（否则大概率继续 429）

#### 2) 等 backoff 结束后，手动触发一次播种（轻量、只播种一档）

```PowerSchell
curl.exe -s -X POST http://localhost:3001/api/bee/seed-step
```

手动触发一次同步 batch（默认 3 条）
```PowerSchell
curl.exe -s -X POST "http://localhost:3001/api/bee/sync-step?batchSize=3"
```

它们都会返回一份新的进度快照（和 `/api/bee/status` 一样）。

#### 你应该看到什么（成功信号）
- `top_5y.total` 变为 **100**，`top_all.total` 变为 **200**（说明队列已播种）
- 随后后端日志会出现类似：
  - `[Mirror] Synced 3 this tick (top_5y=3) ... progress=...`
  - `[Mirror] Synced 3 this tick (top_all=3) ... progress=...`

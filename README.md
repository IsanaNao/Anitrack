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

### 2) 契约驱动开发（Contract-Driven）

- **OpenAPI / Swagger 3.0**：完整的 API 契约文档，支持通过 `/api-docs` 进行交互式调试。
- **多层级测试套件**：
  - **Vitest 单元测试**：覆盖核心算法与日期计算
  - **集成测试**：验证 API 与 MongoDB 的真实交互
  - **契约回归测试**：自动化校验代码实现与 Swagger 规范的 **100% 对齐**

### 3) 工程化工具集

- **自动化播种机（Seeder）**：一键填充测试数据，快速模拟真实使用场景。
- **严格规范化**：处理 BSON `Date` 与 `String` 的混合存储问题，确保时区一致性（默认 `Europe/Berlin`）。

## 🛠 技术栈

- **Frontend**: Next.js 14 (App Router), Tailwind CSS, Lucide React
- **Backend**: NestJS 11, Mongoose, Swagger (OpenAPI 3.0)
- **Database**: MongoDB Atlas
- **Validation**: class-validator / class-transformer（NestJS）
- **Testing**: Vitest, AJV (JSON Schema Validation)
- **Docs**: Swagger (OpenAPI 3.0)

## 📅 路线图（Roadmap）

- [x] 阶段 1：核心 Watchlist CRUD 与数据库持久化
- [x] 阶段 2：统计聚合逻辑与多维自动化测试
- [ ] 阶段 3（Next）：Jikan API 代理集成（影子库缓存）与 React 主界面开发
- [ ] 阶段 4：用户认证与多用户数据隔离

## 🛠 快速开始（给队友）

### 1) 克隆并安装

```bash
git clone https://github.com/YourUsername/anitrack.git
cd Anitrack
```

### 2) 环境配置

在 `anitrack/anitrack-backend/` 目录创建 `.env`（**该文件已在 `.gitignore` 中忽略，不会上传到 GitHub**）：

```plaintext
MONGODB_URI=你的MongoDB连接字符串
```

### 3) 启动开发服务器

```bash
# 终端 1：启动新后端（NestJS），端口 3001
cd anitrack/anitrack-backend
npm install
npm run start:dev

# 终端 2：启动前端（Next.js），端口 3000
cd ../..
cd anitrack
npm install
npm run dev
```

- **Swagger UI（新后端）**：`http://localhost:3001/api-docs`
- **OpenAPI JSON（契约测试读取）**：`http://localhost:3001/swagger.json`

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


# 答辩演讲稿初稿（中文为主）

> **排练**：按本文中文熟读即可。  
> **现场口述**（德国导师）：用每节末尾 **「口述 English」** 或对照翻译。  
> **幻灯片**：见 [`演讲大纲.md`](./演讲大纲.md)  
> **示例分工**：三人 × 约 7 分钟；请替换 `[姓名 A/B/C]`。  
> **课程符合性（一句话）**：内容要求已在项目中实现；组织要求靠本稿排练与答辩当天 Live-Demo 完成。

---

## 演示前检查

| 中文 | English (oral) |
|------|----------------|
| 后端已启动：`anitrack-backend` → `npm run start:dev` | Backend on port 3001 |
| 前端已启动：`anitrack` → `npm run dev` | Frontend on port 3000 |
| App 界面切为 **English** | Switch UI to English |
| 浏览器标签：`localhost:3000`，可选 `localhost:3001/api-docs` | Tabs ready |

---

## 讲者 1（约 7 分钟）— 开场、分工、课程对照、技术栈

*对应幻灯片 1–5*

### 第 1 页 — 开场（约 30 秒）

**中文（排练）**  
各位老师好。我们汇报的项目叫 **Anitrack**，是一个全栈 Web 应用，用来管理个人追番进度，并用类似 GitHub 贡献图的方式展示每月观看活动。这是 Web Technologies I 的课程项目。

**口述 English**  
Good morning / afternoon. We present **Anitrack** — a full-stack web application for tracking anime watch progress and visualizing viewing activity. This is our project for Web Technologies I.

---

### 第 2 页 — 小组与分工（约 1 分钟）

**中文（排练）**  
我们是三人小组。**[姓名 A]** 主要负责 **前端**：Next.js、界面、双语和响应式布局。**[姓名 B]** 负责 **后端**：NestJS、MongoDB 和 Bee 数据镜像。**[姓名 C]** 负责 **API 契约、自动化测试**，并主导现场演示。这样每块都有明确负责人，也符合课程要求。

**口述 English**  
We are a team of three. **[Name A]** owns the frontend — Next.js, UI, i18n, and responsive layout. **[Name B]** owns the backend — NestJS, MongoDB, and the Bee mirroring system. **[Name C]** is responsible for the API contract, tests, and leading the live demo.

*单人答辩：改为「我主要负责…」，并简要带过全栈范围。*

---

### 第 3 页 — 问题与目标（约 1 分钟）

**中文（排练）**  
很多观众用表格或多个网站记追番进度。Anitrack 把 **个人清单**（想看 / 在看 / 看完等状态）、**按月热力图** 和基于本地镜像的 **当季时间表** 放在一起。目标是做一个可维护的 **API-first** 应用，满足课程对 NestJS、CRUD、测试和响应式前端的要求。

**口述 English**  
Many fans track anime across spreadsheets or multiple sites. Anitrack combines a personal watchlist, a monthly heatmap, and a seasonal timetable from mirrored data — as an API-first app that meets the course requirements.

---

### 第 4 页 — 课程要求对照（约 1.5 分钟）

**中文（排练）**  
可先一句话收尾：**内容要求我们已在仓库里实现；组织要求——今天的汇报、分工和 Live-Demo——就是来完成剩下这部分的。** 然后对着表格逐项指：课程要求用 **NestJS** 做后端，我们在 **3001** 端口运行 NestJS 11。通过 **`/api/anime`** 等接口提供 **CRUD**。开发遵循 **API 优先**：`swagger.json` 是契约，React 前端只请求 `/api/*`。我们有 Jest、Vitest 集成测试，以及对照 Swagger 的 **契约测试**。状态机、热力图聚合等规则 **只在服务器**。界面在手机和桌面上都能正常使用。

**口述 English**  
*Content requirements are implemented in our repository; organizational requirements — this presentation, team roles, and the live demo — complete the rest.* Then: We use NestJS on port 3001, expose CRUD on `/api/anime`, follow API first with `swagger.json`, provide integration and contract tests, keep business logic on the server, and deliver a responsive UI.

---

### 第 5 页 — 技术栈（约 1.5 分钟）

**中文（排练）**  
这张图概括了技术栈。**前端 3000**：Next.js、React、TypeScript、Tailwind、TanStack Query，以及轻量 i18n。**后端 3001**：NestJS、Mongoose、Swagger 和 Bee 定时任务。数据在 **MongoDB Atlas**，例如用户进度表 AnimeEntry 和镜像表 AnimeMirror。外部数据来自 **Jikan**（MAL 元数据）和 **Bangumi**（中文标题与时间表）。测试用 Vitest、Jest 和 anitrack-tester 契约工具。

**口述 English**  
Frontend: Next.js, React, TypeScript, Tailwind, React Query. Backend: NestJS, Mongoose, Swagger, Bee. MongoDB for entries and mirrors. External: Jikan and Bangumi. Testing: Vitest, Jest, and contract-validator.

**交接**  
「接下来由 [姓名 B] 介绍架构与 API。」

---

## 讲者 2（约 7 分钟）— 架构、Swagger、数据流、后端逻辑

*对应幻灯片 6–10*

### 第 6 页 — 系统架构（约 1.5 分钟）

**中文（排练）**  
浏览器只加载 **Next.js** 页面；所有业务数据都走 **NestJS REST API**。Nest 读写 **MongoDB**。**Bee** 后台从 Jikan、Bangumi 同步到 AnimeMirror，这样打开时间表和推荐不会每次都打外部 API。前端保持轻薄，API 也可给脚本客户端使用。

**口述 English**  
The browser loads Next.js; all business data goes through the NestJS API. Bee syncs external data into MongoDB so reads are mirror-first. The frontend stays thin and the API is reusable.

---

### 第 7 页 — Swagger（约 1.5 分钟）

**中文（排练）**  
这是 **`/api-docs`** 的 Swagger UI，仓库里有同一份 **`swagger.json`**。可以看到 anime 的 GET/POST、统计接口、Bee 运维接口和时间表元数据。错误统一为 `error.code`、`error.message` 和可选的 `details`。**我们没有另写一份 Word API 文档**；OpenAPI 文件就是文档，契约测试保证和运行中的服务一致。

**口述 English**  
This is Swagger at `/api-docs`. The contract is `swagger.json`. We use one error envelope, and contract tests keep the API aligned with the specification — no separate API document is needed.

---

### 第 8 页 — 用户路径（约 1 分钟）

**中文（排练）**  
用户主要用四个页面：**Dashboard** 看正在追的番和当季随机推荐；**Timetable** 用两周日期条看每日番剧；**Library** 搜索并管理清单；**Profile** 看人生纸格热力图和某月活动明细。

**口述 English**  
Four main areas: Dashboard, Timetable, Library, and Profile for the heatmap and monthly activity.

---

### 第 9 页 — 数据流（约 1.5 分钟）

**中文（排练）**  
添加番剧时前端只传 **malId**。后端 **Cache-Aside**：先查或拉取 **AnimeMeta**，再写 **AnimeEntry** 存用户状态和日期。列表返回里嵌套 `animeMeta` 方便展示。时间表优先读 **AnimeMirror**。Bangumi 映射在后台补中文标题，日志里可能有 `[i18n-map]`。

**口述 English**  
Adding an anime sends only `malId`. Cache-aside for AnimeMeta, user data in AnimeEntry, timetable reads the mirror first, Bangumi enriches titles in the background.

---

### 第 10 页 — 后端业务逻辑（约 1.5 分钟）

**中文（排练）**  
举三个例子。一，**状态机**：非法状态迁移返回 **409**。二，**热力图**：在 MongoDB 里按月聚合，强度 0–4，不在 React 里算。三，**Bee**：每 65 秒同步少量条目，做 Bangumi 映射，并处理限流退避。这些规则都不在前端实现。

**口述 English**  
State machine with 409 on invalid transitions, heatmap aggregation on the server, Bee syncing politely every 65 seconds — none of this logic lives in the frontend.

**交接**  
「下面由 [姓名 C] 介绍测试、响应式和演示。」

---

## 讲者 3（约 7 分钟）— 测试、响应式、演示、总结

*对应幻灯片 11–16*

### 第 11 页 — 测试（约 1.5 分钟）

**中文（排练）**  
**单元测试**覆盖热力图强度映射等纯函数。**集成测试**对真实 API 和 MongoDB 发请求，后端用 Jest，前端有 Vitest 集成。**契约测试**读取 `swagger.json` 做 HTTP 冒烟，确认路径、状态码和结构。这样 API-first 在改代码后仍可验证。

**口述 English**  
Unit tests for pure functions, integration tests against MongoDB, and contract tests against OpenAPI — so our API-first approach stays reliable.

---

### 第 12 页 — 响应式（约 1 分钟）

**中文（排练）**  
小屏有汉堡菜单、工具栏纵向排列；时间表日期条可横向滑动；热力图横向滚动且月份列固定。交付前前后端都跑过 build。

**口述 English**  
Hamburger navigation, scrollable date strip, horizontal heatmap — tested on mobile and desktop layouts.

---

### 第 13 页 — 演示引入（约 30 秒）

**中文（排练）**  
接下来做简短的 **现场演示**，界面使用英文。我会打开 Dashboard，在 Library 搜索并添加一条，再在 Profile 看热力图。

**口述 English**  
We now show a short live demo in English: dashboard, library search and add, then the profile heatmap.

---

### 第 14 页 — 现场演示（约 4 分钟）

| 步骤 | 中文（边做边说） | 口述 English |
|------|------------------|--------------|
| 1 | 这是 Dashboard：正在看的列表和从镜像抽样的当季推荐。 | Dashboard: watching list and seasonal picks from our mirror. |
| 2 | Library 搜索由后端代理 Jikan；添加只 POST malId。 | Library: search via backend; add with malId only. |
| 3 | 打开条目改状态，非法迁移会被后端拒绝。 | Status change is validated on the server. |
| 4 | Profile 热力图；点某月，活动列表来自 `/api/stats/activity`。 | Heatmap; click a month for activity from the API. |
| 5 | （可选）Timetable 选日期。 | Optional: timetable date strip. |

**若出错**  
中文：仓库里有 Swagger 和测试，演示环境可能需要稍等 MongoDB。  
English: We have Swagger and tests; the demo may need a moment to connect to MongoDB.

---

### 第 15 页 — 局限与展望（约 1 分钟）

**中文（排练）**  
部分时间表仍显示 **TBD**，因为上游没有可靠播出时刻。目前用临时单用户 ID，还没有登录。以后可做多用户和个性化推荐。课程要求的核心部分——API、CRUD、后端逻辑、测试、响应式——已经完成。

**口述 English**  
Some timetable slots are TBD due to upstream data. Single-user mode for now. Future: auth and recommendations. The core course scope is complete.

---

### 第 16 页 — 结束（约 20 秒）

**中文（排练）**  
汇报结束，谢谢。欢迎提问。

**口述 English**  
Thank you for your attention. We are happy to take your questions.

---

## 可能的提问（准备）

| 问题（中 / EN） | 中文答 | Oral EN |
|-----------------|--------|---------|
| 为什么 API first？ | 前后端和测试共用一份契约，改后端可验证。 | One contract for UI and tests. |
| 为什么用 MongoDB？ | 文档灵活，热力图适合聚合管道。 | Flexible schema and aggregation. |
| 为什么有 Bee？ | 降低 Jikan 限流，时间表读本地镜像。 | Mirror-first, fewer external calls. |
| 业务逻辑在哪？ | Nest 的 anime、stats、bee、anime-meta 模块。 | NestJS service modules. |
| Swagger 要单独写吗？ | 不必；维护 swagger.json + UI 展示即可。 | `swagger.json` is the documentation. |

---

## 单人答辩压缩版（约 15–20 分钟）

| 段落 | 页 | 中文要点 | 时长 |
|------|-----|----------|------|
| 开场+分工+课程 | 1–4 | 压缩为 3 分钟 | 3 min |
| 技术栈+架构+Swagger+数据 | 5–9 | 只讲图，少念字 | 5 min |
| 后端逻辑+测试+响应式 | 10–12 | 各 1–2 句 | 2 min |
| 现场演示 | 14 | 必做 | 4 min |
| 局限+Q&A | 15–16 | | 1 min |

不必念完每一句；**架构图 + Swagger + 演示** 是重点。

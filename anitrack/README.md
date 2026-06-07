# Anitrack 前端（Next.js）

> 仓库总览、前后端联调与契约测试见 **`../README.md`**。架构与 API 契约见 **`../PROJECT_BLUEPRINT.md`**。

本目录为 Anitrack **Next.js 16** 前端（默认 `http://localhost:3000`），通过 `fetch` 直连 NestJS 后端（`http://localhost:3001/api`）。

## 快速启动

```bash
npm install
npm run dev
```

后端需先在 `anitrack-backend/` 启动（见根 README）。

## 主要页面

| 路径 | 说明 |
|------|------|
| `/` | Dashboard：正在观看、当季推荐 |
| `/library` | 追番清单 CRUD |
| `/profile` | 统计 + **人生纸格（月）热力图** |
| `/timetable` | 新番时间表（多列横向滚动） |

## 热力图（Profile）

- 数据：`GET /api/stats/heatmap?start=YYYY-MM&end=YYYY-MM`（Next 路由代理至 NestJS）
- 每格一月，字段：`addedCount`、`completedCount`、`episodeCount`、`intensity`（0–4）
- **强度由后端计算**（前端只映射颜色）：
  - 权重 `score = addedCount + completedCount`
  - `0→0`，`1→1`，`2–4→2`，`5–8→3`，`≥9→4`
  - 实现：`anitrack-backend/src/common/utils/monthly-heatmap-intensity.ts`
- 点击格子：`GET /api/stats/activity?month=YYYY-MM`

## 测试

```bash
npm test                 # Vitest 单元/组件
npm run test:integration # heatmap 代理 integration 等
```

月度强度映射单测在 **后端 Jest**：`anitrack-backend/src/common/utils/monthly-heatmap-intensity.spec.ts`。

## 近期 UI 变更（2026-06-07）

- **Timetable**：由单日宽列表改为固定列宽的多日横向滚动（参考 animeko 追番列表）
- **Profile 热力图**：年份轴标签防重叠；底部月份 hover 时 tooltip 自动上翻，避免被容器裁切

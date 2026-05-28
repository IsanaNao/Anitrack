## Anitrack 图示产出（Mermaid 优先）

本目录用于存放 **图示相关的分析、源文件与导出成果**，对应 `TASK_PROGRESS.md` 第 12 章。

### 目录约定

- `./`：Mermaid 源文件（`.mmd`）
- `./figures/`：导出的 `svg` / `png`
- `./icons/`：技术栈与外部 API 的 logo 素材

> **Defense slides**: All exported figures use **English labels only** (no Chinese characters). Re-run `render-mermaid.ps1` after editing `.mmd` files.

### 图示一览（答辩 / 文档推荐顺序）

| 文件 | 用途 |
|------|------|
| **`tech-stack.mmd`** | **Tech stack** (English) — frameworks, DB, APIs, testing (opening slide) |
| `architecture.mmd` | **System architecture** (English) — runtime, Bee, collections |
| `user-flow.mmd` | **User flows** (English) — Dashboard / Timetable / Library / Profile |
| `data-flow.mmd` | **Data flow** (English) — malId, cache-aside, mirror, Bangumi mapping |

### 带 logo 的节点（仅下列使用图标）

| 节点 | 素材 |
|------|------|
| Next.js | `icons/nextjs.svg` |
| React / TypeScript / Tailwind / Node.js | devicon |
| NestJS / MongoDB | devicon |
| Jikan | Simple Icons · MyAnimeList |
| Bangumi | `icons/bangumi.ico`（bgm.tv 官方 favicon） |

其余（Bee、Mongoose 文字说明、Vitest/Jest 等）为 **纯文字框**。

### 一键导出（Windows / PowerShell）

在仓库根目录运行：

```powershell
.\anitrack-visuals\render-mermaid.ps1
```

- **PNG**：mermaid-cli + Chrome（保留文字与 logo）
- **SVG**：额外修复图标比例；**不要用 resvg 转 PNG**

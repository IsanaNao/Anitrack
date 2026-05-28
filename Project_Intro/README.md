# Project_Intro — 答辩材料目录 / Defense materials

存放答辩 **PPT、演讲稿、截图** 等。

| 用途 | Usage |
|------|--------|
| **准备与排练** | 本目录文档以 **中文为主**，并附德/英对照 |
| **幻灯片投屏 & 现场口述** | 建议 **English**（德国导师） |

> **课程符合性（一句话）**：内容要求已在项目中实现；组织要求靠答辩 PPT、分工页与 Live-Demo 完成。详见 [`项目要求.md`](./项目要求.md) 文首。

---

## 文件一览 / Files

| 文件 | 说明（中文） | Description (EN) |
|------|----------------|------------------|
| [`项目要求.md`](./项目要求.md) | 课程要求：**德文原文 + 中文对照** | Course requirements DE + ZH |
| [`答辩清单.md`](./答辩清单.md) | 排练检查清单（中英对照） | Bilingual checklist |
| [`演讲大纲.md`](./演讲大纲.md) | **PPT 大纲（中文为主）** | Slide outline (ZH primary) |
| [`PPT文字稿大纲.md`](./PPT文字稿大纲.md) | **演讲稿初稿（中文为主）** | Script draft (ZH primary) |

---

## 推荐流程 / Workflow

1. 读中文大纲 [`演讲大纲.md`](./演讲大纲.md)，做 `slides/Anitrack_Defense.pptx`。  
2. 幻灯片正文用 **英文**（大纲里每页有「投屏英文」一栏）。  
3. 按中文稿 [`PPT文字稿大纲.md`](./PPT文字稿大纲.md) 排练；现场口述用稿内 **English 对照**。  
4. 插图：`../anitrack-visuals/figures/*.png`  
5. 演示前：[`答辩清单.md`](./答辩清单.md)

---

## 子目录 / Subfolders

```text
Project_Intro/
├── slides/
│   └── Anitrack_Defense.pptx   # 16 页答辩 PPT（英文投屏）
├── build_defense_pptx.py       # 重新生成 PPT：python build_defense_pptx.py
└── screenshots/                # Swagger、响应式截图（待截，插入第 7/12 页）
```

**生成 PPT**：在 `Project_Intro/` 目录执行 `python build_defense_pptx.py`（需 `python-pptx`；图示来自 `anitrack-visuals/figures/*.png`）。

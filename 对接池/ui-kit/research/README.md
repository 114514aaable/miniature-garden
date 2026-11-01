# UI 套件：三套布局模型的拆解

把 Qt（尺寸策略）、Godot（容器组合）、Dear ImGui（立刻模式）三套东西拆成能直接用的判断，
不复制它们的实现，也不复制它们的控件库。

## 阅读顺序

| # | 文件 | 一句话 | 行数 |
|---|---|---|---|
| 1 | [qt-sizepolicy.md](qt-sizepolicy.md) | 七档尺寸策略 → 2 个布尔 + 1 个权重 | ~110 |
| 2 | [godot-containers.md](godot-containers.md) | 8 个容器 → 3 个元素 + 2 个属性 | ~140 |
| 3 | [imgui-immediate.md](imgui-immediate.md) | 立刻模式在 DOM 上怎么落地（含反面） | ~150 |
| 4 | **[mapping-to-dom.md](mapping-to-dom.md)** | **三份合成一套**：5 档 + 4 容器 + 10 个 HUD 函数 | ~130 |

**给 AI 的入口在上一层**：[`../AGENTS.md`](../AGENTS.md)。那份是判断与禁区，这四份是证据。

只要看结论，直接看第 4 份。

## 素材

| 文件 | 来源 | 许可 |
|---|---|---|
| `vendor/imgui.h` | Dear ImGui v1.93.1 WIP，从上游 raw 下载 | MIT |
| `../imgui_demo.cpp` | 同上，demo 代码（可选材料） | MIT |
| `../settings_menu.tscn` | 用户自建 Godot 4 场景 | 本项目 |
| — | Qt 6.12 / Godot 4 文档，仅在线阅读，未落盘 | FDL 1.3 / CC BY 3.0 |

**没有下载任何 Qt 源码**。LGPL 的东西只在文档层面接触，输出里不出现 Qt 代码。

## 约定的标注

- **[确认]** / **[源码]** / **[实证]** —— 有出处，可复核。
- **[推断]** —— 我推的，可能是错的，用前先验。
- **[决策]** —— 我下的判断，可以反驳。

## 验收

1. 看 `qt-sizepolicy.md` 的表，能对任意一档写出 `flex` 值。
2. 看 `godot-containers.md` 的树，能照着敲出一个设置界面。
3. 看 `imgui-immediate.md` 第 5 节，能说出 HUD 第一版走哪条路线、何时必须换。

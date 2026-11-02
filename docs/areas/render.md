# 模块：渲染（render）

> 改这里如果：**画面不对、要加图层、要接贴图**。
> 只是改颜色/字体 → 多半在 `visual.ts` 或 `pages.mjs` 的 CSS。

## 管线（一条线，没有别的分支）

```
服务端快照 snapshot
  → project.ts   投影：只挑需要的字段，转成 FrameSnapshot
  → visual.ts    投影到「视觉位置」：补间、跳变夹取（60fps）
  → draw.ts      纯函数：快照 → 绘制指令列表（buildFrame）
  → browser.ts   把指令画到 canvas；驱动 rAF、相机、图集
```

**渲染器不知道世界怎么运转**，只认快照。这是硬边界。

## 关键文件

| 文件 | 职责 |
|---|---|
| `project.ts` | 快照投影；**没有位置的实体不进快照** |
| `visual.ts` | 视觉位置：`clampDelta` / `stepVisual` |
| `draw.ts` | `buildFrame(snapshot, options)` → `DrawCommand[]`（纯函数，可测） |
| `browser.ts` | `attach(canvas)`：rAF、相机跟随、图集、光标/瞄准 |
| `atlas.ts` | TexturePacker JSON hash 解析 |
| `../intel/overlay.ts` | 情报叠加（预警格、血条），画在实体之后 |
| `../camera/camera.ts` | 世界 ↔ 屏幕 |

## 不变量

1. **`buildFrame` 是纯函数**：同输入同输出，不读时钟、不碰 DOM。
2. **动画不进逻辑**：补间、帧动画都按渲染时刻算，不回写世界。
3. **相机跟视觉位置**，不跟逻辑位置，否则补间会抖。
4. 画布尺寸跟容器走（`ResizeObserver`），不是跟窗口。

## 常见坑

- **实体没有位置**（被捡起、进背包）还留在快照里 → 会画在奇怪的地方。投影层已过滤，新加快照字段时记得同样处理。
- **`Int32Array` 不能直接进 JSON**：快照里地形要转普通数组。
- **高 DPI 屏**：现在按 CSS 像素 1:1 渲染，会略糊；要清晰得乘 `devicePixelRatio`，但会牵动指针换算，**动之前先想清楚**。
- 图集缺失时**必须能退回字符**，否则没美术就没法开发。

## 验证

```bash
node --test --test-isolation=none      # draw/visual/project 都有测试
node tools/build-web.mjs               # TS → web/
```

## 相关（先别读，用到再看）

| 文档 | 什么时候需要 |
|---|---|
| [ui.md](ui.md) | 你要画的是屏幕上的面板而不是世界里的东西 |
| [../systems/combat.md](../systems/combat.md) | 你要给攻击加特效 |
| [../areas/engine-core.md](engine-core.md) | 你要改快照里有什么 |

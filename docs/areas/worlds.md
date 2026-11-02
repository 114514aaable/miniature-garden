# 世界包与数据（worlds）

> 改这里如果：**你要加内容，不改引擎**。
> 引擎怎么跑这些数据 → 读 [`engine-core.md`](engine-core.md)。

## 一个包长什么样

```
game/worlds/<id>/
├─ pack.json         id / version / kind / requires / files
├─ terrains.json     地形号 → 含义（passable 才是关键）
├─ components.json   组件 + schema
├─ spaces/*.json     地图：宽高 + 行优先地形数组
├─ templates/*.json  模板：组件初始值，支持 extends
├─ entities/*.json   摆放：模板 + 空间 + 坐标
├─ groups/*.json     预制件：一组实体 + 偏移（用 stamp 盖）
└─ world.json        出生点 / 启用规则 / init / onConflict
```

**完整写法见 [`../pack-guide.md`](../pack-guide.md)**，这里只讲判断。

## 加东西的四种情况

| 你要加 | 动什么 | 要写代码吗 |
|---|---|---|
| 一个敌人 | `templates/` 一个模板 + `entities/` 摆一个 | 不用 |
| 一件道具 | 模板（带 `core.item`）+ 摆一个 + 语言包 | 不用 |
| 一件能用的道具 | 上面 + `core.use` | 不用 |
| 一个新动作 | 规则（见 [`rules.md`](rules.md)）+ `world.json` 启用 | **要** |

**先问自己：这是数据还是机制？** 数据进包，机制进规则。

## 不变量

1. `terrain` 数组长度必须等于 `width * height`，行优先。
2. 模板只能引用 `components.json` 里登记过的组件。
3. `extends` 是深合并，**只写差异**；循环继承会在加载期被拦。
4. 同名定义冲突默认报错（`onConflict: "error"`）。
5. 出生点必须落在 `passable` 的地形上。

## 常见坑

- 改了 `terrains.json` 的号却没改地图数组 → 一片看不懂的地形。
- 模板里写了 schema 没声明的字段（除 `x-` 前缀）→ 加载期报「未知字段」。
- 预制件 `stamp` 的偏移会叠加到基准点，**很容易盖到墙上**——`node tools/play.mjs` 看一眼。
- 语言包漏了名字，界面会显示 `template.xxx` 这种原始 key（不是空白）。

## 验证

```bash
node tools/play.mjs game/worlds/official.base game/worlds/official.normal
node tools/serve.mjs     # 启动器里选世界，开一局
```

## 下一步读

- 包格式细节 → [`../pack-guide.md`](../pack-guide.md)
- 加载与合并的实现 → [`engine-core.md`](engine-core.md)

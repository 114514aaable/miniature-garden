# 当前状态

> 给下一次开工用：现在有什么、哪里粗糙、下一步做什么。
> 找代码先看 [MAP.md](MAP.md)；架构看 [architecture.md](architecture.md)。

## 能玩到什么

```
启动器    选世界 → 开始弹窗（种子 + 宽高 + 生成方式）→ 进游戏
三个世界  official.normal   盐港：噪声 + 群系
          official.dungeon  元胞地牢：纯洞穴，切成 4 个洞厅
          official.cavern   洞穴地表：地表 + 洞穴 + 洞底（流水线叠加）
地图      4..200 任选尺寸，开局现场生成；存档按 seed + 尺寸复现
动作      走路、劈砍、蓄力劈砍（10 回合）、横扫、休息、捡起/放下/使用、等待、交谈
敌人      起手（红格预警 + 倒计时）→ 结算；走出去就落空
对话      按 E 选目标 → 台词 → 数字键选选项 → Esc 离开
界面      立绘（可收）/ 状态条 / 小地图 / 24 格快捷栏 / 右下 3×4 点击映射
存档      槽位 + 防炸档（包清单校验）+ 场景栈（对话能回到具体那句）
```

## 这一阶段做完的（表现 / 时间）

- **步进统一成「帧」**：`advanceTo` 每 tick 产一帧（位置 / 血条 / 事件 / 生成 / 消失），
  响应带 `frames`；客户端逐帧播放，播完回到最终状态。
  - 末尾的挂起结算也补一帧，不再「跳」出结果。
  - 播放时只重画画布 + 状态栏，HUD 不闪。
- **短动作更快**：≤3 帧的动作 55ms/帧（移动约 110ms 一格），长动作按配置。
- **蓄力 = pending**：点一下挂 `core.pending`，进度条画在脚底血条上方，
  每 400ms 自动推一回合；到点落刀。
- **休息 = pending**：4 回合后回 2 血，和蓄力同一套表现。
- **动作占用通道**：`hand` / `move`；`core.body.hands` 默认 2。
  蓄力占一只手 → 可以边跑边蓄（走开就落空），二次蓄力被拒。
- **实体技能加射程检查**：够不着直接拒绝（以前能隔空起手）。
- **配置**：`frameMs`（30..500）、`chargeTickMs`（100..2000），设置里可调。

## 代码结构

```
game/
├─ engine/core/     内核 + 规则实现（store / space / event / pack / rules / worldgen）
├─ systems/         render · camera · ui · i18n · input · log · config · intel · scene · rules
└─ worlds/          official.base（数据）· normal / dungeon / cavern（三个世界）
tools/
├─ serve.mjs        本地服务 + 全部接口（advanceTo 产帧）
├─ client/          game.js（调度 + 帧播放）+ hud/（区域）+ launcher + shared
├─ play.mjs         无头跑世界
├─ gen-*.mjs        文档生成 / 离线生成地图
└─ check-*.mjs      client（未定义函数）/ locale（语言包）/ data（字段缺口）
```

**分层规矩**：规则返回效果，宿主执行；场景返回意图，宿主执行；区域不碰 config 与网络（走 ctx）。
**改 `game/systems/**` 后要跑 `node tools/build-web.mjs`**（页面加载的是 `web/` 构建产物）。

## 生成器

```
overworld    噪声 → 群系 → 地形
caves        元胞自动机（fill / iterations / regions / chambers）
pipeline     overworld → caves → blend，可叠加成「地表 + 洞穴」
确定性       纯函数 + 按坐标派发；元胞是迭代算法（不可按格并行）
```

**流水线约定**：每一步只改同一个 sandbox（地形数组 + 具名图层），顺序即覆盖顺序。

## 输入与体验

```
长按方向键    110ms 节奏走一格（松手/失焦停）
动作互斥      客户端一次只发一个动作
服务端限速    60ms 内重复请求 → 「慢一点」
小地图        按尺寸缩放（1..4 px/格，最长边约 180）
```

## 已知粗糙的地方

```
1  aim 只返回单格；多格技能的命中判定还靠规则里的 tools
2  点击映射只有 4 行 × 单槽，未支持拖技能进槽
3  背包 / 设置 / 对话面板仍在 game.js（未拆到 windows/）
4  感知层（视野 / 光照 / 声音）只有设计，没有实现
5  AI 接口（/api/ability 等）只有设计
6  世界包还不能带代码（runtime.md 的方案未实现）
7  群系只有二维（height / moisture），没有「深度」
8  地牢里没有怪、没有宝箱（内容还没放）
9  小地图是整张缩略：200×200 会挤成一团；缺视角与视野机制
10 规则的 reason 被吞掉（敌人不动手时看不到原因）
11 帧只覆盖位置/血条/事件；意图、场景、地形变化还没进帧
12 蓄力/休息的「进度」只在画布上，HUD 没有单独区域
13 一次 10 回合的蓄力，敌人会走 10 步——数量级还没调平衡
```

## 下一步候选

```
A  地牢内容：怪（复用 core.melee）+ 宝箱（容器/战利品）
B  视角与视野：小地图按镜头画、视距；作为感知层前置
C  拆 windows/：背包、设置、对话面板
D  洞口切换空间（core.portal）：两张图之间的通路
E  群系深度维度：地下群系表（蘑菇/岩浆/水晶）
F  意图进帧：红格预警逐步出现
```

**建议顺序：A → F → B → D**（先让地牢能玩，再让预警可见，再做视野）。

## 运行

```bash
node tools/build-web.mjs      # 构建浏览器端（改 systems 后必须跑）
node tools/serve.mjs          # 8787
PORT=8788 node tools/serve.mjs

node --test --test-isolation=none     # 536 个测试
node tools/typecheck.mjs              # 0 错误
node tools/check-client.mjs           # 页面脚本自检
node tools/check-data.mjs             # 数据体检
node tools/check-locale.mjs           # 语言包体检

node tools/gen-docs.mjs && node tools/gen-file-docs.mjs && node tools/gen-map.mjs \
  && node tools/gen-tree.mjs && node tools/gen-pack-graph.mjs
```

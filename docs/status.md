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
动作      走路、劈砍、蓄力劈砍、横扫、捡起、放下、使用、等待、交谈
敌人      起手（红格预警 + 倒计时）→ 结算；走出去就落空
对话      按 E 选目标 → 台词 → 数字键选选项 → Esc 离开
界面      立绘（可收）/ 状态条 / 小地图 / 24 格快捷栏 / 右下 3×4 点击映射
存档      槽位 + 防炸档（包清单校验）+ 场景栈（对话能回到具体那句）
```

## 代码结构

```
game/
├─ engine/core/     内核 + 规则实现（store / space / event / pack / rules / worldgen）
├─ systems/         render · camera · ui · i18n · input · log · config · intel · scene · rules
└─ worlds/          official.base（数据）· normal / dungeon / cavern（三个世界）
tools/
├─ serve.mjs        本地服务 + 全部接口
├─ client/          game.js（调度）+ hud/（区域）+ launcher + shared
├─ play.mjs         无头跑世界
├─ gen-*.mjs        文档生成（docs / files / MAP / tree / pack-graph）
├─ gen-world.mjs    离线生成一张地图
└─ check-*.mjs      client（未定义函数）/ locale（语言包）/ data（字段缺口）
```

**分层规矩**：规则返回效果，宿主执行；场景返回意图，宿主执行；区域不碰 config 与网络（走 ctx）。

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
长按方向键    固定 140ms 节奏走一格（松手/失焦停）
动作互斥      客户端一次只发一个动作
服务端限速    60ms 内重复请求 → 「慢一点」
小地图        按尺寸缩放（1..4 px/格，最长边约 180）
```

## 最近做完的

- 确定性随机、场景框架 + 对话、遍历核心（算子/变换/落点/条件/选定）
- 情报层（预警格、脚底血条、蓄力条）
- 存档槽位与防炸档；存在感组件 + 活动空间调度
- 物种 × 地形对接（`core.locomotion` / `surface`），加载期编译通行表
- 数据体检、语言包体检、页面脚本自检
- 生成器：噪声、群系、元胞、洞厅切分、流水线叠加
- 自定义地图尺寸（4..200）、开局现场生成、读档复现

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
11 旧存档里被禁用的 core.* 需要重新勾选（已有别名表）
```

## 下一步候选

```
A  地牢内容：怪（复用 core.melee）+ 宝箱（容器/战利品）
B  视角与视野：小地图按镜头画、视距；作为感知层前置
C  拆 windows/：背包、设置、对话面板
D  洞口切换空间（core.portal）：两张图之间的通路
E  群系深度维度：地下群系表（蘑菇/岩浆/水晶）
```

**建议顺序：A → B → D**（先把地牢变成能玩的地方，再做视野，再连上下层）。

## 运行

```bash
node tools/build-web.mjs      # 构建浏览器端
node tools/serve.mjs          # 8787
PORT=8788 node tools/serve.mjs

node --test --test-isolation=none     # 524 个测试
node tools/typecheck.mjs              # 0 错误
node tools/check-client.mjs           # 页面脚本自检
node tools/check-data.mjs             # 数据体检
node tools/check-locale.mjs           # 语言包体检

node tools/gen-docs.mjs && node tools/gen-file-docs.mjs && node tools/gen-map.mjs \
  && node tools/gen-tree.mjs && node tools/gen-pack-graph.mjs
```

# 当前状态

> 给下一次开工用：现在有什么、哪里粗糙、下一步做什么。
> 找代码先看 [MAP.md](MAP.md)；架构看 [architecture.md](architecture.md)。

## 能玩到什么

```
启动器    选世界包 → 开始弹窗（生成方式 + 种子 + 宽高）→ 进游戏
世界包    base（框架包，显示为依赖）→ normal（第一个 mod，可玩）
生成方式  开始菜单里自由选：
          噪声地表 / 洞穴 / 迷宫 / 房间 / 拼贴 / 散落 / 洞穴地表
地图      4..200 任选尺寸，开局现场生成；存档按 seed + 尺寸 + 方案复现
动作      走路、劈砍、蓄力劈砍（10 回合）、横扫、休息、捡起/放下/使用、等待、交谈
敌人      起手（红格预警 + 倒计时）→ 结算；走出去就落空
对话      按 E 选目标 → 台词 → 数字键选选项 → Esc 离开
界面      立绘（可收）/ 状态条 / 小地图 / 24 格快捷栏 / 右下 3×4 点击映射
存档      一个存档 = 一个世界（saves/<id>/{world.json,state.json}）；阶段快照可叠加
```
## 世界生成（这一阶段的重点）

**7 种生成器 + 2 个修饰算子 + 1 个实体投放算子**，全部走同一条流水线：

```
overworld    噪声 → 群系 → 地形
caves        元胞自动机（默认直接写地形；as 才写图层给 blend）
maze         迭代回溯 + 编织；保证连通
rooms        BSP + 门图（门=顶点、房间=团）+ A* 修路
tiles        7×7 件 + 门口 + 旋转 + 加权 + 兜底
layout       大房间（多格）+ 走廊格拼贴，图的边决定门口
sprawl       自由摆放 + Gabriel 图 + 噪声 A* + 走廊加宽
place        摆结构（数量 / 间距 / 允许地形 / 权重）
blend        洞穴层盖到地表
populate     实体图投放（房间标签 / 走廊 / 死胡同，出生点留空）
```

**结构件是纯数据**：任意尺寸、任意门、可旋转、可带实体与子结构（加载期展开、查环）。
**实体图**：`cell → [实体(模板+标签)]`，和地形一起产出，宿主统一落成真实实体。

## 代码结构

```
game/
├─ engine/core/     内核 + 规则实现（store / space / event / pack / rules / worldgen）
├─ systems/         render · camera · ui · i18n · input · log · config · intel · scene · rules
└─ worlds/          base（框架数据）· normal（第一个 mod）
tools/
├─ serve.mjs        本地服务 + 全部接口（advanceTo 产帧）
├─ client/
│   ├─ game.js      调度 + 帧播放 + 输入路由
│   ├─ hud/         区域：status / minimap / quickbar / aim
│   ├─ windows/     窗口：settings / inventory
│   ├─ launcher.js  启动器
│   └─ shared.js    api + 错误条
├─ play.mjs         无头跑世界
├─ gen-*.mjs        文档生成 / 离线生成地图 / 生成测试件
└─ check-*.mjs      client（未定义函数 / 重复声明）/ locale / data
```

**分层规矩**：规则返回效果，宿主执行；场景返回意图，宿主执行；区域/窗口不碰 config 与网络（走 ctx）。
**改 `game/systems/**` 后要跑 `node tools/build-web.mjs`**（页面加载的是 `web/` 构建产物）。

## 输入与体验

```
长按方向键    110ms 节奏走一格（松手/失焦停）
动作互斥      客户端一次只发一个动作
服务端限速    60ms 内重复请求 → 「慢一点」
小地图        按尺寸缩放（1..4 px/格，最长边约 180）
帧            每 tick 一帧（投影记录 diff）；短动作 55ms/帧
```

## 已知粗糙的地方

```
1  aim 只返回单格；多格技能的命中判定还靠规则里的 tools
2  点击映射只有 4 行 × 单槽，未支持拖技能进槽
3  对话面板 / 快捷栏 / 死亡浮层仍在 game.js（背包与设置已拆到 windows/）
4  感知层（视野 / 光照 / 声音）只有设计，没有实现
5  AI 接口（/api/ability 等）只有设计
6  世界包还不能带代码（runtime.md 的方案未实现）
7  群系只有二维（height / moisture），没有「深度」
8  地牢有箱子/火把（populate），但没有怪、陷阱、大门/机关
9  小地图是整张缩略：200×200 会挤成一团；缺视角与视野机制
10 规则的 reason 被吞掉（敌人不动手时看不到原因）
11 场景与地形变化还没进帧（实体这一层已经是投影 diff）
12 蓄力/休息的「进度」只在画布上，HUD 没有单独区域
13 一次 10 回合的蓄力，敌人会走 10 步——数量级还没调平衡
14 拆窗口时容易漏改宿主变量（applyDevMode / stateSkills 已各犯一次）
15 实体图还没有 id / links：大门+拉杆这类成对固定物做不了
16 投放密度没有总预算：40 间房能撒出 100+ 箱子
```

## 下一步候选

```
下一次开工（已定好的顺序）
A  ✅ 抽宿主逻辑：game/systems/host/effects.ts（统一效果入口）+
      host/advance.ts（推进与产帧）+ host/frames.ts（投影 diff）
      —— serve 只剩适配器；新增 15 个测试
B  共享测试工具：worldgen 测试里的 setup / orphans 等重复 helper
C  ✅ 数据写拦截骨架：core.write 事件 + consume 约定 + 标记不递归
      （serve 的 resolveEntityWrite；没有规则时零开销）
D  ✅ 数据写规则：按「参数名 + 变化方式」声明（clamp/set/maxField/致死阈值）
      默认 baseWriteRules：core.health.hp 夹 0..max，到 0 判致死
E  ✅ 致死单独成规则 base.death：写拦截器判致死 → 广播 → 规则决定后果
      攻击/横扫/敌人打击改成「只写 hp」，不再自己判死
F  部位规则包：换掉 writeRules，同一入口写 core.body 部位实例

硬编码清理（已完成一部分）
✅ 伤害公式统一到 rules/damage.ts（攻击/横扫/敌人）
✅ 休息回合数与回血量改为 core.rest 组件（模板可覆盖）
⬜ 起手默认 10 回合、动作成本表、规则文案尚未数据化
```

```
之后
D  固定物：实体 id/links + fixtures 算子 + 大门/拉杆
E  陷阱与怪：踩上去触发 / 复用 core.melee
F  玩法闭环：地牢目标（楼梯 / 出口 / 拿满什么）
G  视角与视野：从部位派生（眼睛 / 耳朵），可开关
H  拆 windows/：对话面板、快捷栏、死亡浮层
I  洞口切换（core.portal）
```

**A → B → C 是「部位反馈」的前置**：拦截器必须有统一入口才挂得上。

## 运行

```bash
node tools/build-web.mjs      # 构建浏览器端（改 systems 后必须跑）
node tools/serve.mjs          # 8787
PORT=8788 node tools/serve.mjs

node --test --test-isolation=none     # 584 个测试
node tools/typecheck.mjs              # 0 错误
node tools/check-client.mjs           # 页面脚本自检
node tools/check-data.mjs             # 数据体检
node tools/check-locale.mjs           # 语言包体检

node tools/gen-docs.mjs && node tools/gen-file-docs.mjs && node tools/gen-map.mjs \
  && node tools/gen-tree.mjs && node tools/gen-pack-graph.mjs
```

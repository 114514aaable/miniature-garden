# 当前状态

> 给下一次开工用：现在有什么、哪里粗糙、下一步做什么。
> 架构看 [architecture.md](architecture.md)，文件说明看 [files/](files/README.md)。

## 能玩到什么

```
启动器：选世界 → 输入种子 → 进游戏
地图：8×6 港口，玩家 / 盐商 / 木箱 / 油灯 / 药水
动作：走路、劈砍、蓄力劈砍、捡起、放下、使用、等待、交谈
敌人：起手（红格预警 + 倒计时）→ 两回合后结算；走出去就落空
对话：按 E（或快捷栏）选目标 → 说台词 → 数字键选选项 → Esc 离开
界面：立绘（可收）/ 状态条 / 小地图 / 24 格快捷栏 / 右下 3×4 点击映射
存档：槽位 + 防炸档（包清单校验）；死亡浮层可读档/重开
```

## 代码结构

```
game/
├─ engine/core/     内核 + 规则实现（store / space / event / pack / rules）
├─ systems/         render · camera · ui · i18n · input · log · config · intel · scene · rules(注册表)
└─ worlds/          official.base（数据）· official.normal（示例世界 + 对话脚本）
tools/
├─ serve.mjs        本地服务 + 全部接口
├─ client/          页面脚本：game.js（调度）+ hud/（区域）+ launcher + shared
├─ pages.mjs        HTML/CSS 骨架
├─ play.mjs         无头跑世界
├─ gen-docs / gen-tree / gen-pack-graph / gen-file-docs   文档生成
└─ check-client.mjs 页面脚本「调用了但没定义」自检
```

**分层规矩**：规则返回效果，宿主执行；场景返回意图，宿主执行；区域不碰 config 与网络（走 ctx）。

## 最近做完的

- 确定性随机（seed + tick + tag）
- 场景框架 + 对话框场景（选目标、节点图、选项）
- 遍历核心：算子 / 变换 / 落点 / 条件 / 选定
- base 的命名形状与条件（traversal.json）
- 情报层：预警格、脚底血条、蓄力条
- 存档槽位与防炸档；存在感组件 + 活动空间调度
- UI 拆出 hud 区域；点击动作数据化（技能或内置动作，候选上限 8）

## 已知粗糙的地方

```
1. 场景的当前节点存在闭包里 —— 存档不恢复「说到第几句」
2. aim 只返回单格；多格技能（横扫）还没接
3. 点击映射只有 4 行 × 单槽，未支持拖技能进槽
4. 背包 / 设置 / 对话面板仍在 game.js（未拆到 windows/）
5. 感知层（mask / 视野 / 声音）只有设计，没有实现
6. AI 接口（/api/ability 等）只有设计
7. 地图生成器只有讨论，没有代码
8. 世界包还不能带代码（runtime.md 的方案未实现）
9. 旧存档里被禁用的 core.* 需要重新勾选（tag 改过，已有别名表）
```

## 下一步候选

```
A. 场景机制收尾：对话节点进 core.scene（存档可恢复）、多格 aim
B. 拆分 windows/：背包、设置、对话面板从 game.js 搬出
C. AI 接口：/api/ability + 结构化错误（hint）
D. 地形生成：noise / map / rooms（离线生成，产出 pack 数据）
E. 内容：敌对单位模板、更多技能（验证遍历体系）
```

**建议顺序：B → A → C**（先把 UI 拆干净，再把场景做完整，然后开放给 AI）。

## 运行

```bash
node tools/build-web.mjs      # 构建浏览器端
node tools/serve.mjs          # 8787
PORT=8788 node tools/serve.mjs

node --test --test-isolation=none     # 471 个测试
node tools/typecheck.mjs              # 0 错误
node tools/check-client.mjs           # 页面脚本自检
node tools/gen-docs.mjs && node tools/gen-file-docs.mjs && node tools/gen-tree.mjs && node tools/gen-pack-graph.mjs
```

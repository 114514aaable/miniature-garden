# 文件说明（自动生成）

> 由 `node tools/gen-file-docs.mjs` 生成，**不要手改**。
> 只写机器能确定的东西（导出、依赖、被引用、测试）。
> 「为什么这么写」见 [areas](../areas) 与 [systems](../systems)。

共 113 个文件。

| 文件 | 一句话 | 说明 |
|---|---|---|
| `game/engine/core/src/bind.ts` | 「对接」：两边各自声明自己能接什么，再算谁和谁接得上。 | [md](game/engine/core/src/bind.md) |
| `game/engine/core/src/entity/entity.ts` | 实体：世界里「一个东西」的最小记录。 | [md](game/engine/core/src/entity/entity.md) |
| `game/engine/core/src/entity/merge.ts` | 合并：模板默认值 + 实例覆盖 = 这个实体此刻的完整数据。 | [md](game/engine/core/src/entity/merge.md) |
| `game/engine/core/src/entity/place.ts` | 位置：内核唯一保留的组件名。 | [md](game/engine/core/src/entity/place.md) |
| `game/engine/core/src/entity/template.ts` | 模板：世界包里「一类东西长什么样」。 | [md](game/engine/core/src/entity/template.md) |
| `game/engine/core/src/event/effects.ts` | 效果：结果里的「我要改世界」的描述（契约 §9）。 | [md](game/engine/core/src/event/effects.md) |
| `game/engine/core/src/event/evaluate.ts` | 求值器：把一棵信封树跑成结果。 | [md](game/engine/core/src/event/evaluate.md) |
| `game/engine/core/src/event/registry.ts` | 注册表：标签 → 签名，以及加载期的「链接」。 | [md](game/engine/core/src/event/registry.md) |
| `game/engine/core/src/event/schema.ts` | 极小类型语言：校验数据包里的参数和返回值。 | [md](game/engine/core/src/event/schema.md) |
| `game/engine/core/src/event/view.ts` | 只读视图：规则看世界的唯一通道。 | [md](game/engine/core/src/event/view.md) |
| `game/engine/core/src/pack/definitions.ts` | 世界内容的定义格式：空间、模板、实体、地形、世界。 | [md](game/engine/core/src/pack/definitions.md) |
| `game/engine/core/src/pack/graph.ts` | 世界结构图：把「这个包里到底有什么、谁引用谁」画出来。 | [md](game/engine/core/src/pack/graph.md) |
| `game/engine/core/src/pack/init.ts` | 开局初始化：世界建好之后，按顺序执行世界包声明的 init。 | [md](game/engine/core/src/pack/init.md) |
| `game/engine/core/src/pack/load.ts` | 加载器：把合并后的内容池变成运行时对象。 | [md](game/engine/core/src/pack/load.md) |
| `game/engine/core/src/pack/manifest.ts` | 包清单（pack.json）：一个内容包的自述。 | [md](game/engine/core/src/pack/manifest.md) |
| `game/engine/core/src/pack/merge.ts` | 合并：把多个包的内容并进同一个池子。 | [md](game/engine/core/src/pack/merge.md) |
| `game/engine/core/src/pack/order.ts` | 加载顺序：依赖图 + 拓扑排序。 | [md](game/engine/core/src/pack/order.md) |
| `game/engine/core/src/rules/ai.ts` | 敌人 AI：只做「选择」，不做「判定」。 | [md](game/engine/core/src/rules/ai.md) |
| `game/engine/core/src/rules/aim.ts` | 指向：鼠标/键盘选一个格子，问「这个技能能不能落在这里」。 | [md](game/engine/core/src/rules/aim.md) |
| `game/engine/core/src/rules/attack.ts` | 攻击：相邻 → 扣血 → 血尽则倒。 | [md](game/engine/core/src/rules/attack.md) |
| `game/engine/core/src/rules/clock.ts` | 游戏时钟：引擎的 tick 和游戏里的「回合」之间的唯一换算处。 | [md](game/engine/core/src/rules/clock.md) |
| `game/engine/core/src/rules/collision.ts` | 碰撞规则：谁能挡路。 | [md](game/engine/core/src/rules/collision.md) |
| `game/engine/core/src/rules/enemy-actions.ts` | 敌人的三个动作：起手、命中、走位。 | [md](game/engine/core/src/rules/enemy-actions.md) |
| `game/engine/core/src/rules/inventory.ts` | 物品栏规则：捡起、放下。 | [md](game/engine/core/src/rules/inventory.md) |
| `game/engine/core/src/rules/move.ts` | 第一条真规则：走一格。 | [md](game/engine/core/src/rules/move.md) |
| `game/engine/core/src/rules/pending.ts` | 挂起动作：现在不做，过几回合再做。 | [md](game/engine/core/src/rules/pending.md) |
| `game/engine/core/src/rules/rest.ts` | 休息：和蓄力同一套机制——点一下挂 pending，到点结算。 | [md](game/engine/core/src/rules/rest.md) |
| `game/engine/core/src/rules/rng.ts` | 随机数：无状态派发。 | [md](game/engine/core/src/rules/rng.md) |
| `game/engine/core/src/rules/scheduler.ts` | 调度器：谁该动了。 | [md](game/engine/core/src/rules/scheduler.md) |
| `game/engine/core/src/rules/sum.ts` | 第一个规则：求和。 | [md](game/engine/core/src/rules/sum.md) |
| `game/engine/core/src/rules/sweep.ts` | 横扫：打「自己周围一圈」里所有活着的目标。 | [md](game/engine/core/src/rules/sweep.md) |
| `game/engine/core/src/rules/talk.ts` | 交谈：和「劈砍」一样是一条技能——有目标、有射程、能进快捷栏。 | [md](game/engine/core/src/rules/talk.md) |
| `game/engine/core/src/rules/use.ts` | 使用物品：把背包里的东西「用」出去。 | [md](game/engine/core/src/rules/use.md) |
| `game/engine/core/src/rules/wait.ts` | 等待：什么都不做，只让时间走。 | [md](game/engine/core/src/rules/wait.md) |
| `game/engine/core/src/space.ts` | 空间：一个网格容器，属于数据层。 | [md](game/engine/core/src/space.md) |
| `game/engine/core/src/stencils.ts` | 偏移集（stencil）：规则层的第一个文件。 | [md](game/engine/core/src/stencils.md) |
| `game/engine/core/src/store.ts` | Store：世界状态的唯一写入口。 | [md](game/engine/core/src/store.md) |
| `game/engine/core/src/time.ts` | 时间线：一个单调的时钟 + 它自己的记录。 | [md](game/engine/core/src/time.md) |
| `game/engine/core/src/traversal/filter.ts` | 条件：给定一个实体的组件，判断它算不算目标。 | [md](game/engine/core/src/traversal/filter.md) |
| `game/engine/core/src/traversal/offsets.ts` | 偏移算子：形状 → 一组相对偏移。 | [md](game/engine/core/src/traversal/offsets.md) |
| `game/engine/core/src/traversal/resolve.ts` | 偏移 → 格子：落点、去重、裁剪。 | [md](game/engine/core/src/traversal/resolve.md) |
| `game/engine/core/src/traversal/select.ts` | 选定核心：从一组格子里挑出「符合条件的目标」。 | [md](game/engine/core/src/traversal/select.md) |
| `game/engine/core/src/traversal/shapes.ts` | 命名形状与命名条件：把 base 的 traversal.json 变成可用的东西。 | [md](game/engine/core/src/traversal/shapes.md) |
| `game/engine/core/src/traversal/transform.ts` | 偏移 → 偏移：形状的组合就是靠这几个变换。 | [md](game/engine/core/src/traversal/transform.md) |
| `game/engine/core/src/worldgen/caves.ts` | 元胞地牢：元胞自动机（cellular automata）挖洞穴。 | [md](game/engine/core/src/worldgen/caves.md) |
| `game/engine/core/src/worldgen/generate.ts` | 生成一片地形：种子 + 尺寸 + 场参数 + 群系 → 地形号数组。 | [md](game/engine/core/src/worldgen/generate.md) |
| `game/engine/core/src/worldgen/layout.ts` | 布局：在 meta 网格上摆「房间」和「走廊」，边决定门口。 | [md](game/engine/core/src/worldgen/layout.md) |
| `game/engine/core/src/worldgen/maze.ts` | 迷宫生成（迭代回溯 + 可选编织）。 | [md](game/engine/core/src/worldgen/maze.md) |
| `game/engine/core/src/worldgen/noise.ts` | 噪声：把「种子 + 坐标」变成 0..1 的值。 | [md](game/engine/core/src/worldgen/noise.md) |
| `game/engine/core/src/worldgen/pipeline.ts` | 生成流水线：把生成算法拆成「一步一个算子」，串起来跑。 | [md](game/engine/core/src/worldgen/pipeline.md) |
| `game/engine/core/src/worldgen/populate.ts` | 实体投放：按「房间 / 走廊 / 死胡同」的规则往实体图里放东西。 | [md](game/engine/core/src/worldgen/populate.md) |
| `game/engine/core/src/worldgen/random.ts` | 生成器共用的小随机：只依赖种子，不读时钟。 | [md](game/engine/core/src/worldgen/random.md) |
| `game/engine/core/src/worldgen/rooms.ts` | 房间布局：BSP 摆房间 → 门当顶点 → 修走廊把门连起来。 | [md](game/engine/core/src/worldgen/rooms.md) |
| `game/engine/core/src/worldgen/select.ts` | 选：把「若干场」翻译成「群系」，再把群系翻译成「地形」。 | [md](game/engine/core/src/worldgen/select.md) |
| `game/engine/core/src/worldgen/sprawl.ts` | 散落地牢：房间自由摆放 + 房间图 + 绕路 + 走廊加宽。 | [md](game/engine/core/src/worldgen/sprawl.md) |
| `game/engine/core/src/worldgen/structures.ts` | 结构：带图例的字符画，摆进生成出来的地图里。 | [md](game/engine/core/src/worldgen/structures.md) |
| `game/engine/core/src/worldgen/tiles.ts` | 拼贴：把 7×7 的房间件按「门口」贴成一张图。 | [md](game/engine/core/src/worldgen/tiles.md) |
| `game/engine/core/types/node-shim.d.ts` | 临时的 node 类型声明。 | [md](game/engine/core/types/node-shim.d.md) |
| `game/systems/camera/camera.ts` | 相机：把「看哪儿」从渲染里拆出来。 | [md](game/systems/camera/camera.md) |
| `game/systems/config/config.ts` | 界面配置：所有「可能想调」的东西集中在这里。 | [md](game/systems/config/config.md) |
| `game/systems/host/advance.ts` | 推进：把世界推到目标 tick，同时产帧。 | [md](game/systems/host/advance.md) |
| `game/systems/host/effects.ts` | 宿主的「效果入口」：规则 / 场景产出的效果，统一从这里落进 store。 | [md](game/systems/host/effects.md) |
| `game/systems/host/frames.ts` | 帧：把「这一 tick 的投影实体」和「上一 tick」做 diff。 | [md](game/systems/host/frames.md) |
| `game/systems/host/health-write.ts` | 数据写规则（第一套）：核心血量的数值变化。 | [md](game/systems/host/health-write.md) |
| `game/systems/i18n/i18n.ts` | i18n：界面文字走 key，不写死在代码里。 | [md](game/systems/i18n/i18n.md) |
| `game/systems/input/bindings.ts` | 按键映射：`event.code` → 命令字符串。 | [md](game/systems/input/bindings.md) |
| `game/systems/intel/facts.ts` | 情报：关于一个实体或一个格子，我们「知道什么」。 | [md](game/systems/intel/facts.md) |
| `game/systems/intel/overlay.ts` | 情报的「常驻」呈现：画在世界坐标上。 | [md](game/systems/intel/overlay.md) |
| `game/systems/log/devlog.ts` | 开发日志：给「排查问题的人」看，不是给玩家看。 | [md](game/systems/log/devlog.md) |
| `game/systems/render/atlas.ts` | 图集：读 TexturePacker 的 JSON hash 格式。 | [md](game/systems/render/atlas.md) |
| `game/systems/render/browser.ts` | 浏览器侧的渲染器：拿快照、自己跑 60fps、自己插值。 | [md](game/systems/render/browser.md) |
| `game/systems/render/contract.ts` | 渲染契约：渲染器在启动时声明「我需要什么」。 | [md](game/systems/render/contract.md) |
| `game/systems/render/draw.ts` | 绘制指令：把快照翻译成「画什么」。 | [md](game/systems/render/draw.md) |
| `game/systems/render/project.ts` | 投影：按契约从世界生成一张「照片」。 | [md](game/systems/render/project.md) |
| `game/systems/render/visual.ts` | 视觉投影：渲染位置永远从逻辑位置重算。 | [md](game/systems/render/visual.md) |
| `game/systems/rules/aliases.ts` | 旧 tag 的别名表。 | [md](game/systems/rules/aliases.md) |
| `game/systems/rules/base.ts` | base 包的规则：劈砍、蓄力劈砍。 | [md](game/systems/rules/base.md) |
| `game/systems/rules/index.ts` | 规则清单：一条规则 = 签名 + 处理器。 | [md](game/systems/rules/index.md) |
| `game/systems/rules/passage.ts` | 通行：物种 × 地形 的对接结果。 | [md](game/systems/rules/passage.md) |
| `game/systems/scene/dialog.ts` | 对话框场景。 | [md](game/systems/scene/dialog.md) |
| `game/systems/scene/scene.ts` | 场景：世界现在处于哪种「玩法状态」。 | [md](game/systems/scene/scene.md) |
| `game/systems/tick/phases.ts` | 每 tick 的阶段表。 | [md](game/systems/tick/phases.md) |
| `game/systems/ui/dom.ts` | 把 spec 变成真实 DOM。这一层不判断任何布局，只做搬运。 | [md](game/systems/ui/dom.md) |
| `game/systems/ui/flex.ts` | 尺寸策略：把「谁可以让步」压缩成 5 档，翻译成 flex。 | [md](game/systems/ui/flex.md) |
| `game/systems/ui/minimap.ts` | 小地图：把一整个空间压成一张缩略图。 | [md](game/systems/ui/minimap.md) |
| `game/systems/ui/spec.ts` | UI 描述：一组纯数据，能单测，不碰 DOM。 | [md](game/systems/ui/spec.md) |
| `tools/build-web.mjs` | 把 TS 转成浏览器能跑的 JS（构建产物放 web/）。 | [md](tools/build-web.md) |
| `tools/check-client.mjs` | 页面脚本的「有没有调用不存在的函数」检查。 | [md](tools/check-client.md) |
| `tools/check-data.mjs` | 数据体检：数据化之后，规则要的字段，包里到底有没有。 | [md](tools/check-data.md) |
| `tools/check-locale.mjs` | 语言包体检：包里每个 id 都应该有名字。 | [md](tools/check-locale.md) |
| `tools/client/game.js` |  | [md](tools/client/game.md) |
| `tools/client/hud/aim.js` | 瞄准高亮：记住「鼠标在哪、当前选了什么技能」，随时可以重算。 | [md](tools/client/hud/aim.md) |
| `tools/client/hud/minimap.js` | 右上区域：小地图。 | [md](tools/client/hud/minimap.md) |
| `tools/client/hud/quickbar.js` | 右下角区域：点击策略。 | [md](tools/client/hud/quickbar.md) |
| `tools/client/hud/status.js` | 左下区域：状态（血量条 + 计数 + 可否行动）。 | [md](tools/client/hud/status.md) |
| `tools/client/launcher.js` |  | [md](tools/client/launcher.md) |
| `tools/client/shared.js` | 页面共用：错误提示 + API 调用。 | [md](tools/client/shared.md) |
| `tools/client/windows/inventory.js` | 背包窗口。 | [md](tools/client/windows/inventory.md) |
| `tools/client/windows/settings.js` | 设置窗口（窗口层）。 | [md](tools/client/windows/settings.md) |
| `tools/gen-docs.mjs` | 从代码与语言包生成模块文档（docs/modules/）。 | [md](tools/gen-docs.md) |
| `tools/gen-file-docs.mjs` | 每个源文件生成一篇 md（docs/files/...）。 | [md](tools/gen-file-docs.md) |
| `tools/gen-map.mjs` | 生成「代码地图」：docs/MAP.md。 | [md](tools/gen-map.md) |
| `tools/gen-pack-graph.mjs` | 世界包的引用图（Mermaid）。 | [md](tools/gen-pack-graph.md) |
| `tools/gen-tiles.mjs` | 一次性脚本：生成 7 张 7×7 测试件。 | [md](tools/gen-tiles.md) |
| `tools/gen-tree.mjs` | 扫源码里的 import，画一张引用树。 | [md](tools/gen-tree.md) |
| `tools/gen-world.mjs` | 生成一张地图（MVP：噪声 → 群系 → 地形号）。 | [md](tools/gen-world.md) |
| `tools/import-csv.mjs` | CSV → 模板 JSON（宿主侧工具）。 | [md](tools/import-csv.md) |
| `tools/pack-reader.mjs` | 读包工具（宿主侧）：把文件夹变成 PackContent。 | [md](tools/pack-reader.md) |
| `tools/pages.mjs` | 两个页面：启动器和游戏。 | [md](tools/pages.md) |
| `tools/play.mjs` | 从文件夹加载一个世界并画出来（宿主侧）。 | [md](tools/play.md) |
| `tools/serve.mjs` | 调试台 / 启动器（宿主侧）。 | [md](tools/serve.md) |
| `tools/typecheck.mjs` | 离线类型检查。 | [md](tools/typecheck.md) |
| `tools/worldgen-structures.mjs` | 读一个世界的「结构」定义（生成期数据，不进运行时加载）。 | [md](tools/worldgen-structures.md) |

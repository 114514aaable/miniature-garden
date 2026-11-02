# Kinky Dungeon 5.5 源码调研（答复清单 22 问）

> 对象：`C:\D\chaijie\KinkiestDungeon-5.5`（官方源码仓库快照，`Game/src` 158 个 .ts）
> 对照：`C:\D\chaijie\kinky-dungeon 5.4.74 win64`（发行版，含全量 source map）
> 方法：只读源码。每条结论带 `文件:行号`。**读源码，不读 bundle**——这一条已经满足。
> 附件实体文件在 `work\kd-answers\artifacts\`。

---

## 0. 先回答你们真正关心的两件事

### 0.1 Mod 补丁语义：KD 没有"补丁"，只有"运行时接管"

mod 的 `.js` / `.ks` 被 `eval` 进页面全局作用域，靠**重新赋值全局函数/变量**改游戏（`Scripts/KDMods.ts:483`）。没有 hook 注册、没有 wrap、没有冲突检测、没有依赖图（`dependencies` / `loadbefore` / `loadafter` / `incompatibilities` 四个字段全部标注 **UNIMPLEMENTED**，`KDMods.ts:44-55`）。

**你们的 `merge/patch` 只要做出来就比它强**，不要往回退。值得抄的只有三个小零件：

| 零件 | 作用 | 成本 |
|---|---|---|
| `priority` 单维降序 + 包内 `fileorder` | 加载顺序说清楚 | 10 行 |
| 崩溃哨兵 `KDLastModLoaded` | 坏 mod 自动隔离，下次启动点名 | 20 行 |
| 兼容改名表 `KDModCompat` | API 改名后旧 mod 续命 | 10 行 |

**必须避免**的三个坑（KD 全踩了，见 §1.4）：
1. 在 `FileReader.onload` 的 async 回调里 `eval` 却不 `reject` → 坏 mod 让加载 Promise **永不 settle**，输入全锁死
2. 无 CSP + 对任意下载 zip 直接 eval（mod 与游戏同源，可读写整份存档）
3. 用"源码字符串正则替换"当 API 兼容层（把函数名当 ABI）

### 0.2 动画同步：KD 确实这么做，但它不是"追赶"，是"投影"

关键不在"逻辑先走"，而在**视觉没有任何状态**：

```ts
// Game/src/base/game/KinkyDungeonDraw.ts:3071
function KinkyDungeonUpdateVisualPosition(Entity, amount) {
    if (amount < 0 || Entity.visual_x == undefined) {   // 非法/首次 → 直接对齐
        Entity.visual_x = (Entity.xx != undefined) ? Entity.xx : Entity.x;
        return -1;
    }
    let speed = 50 + KDAnimSpeed * 50;                   // 每格毫秒
    let value = amount / speed;                          // 本帧走多少（按帧时间，不按距离）
    ...
    if (dist > 5) value = 1;                             // 落后超 5 格 → 瞬移
    if (Entity.visual_x > tx) Entity.visual_x = Math.max(Entity.visual_x - value*weightx, tx);
```

**没有动画进度条，没有缓动曲线，没有"播放中"状态。** 每一帧都从逻辑状态重算一遍。所以：丢帧无所谓，下一帧自动补；卡顿无所谓，delta 一大会直接 snap。

而且它是**算过账的**（这点很重要，你们要照抄就得连这个一起抄）：

| 量 | 值 | 出处 |
|---|---|---|
| 视觉速度（默认 `KDAnimSpeed=1`） | 100 ms / 格 | `Draw.ts:3078` |
| 按住键的输入节拍 | 175 ms / 回合 | `KinkyDungeonGame.ts:189` |
| 自动前进的等待下限 | 可低至 `100*(0.25+0.75*AnimSpeed)` ms | `KinkyDungeon.ts:3235` |
| 被束缚时视觉速度 | 最高被顶到 250 ms / 格 | `Draw.ts:3078-3081` |
| 容忍上限 | **5 格，超过即 snap** | `Draw.ts:3100-3102` |

**默认配置下视觉略快于输入（100 < 175），所以追得上；一旦慢速状态把视觉拖到 250ms/格，落后就会净累积，累积到 5 格就被瞬移抹平。** 这个"净累积 + 硬阈值"就是它的全部鲁棒性来源。

**结论**：这套模式可以照抄，但必须同时接受三个前提，缺一个就变成"逻辑抢跑 + 动画债"：

1. **视觉必须是逻辑状态的纯函数**——不能有"必须播完"的动画对象，不能依赖起止事件，不能依赖队列顺序
2. **必须有一个显式的落后预算**——KD 选了"5 格"，触发即瞬移（玩家会看到跳变，这是设计内行为）
3. **输入节拍与视觉速度要一起调**——只调一个，就会长期处于 snap 边缘

如果你们的动画是"有状态、必须播完"的（比如带受击判定帧、带特效挂点），那**不是 KD 模式**，就得自己定义"逻辑在动画未完成时再次结算"的策略（排队 / 叠加 / 丢弃），KD 里没有答案。

---

## 1. 启动器与 Mod 加载（Q1–6、Q22）

### Q1 Mod 怎么被发现
**不扫文件夹、没有索引文件。** Mod = 用户投喂的 zip。

- 桌面版：主进程 IPC 把 `Mods/*.zip` 读成 buffer，preload 暴露 `window.kdAPI.getMods()`，渲染侧转成 `File` 存进 `KDMods` 字典，**key = zip 文件名**（`Scripts/KDMods.ts:104-117`）。注意：这段主进程代码**不在 5.5 源码仓库里**，只在 5.4.74 发行包的 `resources/app/electron.js` 中：

```js
ipcMain.handle('getMods', async (event) => {
    let ppath = path.join(app.getAppPath(), '../../Mods/');
    fs.readdirSync(ppath).forEach(file => {
        if (filePath.includes('.zip')) fileList.push({base: file, file: fs.readFileSync(filePath)});
    });
```

- Web 版：IndexedDB（`KDModsUtils.ts:44-53`）+ 手动 `<input type=file multiple>`（`KDMods.ts:216-235`）
- **没有逐个启用/禁用**。只有一个全局开关 `KDToggles.AutoLoadMods`（默认 **false**）+ 删除按钮（`KDMods.ts:195-207`）
- **加载时机是点「继续游戏」**，不是页面启动（`KinkyDungeon.ts:1965-1973` → `KDExecuteModsAndStart`）

### Q2 加载顺序
唯一排序键 `priority`（注释 `Higher = earlier`），降序；同值靠 sort 稳定性 = 插入顺序：

```ts
// KDMods.ts:341-343
KDModLoadOrder = modFiles.sort((a, b) => (b.priority || 0) - (a.priority || 0))
```

包内文件顺序 = `mod.json.fileorder`，未列出的按 zip 条目顺序兜底，`.csv` 强制排尾（先 `*EN.csv` 再当前语言，`KDMods.ts:397-406`）。

**冲突处理：没有。** 同名 zip 静默覆盖（`KDMods[name] = file`）；内容冲突后跑者赢；版本不匹配**只改文字颜色、不阻止执行**（`KDMods.ts:159-178`，`info = "KDModOutdated2"`）。

### Q3 ★ 能不能改已有内容
**能，方式是运行时全量接管。** `.js` / `.ks` 走同一个分支：

```ts
// KDMods.ts:465-483
} else if (file.endsWith('.js') || file.endsWith('.ks')) {
    // Eval js files. eval() is dangerous. Don't load untrusted mods.
    ...
    let evaluated = await eval(res);
```

官方示例就是纯改写（`Mods/example_unlimitedbed/UnlimitedBed.js`）：

```js
KDSleepWillFraction = 1.0;
if (typeof KDCanSleep === "function") {   // 用 typeof 兜底
    KDCanSleep = function() { ... };      // 直接替换整个函数
} else {
    log.error("Cannot find KDCanSleep function!");   // 顺带一提：log 在本仓库未定义
}
```

**没有 wrap 机制**——想 wrap 得自己在覆盖前存旧引用。`Scripts/Patch.ts` **不是**补丁系统，它是单机版对 Bondage Club API 的打桩层（`const StandalonePatched = true`），把 `InventoryWear` / `ReputationGet` / `ChatRoom*` 换成空实现，靠 `tsconfig` 排序 + 单文件 `outFile` 拼接生效。

升级会断，所以有兼容表（`KDMods.ts:12-23`，默认关闭）：

```ts
let KDModCompat = {
    "KinkyDungeonChangeWill(": "KDChangeWill('','','',",
    "KinkyDungeonCanPickStat(": "KDCanPickPerk(",
};
```

### Q4 ★★ 坏的 Mod 怎么表现（这里 KD 有一个真 bug + 一个真聪明）
**不是启动期校验，是"加载期静默卡死 + 下次启动点名"。**

bug 在这里——`eval` 在 `FileReader.onload` 的 async 回调里，抛错变成未处理 rejection，外层 `new Promise` 永不 settle：

```ts
// KDMods.ts:470-488
await new Promise((resolve, reject) => {
    reader.onload = async function(event) {
        let evaluated = await eval(res);   // 抛错 → 只 reject 了这个 async 回调
        resolve(evaluated);                // 永远到不了
    };
    reader.readAsText(readfile);
})
```

后果：串行链挂死 → `KDAwaitingModLoad` 常驻 `true` → 输入入口直接 return，**整个 UI 冻死**（`KinkyDungeon.ts:6495, 6524`）。

真正聪明的是恢复机制（哨兵）：

```ts
// KDMods.ts:391  每个 mod 执行前先落盘
localStorage.setItem(`KDLastModLoaded`, mod.name)
// KDMods.ts:555  全部成功后才清
localStorage.removeItem(`KDLastModLoaded`)
```

下次启动若发现残留，就弹窗点名 + 跳过自动加载 + 从在线列表移除（`KDMods.ts:563-567`、`KinkyDungeon.ts:1623-1627`）。**这就是它的"坏 mod 隔离"——不是预防，是自愈。**

另有 `KDLoadModJSON` 的 `json.length < 100000` 防炸弹（`KDMods.ts:77`），以及 `KinkyDungeonErrors.ts` 的 `window.onerror` 崩溃报告（记栈 + 版本 + mod 列表 + 整份存档，可复制，**不上报、不阻止开局**）。

### Q5 资源路径
**约定式镜像 `Game/`，没有清单、没有注册 API。**

```ts
// KDMods.ts:495
KDModFiles[(KinkyDungeonRootDirectory + file).replace("\\", "/")] = URL.createObjectURL(blob);
```

`KinkyDungeonRootDirectory = "Game/"`（`Scripts/Main.ts:53`）。读取侧先查表：`KDModFiles[Image] || Image`（`KinkyDungeonDraw.ts:5199-5202`）。所以 zip 内部路径必须镜像游戏目录 —— 这是真实 `example_enemy.zip` 的条目：

```
Audio/AngryHit.ogg          → Game/Audio/AngryHit.ogg
Enemies/AngrySkeleton.png   → Game/Enemies/AngrySkeleton.png
init.ks
mod.json
```

**mod 的图不需要进图集**（图集是构建产物，见 §2.2）。拼错路径的代价是静默失败（只 `console.log` + 记 `errorImg`）。

### Q6 它跑在什么壳里
**纯 Web 页面。** `index.html` 12 个普通 `<script>` 顺序加载，最后 `./out/main.js`（`tsc` 的 `outFile` 把全部 TS 拼成一个文件，**无模块系统、无 bundler**）。

- `npm run build` = `tsc && python tools/pack.py`
- 开发：`npm run serve`（http-server）；发行：把 `out/` 拷进 `<游戏目录>/resources/app/out`（`README.md:67`）
- 桌面版是**外部 Electron 壳**：`nodeIntegration: false`、`contextIsolation: true`、`app.enableSandbox()`，只暴露 4 个方法
- `package.json` 的 `"main": "index.html"` **没有任何代码读取**，推断是发布链路标记
- **无 CSP meta**（这也是 §0.1 里那个安全坑的来源）

### Q22 Mod 能不能写脚本、怎么隔离
**能写任意 JS，完全不隔离**：无 iframe、无 Worker、无 `new Function` 包装、主线程同作用域，可读写 `localStorage`（含整份存档）。

- `.ks` 不是新语言、也不是数据文件，就是 `.js` 改扩展名（同一个 if 分支）
- 示例首行 `'use strict'` ⇒ 按 ES 语义，mod 里的 `function` / `var` 声明**不会**漏进全局，只能改已存在的全局（此条为语义推断，未运行验证）
- 执行时机：点「继续游戏」→ `KDExecuteMods`（`KDExecuted` 保证只跑一次），mod 间按 priority 串行、包内按 fileorder 串行，收尾发 `afterLoadMods` 事件

### 数据从哪来（Q8 的补充）
**全部硬编码 TS 对象字面量**，没有外部 JSON/YAML（`Data/` 里全是 `.ts`；唯一外部数据是 CSV 翻译）。加敌人 = 直接 push 字面量 + `addTextKey`：

```js
// Mods/example_enemy/init.ks
KinkyDungeonEnemies.push({name: "AngrySkeleton", bound: "Skeleton", ..., AI: "hunt", maxhp: 5, movePoints: 2, attackPoints: 3, ...});
addTextKey("NameAngrySkeleton", "Angry Skeleton");
```

唯一身份是 `name`，`KinkyDungeonRefreshEnemiesCache()` 建 `Map<name, enemy>`，**重复 name 后者覆盖**（`KinkyDungeonEnemies.ts:114-119`）。

---

## 2. 渲染（Q7–12）

### Q7 2D Canvas 还是 WebGL
**WebGL（PixiJS 7.2.1，本地文件非 CDN）+ WebGL 后处理。** 旧 2D canvas 只剩清屏调用，是死路径。

```ts
// Scripts/Main.ts:5-26
const PIXIWidth = 2000; const PIXIHeight = 1000;
var PIXIapp = new PIXI.Application({ antialias: true, powerPreference: 'high-performance',
                                     resolution: resolution, width: PIXIWidth, height: PIXIHeight });
document.body.appendChild(PIXIapp.view);
PIXIapp.stage.addChild(kdcanvas); PIXIapp.stage.addChild(kdui);
```

规模参考：逻辑分辨率 2000×1000，`resolution` 默认 **2.0**（后备缓冲 4000×2000）；格子默认 **60px**（`72 + KDZoomLevels[4]*12`）→ 可视约 33×17 格，含 1 格 margin 后**约 750 格/帧、每格最多 3 层**；粒子硬上限 **1000 粒子 + 1000 emitter**（`KDParticles.ts:17,88`）。

分层是 12 个 zIndex 常量容器（见 Q10），大量滤镜：雾、光照贴图、gamma、乘算、描边、自定义 shader（`KinkyDungeonDraw.ts:119-194`）。

### Q8 图集怎么定义
**图集不在仓库里**——`TextureAtlas/` 被 `.gitignore` 整目录忽略，是 `tools/wtxpck.exe` 的构建产物：

```ini
# tools/wtxpck.game.conf
input=../Game/;   prefix=Game;
output=../TextureAtlas/;
atlas_size=2048;  atlas_prefix=game_;
padding=0;
```

发行包里能看到成品格式（`atlasA0.json`，**已复制到 `artifacts\atlas_sample\`**）：

```json
{"frames": {
"Models/Armbinder/BinderRightBoxtie.png": {
    "frame": {"x":2011,"y":3,"w":24,"h":166},
    "rotated": false, "trimmed": true,
    "spriteSourceSize": {"x":463,"y":518,"w":24,"h":166},
    "sourceSize": {"w":1240,"h":1754}
}},
"animations": { "Models/Belts/Arms": ["Models/Belts/Arms1.png","Models/Belts/Arms2.png"] },
"meta": { "image": "atlasA0.webp", "size": {"w":2048,"h":2048}, "scale": "0.5",
          "related_multi_packs": ["atlasA1.json", ...] }
```

要点：
- **帧名 = 源文件路径**，不是自造 id
- 动帧 = **文件命名约定**（`Arms1`/`Arms2` 聚成数组），**没有行列切帧**
- `trimmed` + `spriteSourceSize` + `sourceSize` 是**必需的**：裁掉透明边后记录原始画布，用来做部件对位（角色是纸娃娃多图层叠加，各部件相对 1240×1754 原画布定位）
- 多页 2048²、`scale 0.5`

### Q9 实体怎么映射到贴图
**"名字即资源 id"，没有大 switch、没有映射表。**

- 地图格：ASCII 字符查 `KDSprites` 函数表（每字符一个函数，内部做邻接自适配）→ `Game/Floors/Floor_<主题>/<sprite>.png`
- 敌人：`Enemy.name` → `Game/Enemies/<name>.png`（`KinkyDungeonEnemies.ts:1098`）
- 物品：`item.name` → `Game/Items/<name>.png`（`KinkyDungeonItem.ts:343`）
- 角色：`DrawCharacter(player, x, y, size, ...)` + `Data/Models*.ts` 的部件定义逐层叠加
- 唯一的查表是宝箱 `KDSpecialChests`

### Q10 ★ 绘制顺序
**没有 y-sort。** 只有容器级 zIndex 常量 + 少数 sprite 级 zIndex：

```ts
// KinkyDungeonDraw.ts:197-253
kdmapboard        -2      // 地面
kditemsboard      -2      // 掉落物
kdwarningboard    -0.3
kdeffecttileboard -0.1
kdenemyboard       0
kdwarningboardOver 2.22
kdbulletboard      2.3
kdstatusboard      5
kdparticles       10
kdUItext          60
kdminimap         80
npcTooltipContainer 120
kdgameboard       -50     // 世界层总容器
```

玩家 sprite 固定 `KDGamePlayerZIndex = 4.5`（`KinkyDungeonDraw.ts:7`），容器是 `kdstatusboard`(5)。所以：

- **掉落物永远在角色下面**（-2 < 0），与 y 无关
- **敌人彼此不排序**：`KDDrawEnemySprite` 的 zIndex 形参默认 0 且主调用点不传，同格按创建顺序覆盖
- **玩家恒压所有敌人**

这是"能跑但语义不对"的遮挡（人在物品上、两个人重合时谁在上取决于创建时机）。**你们要做 z-sort 就现在做，不要学它。**

### Q11 缩放与相机
- 固定逻辑分辨率 2000×1000 × `resolution`，CSS 拉伸铺满（`style.css:1-16`，宽高比 > 2:1 时改按高）
- 相机跟随玩家但**不做边界夹取**（clamp 代码被注释掉了，`KinkyDungeonDraw.ts:1163-1164`）
- 相机用整数格，绘制再叠加 `CamX_offsetVis` 做亚像素插值（`:1167`）
- **放弃像素完美**：`roundPixels` 被注释掉（`:4894, :5116`）、`antialias: true`、同格三层只有地板 `Math.round`（`:4778` vs `:4785`）
- 像素感靠 **NEAREST 采样**（`KDToggles.NearestNeighbor` 默认 true，`KinkyDungeonVibe.ts:139`）
- 鼠标：`MouseX = offsetX * 2000 / clientWidth`（`Main.ts:225`）

### Q12 视锥/剔除
三级：视锥双层循环只跑视口 + 1 格（`:4693-4699`）→ 每格再 `VisionGet>0 || fog>0` → sprite 池当帧没被 touch 就 `removeChild + destroy`（`:1820-1828`）。

**没有 dirty rect，每帧全量重绘**（`PIXI.Ticker.shared`）。唯一的增量是迷雾 `KDRedrawFog` 计数器和小地图 `KDRedrawMM`。

---

## 3. ★ 动画与逻辑同步（Q13–19）

### Q13 动画跟逻辑走还是真实时间走
**三套时钟并存**：
- 渲染：`PIXI.Ticker.shared` 每帧 → `DrawProcess` → `KinkyDungeonRun()`（`Main.ts:47,79-92`；`Drawing.ts:197`）
- 逻辑：**回合制、由输入触发**（`KinkyDungeonAdvanceTime`，`KinkyDungeonGame.ts:3531`）
- 节拍闸门：真实毫秒 `CommonTime() = Date.now()`（`Common.ts:355`）

移动是**逻辑瞬移 + 视觉补间**，不是逻辑分帧。见 §0.2。

补充：`Main.ts:139-153` 还留着一个 `requestAnimationFrame(MainRun)` 的旧主循环，但 `:125` 已注释 → **实际未使用**。

### Q14 ★ 动画中途再操作
**不排队、不打断、不拦输入。** 全仓 grep `animat*` 只命中 `KDLocks.ts` 的 lockout，与动画无关。真正的闸门是状态位：

```ts
// KinkyDungeonGame.ts:2057-2064
function KinkyDungeonControlsEnabled() {
    return (!KinkyDungeonInspect || KinkyDungeonDrawState != "Game")
        && KDGameData.SlowMoveTurns < 1
        && KinkyDungeonStatFreeze < 1
        && KDGameData.SleepTurns < 1
        && !KDGameData.CurrentDialog
        && !KinkyDungeonMessageToggle;
}
```

按住键的速率闸门是真实时间：`KinkyDungeonLastMoveTimer` + `Cooldown = 175ms`（`KinkyDungeonGame.ts:189-190, 2220, 2268`）。轮询在 draw 内（`KinkyDungeonDraw.ts:2583-2585`）。

**所以"动画中途再操作"= 逻辑立刻再走一回合，视觉继续追。**

### Q15 有没有"动作播放队列"
**没有动画队列。** 但有两个别的队列：

1. **输入队列**：`KinkyDungeonInputQueue`，每帧最多消费 3 条（`KinkyDungeonInput.ts:3, 1705-1716`）
2. **延时动作队列**：`KDGameData.DelayedActions`，`action.time -= delta` 按**回合数**倒计时，到点 `commit`（`KinkyDungeonGame.ts:3697-3713`、`KDDelayedActions.ts:21-24`）

兜底机制：
- **取消式**：`KDDelayedActionPrune(tags)` 按 tag 整批删（攻击前删 `["Action","Attack"]`，`KinkyDungeonGame.ts:3030`）
- **重排+时间补偿**：`KDPruneSameStruggleActions` 删同组后 `action.time -= timeAdv`（`KinkyDungeonRestraints.ts:6542-6563`）
- **没有超时/强制清空**（未找到）。卡住的是"自动等待"：`KDAutoWaitDelayed && DelayedActions.length > 0`（`KinkyDungeon.ts:3246`）
- 另一个队列的写法值得参考：存档队列超 8 条直接丢弃只留最新（`KinkyDungeon.ts:1563-1566`）

### Q16 动画时长由什么决定
- 主：**每格固定毫秒**（`speed = 50 + KDAnimSpeed*50` → 默认 100ms/格）
- 受 `KDAnimSpeed` 用户设置影响（默认 1，`KinkyDungeonVibe.ts:64`）
- 被束缚时 `speed += KDAnimSpeed*50*SlowLevel`，上限 250（`3078-3081`）
- 睡眠 `speed = 100`；子弹 `speed = KDBulletSpeed = 40`
- 另有真·定时动画常量：`KDAnimTime=1600`、`KDFloatAnimTime=4000`、`KDSquishyAnimTime=2000`、`KDBreathAnimTime=1400`（`KinkyDungeonDraw.ts:85-89`），用于呼吸/浮动这类**纯装饰**
- 敌人攻击"前冲"是**加性视觉偏移**（`KDAnimEnemy` 返回 `offX/offY` 加到目标点），逻辑坐标不变

snap 三处：`amount<0 || visual_x==undefined` 直接对齐（`:3073-3076`）、`dist>5 → value=1`（`:3100-3102`）、`dist==0 直接返回`（`:3133`）。

### Q17 逻辑时间与渲染时间分离
分离，但**没有任何漂移校正**。补偿是三件套：

```ts
// KinkyDungeonDraw.ts:1139-1141   渲染 delta 被上一帧耗时钳住，防长卡顿后瞬移
KinkyDungeonDrawDelta = Math.min(CommonTime() - KinkyDungeonLastDraw,
                                 KinkyDungeonLastDraw - KinkyDungeonLastDraw2);
```

- 未钳住的 delta 只喂特效（粒子，纯毫秒）
- 逻辑回合计数 `KinkyDungeonCurrentTick += delta`（`KinkyDungeonGame.ts:3764`）
- 装饰事件（伤害数字/音效）按**逻辑 tick 之后的真实毫秒**延迟播放：`KDTimescale * (performance.now() - KDLastTick) > damage.Delay`（`KinkyDungeonFight.ts:3449-3458`）

### Q18 输入缓冲 / 键位重复
- `if (event.repeat) return;`（`Main.ts:160`）→ 不靠 OS 自动重复
- 靠"按下集合 + 真实时间冷却"轮询：8 向 + 原地等待，`Cooldown=175ms`、首延迟 `50ms`
- 按住方向键 = 连续移动，**但每一回合都是新的一次逻辑推进**（视觉可能还在追）
- 输入队列非空时不跑自动行为（`KinkyDungeon.ts:3161`）——玩家输入优先于自动等待/自动挣扎

### Q19 中断与优先级
**没有动画级 interrupt/cancel 体系。** 优先级只体现在三处：

1. 闸门判定顺序（`ControlsEnabled` 在攻击判定之前就把输入挡掉）
2. 延时动作的 tag 剪枝（挣扎/施法/换武器互斥，`KinkyDungeonInput.ts:128/140/144/156/192/232`）
3. `KinkyDungeonInterruptSleep()`（`KinkyDungeonStats.ts:496-510`，最接近 interrupt 的东西）

高优先级（冻结/眩晕）通过**改逻辑状态**压过一切，而不是打断动画。捕获立即生效（`Enemy.hp = 0`）。

**safeword 是显式 snap**：`KDMovePlayer(); visual_x = x; visual_y = y;`（`KinkyDungeonInput.ts:844-846`）——官方对"视觉追不上"的兜底就是手动对齐。

### Q19b ★ 这套模式的六个破绽（都有代码位置，你们要照抄就先堵这几个）

1. **视觉跳变是设计内行为**：`dist>5` snap、safeword 手动对齐。玩家会看到 6 格瞬移。
2. **逻辑锚点与视觉锚点混用**：相机基准用逻辑坐标 `CamX = PlayerEntity.x`（`Draw.ts:1163`），绘制偏移用 `visual_x`（`:1167`），特效层又混合 `CamX+CamX_offset`（`:1253`）。**同一帧两个坐标系，落后越大错位越大。**
3. **视觉状态反向污染逻辑**：`KDTethers.ts:269-272` 用 `KDistChebyshev(visual_x - x, ...) > 2` 做玩法判定并把视觉强行拉回——渲染量参与了判定，这是"视觉只是投影"原则的破例，也是最容易被后人踩的坑。
4. **卡顿后视觉要追多帧，输入不用**：`Draw.ts:1139` 的 clamp 让 delta 不超过上一帧；输入冷却用 `performance.now()` 不受 clamp 影响 → 期间逻辑继续推进，落后加剧。
5. **可操作状态先于视觉就位**：`ControlsEnabled` 一读 `SlowMoveTurns/Freeze` 立刻封输入，但精灵还在按 `visual_x` 滑行 → "看起来还在走，实际已眩晕"。
6. **结算顺序需要额外逻辑补丁**：子弹更新/碰撞跑了两遍，注释写明第二遍是 `"catchup" phase for explosions!`（`KinkyDungeonGame.ts:3648-3655`）——「逻辑超前」的代价，官方选择再跑一遍逻辑而不是等动画。

**一句话判据**：这套模式成立的关键不是"逻辑先走"，而是**视觉可以随时被丢弃并从状态重算**，外加一个显式落后预算。**如果你们的动画是有状态的（必须播完、依赖起止事件、依赖队列顺序），那就不是 KD 模式，上面 6 条会全部现形。**

---

## 4. UI 与交互（Q15–19 的界面版；Q20–22 见 §5）

> 你们的编号在第 3、4 节有重叠（12–14 归动画，15–19 归 UI），这里按"界面"主题再答一遍。

### Q15 屏幕结构
**单一 2000×1000 虚拟画布 + 字符串状态机**，不是路由表：

```ts
// KinkyDungeon.ts:137
let KinkyDungeonState = "Logo";
```

状态链：`Logo → Consent → Intro → Menu →(Name→Challenge→Diff→CConsent→Stats)→ LoadSlots / LoadOutfit → Wardrobe → GenMap → Game`。每个状态自己在 `KinkyDungeonRun()`（`KinkyDungeon.ts:1549+`）的 if/else 长链里画自己。

**有「继续上次」，但只有点击才读档**（`KinkyDungeon.ts:1965-1982`），开机不自动读 → 天然没有"自动续档覆盖存档"的问题。选档页 `LoadSlots`（`:5117`），读档在点「Play」时才发生（`:5803-5837`），读档后先进 `GenMap` 生成地图再进 `Game`。

### Q16 HUD 布局（坐标全是 2000×1000 里的字面量，没有布局引擎）

| 区域 | 位置 | 内容 | 出处 |
|---|---|---|---|
| 左侧竖栏 | `Left:0, Width:500, Height:1006` | 角色立绘 + 束缚/挣扎组 | `HUD.ts:345-357` |
| 右上 | `(1870, 15)` | 楼层 / 地牢名 | `HUD.ts:324` |
| 右侧状态条 | `(1790, 340, w=200)` | 体力/意志/魔力… | `HUD.ts:374` |
| 右侧行动栏 | `(1780, 166)` | 技能/物品按钮 | `HUD.ts:375` |
| 右侧导航 | `y=432`，项高 55 | 背包/魔法/收藏… | `HUD.ts:2148-2159` |
| 右下热键条 | `y=995-70`，间距 72 | 法术/道具/武器/护甲 | `HUD.ts:446-449` |
| 底部动作条 | `y=925`，5 个 64×60 | 交互/攻击/等待… | `HUD.ts:1311-1318` |
| 右上小地图 | `(1990-w, 25)` | 小地图 | `Draw.ts:1098` |
| 中上消息日志 | `x=640, w=840, 行高 22` | 日志 6 行浮层 / 31 行展开 | `Draw.ts:2819-2833` |
| 模态区 | `(600,700) 800×100` | 弹窗 | `HUD.ts:255-258` |

常驻：左侧栏、状态条、行动栏、导航、热键、小地图。弹窗：右键菜单、`KinkyDungeonDrawState` 全屏页（Inventory/Magic/Collection/Container/JourneyMap）、mod 配置。

**注意**：点左侧 500px 空白区 = 切换快捷背包（`KDCustomCancel.ts:8-12`）——这类"隐藏热点"是坐标硬编码的直接后果。

### Q17 选目标
**鼠标悬停即目标，点格子走自动寻路。没有目标循环、没有自动选最近。**

```ts
// KinkyDungeonDraw.ts:3158-3159
KinkyDungeonTargetX = Math.round((mx - GridSize/2 - canvasOffsetX)/GridSize) + CamX;
```

- 带 **0.2 格离墙吸附**（`:3161-3181`）
- 点击远格 → `KDFastMoveTo` → `KDGetFastMovePath` → A* 寻路（`KinkyDungeonGame.ts:2186-2197, 4731-4750`）
- "目标必须在视野/已探索内"的判定**被注释掉了** → 点未知区域也会尝试寻路
- 可点区域是硬编码挖洞：避开左 500、右 60、底 100、右下 255×150、模态区（`Draw.ts:6196-6207`）
- 键盘：8 向 + 空格等待；`ShiftRight` 进 `Inspect` 模式，此时 WASD 平移镜头（`KinkyDungeon.ts:2624`）

### Q18 检查/详情面板
**右键上下文菜单，菜单项按"目标格上有什么"动态生成。**

```ts
// KinkyDungeon.ts:1289-1333  右键被整个接管
document.addEventListener('contextmenu', event => {
    event.preventDefault();
    ... KDDrawGameContextMenu[KinkyDungeonDrawState](false, MouseX, MouseY).length > 0) KDContextMenu = !KDContextMenu;
```

- 敌人 → Talk / Attack / Capture / Truss / Pass
- 地面物 → Pickup；可交互地形 → Interact；楼梯 → Stairs；空地 → MoveTo / Sprint；自己 → Inventory / Wait
- 渲染 250×40（移动端 400×64）、图标 `Game/UI/ContextMenu/*.png`、自动翻转防出屏（`Draw.ts:6529-6588`）
- **危险操作二次确认**：第一次点击只把按钮变成 Confirm（`KDContextMenu.ts:207-236`）
- 物品详情是**悬停 tooltip**（不点击），tooltip 按内容测宽 + 出屏翻转（`KinkyDungeon.ts:1500-1543`）
- 右键有"取消链"：快捷背包/回收/容器/施法瞄准按顺序判断谁能吃掉这次右键（`KDCustomCancel.ts:17-82`）

### Q19 UI 是 DOM 还是 Canvas
**几乎全是 canvas。** DOM 只用于文本输入框、textarea、range、自定义下拉，且**每帧清掉没被重新绘制的元素**（`Draw.ts:6030-6087`）。

- 文本：`PIXI.Text`，按字符串 id 缓存复用
- **中文换行**：只有 `wordWrap` 时才对含 CJK 的文本开 `breakWords`（`Draw.ts:3801`），否则整段不折行
- **超宽不截断，而是整体横向缩小字体**（`scale.x = min(1, Width/sprite.width)`，`Draw.ts:3809-3812`）
- 字体：`Fonts/*.ttf` 经 PIXI Assets 载入，默认 `Inconsolata Medium`，可选 3270/Iosevka/Lekton/Nanum(韩文等宽)/Roboto（`Data/Preload.ts:20-129`）
- 滚动：不是原生滚动条，是"按钮 + 滚轮电容累积到阈值再翻页"（`KinkyDungeon.ts:7069-7088`）

### Q20 消息日志
- 单页 31 行（`700/22`），展开可滚（每次 3 行）
- **合并不是 "×3"，而是"同文本只刷新最后一条的 time"**：

```ts
// KinkyDungeonGame.ts:2647-2652
} else if (text == KinkyDungeonMessageLog[KinkyDungeonMessageLog.length-1].text) {
    KinkyDungeonMessageLog[KinkyDungeonMessageLog.length-1].time = KinkyDungeonCurrentTick;
}
```
  `(xN)` 只在**浮层渲染时**统计连续相同项（`Draw.ts:2938-2949`）
- 10 类过滤器：Action/Combat/TotalDamage/Critical/Self/Struggle/Ambient/Dialogue/Items/Kills，默认只关 TotalDamage（`Draw.ts:2819-2830`）
- **有一个 bug**：上限写成 `splice(0, KDMaxLog*100 - length)`，超限时长度为负 → **实际从不裁剪**（`Draw.ts:3043-3045`）
- 绘制按索引递减 alpha 做渐隐 + 时间衰减（`Draw.ts:2956-2968`）

### Q21 键位与手柄
- 默认键位是扁平表 `KDDefaultKB`（约 40 个动作，`KinkyDungeon.ts:219-297`），存 `localStorage["KinkyDungeonKeybindings"]`，UI 里可逐项重映射
- **触屏可用**（`KinkyDungeon.ts:6935-6985`，把触点当鼠标 + 750ms 长按手势）；`Main.ts` 里的 `TouchStart/TouchEnd` 是空壳，真正实现在别处
- **无手柄支持**（全仓 `gamepad` 命中 0）
- 坑：键位存的是**字符**（'W','X','1'）而不是 `event.code` → 非 QWERTY 布局会错位

### Q22 无障碍
**字号不可调、无色盲/对比度模式**（均未找到）。可调的只有：字体族、分辨率/缩放（`KDZoomLevels`，格子 33–144px）、一批开关（`TransparentUI` / `FlipStatusBars` / `CenteredLog` / `GreyscaleBlindness` / `ExtraTooltipHeight` …，`KinkyDungeonVibe.ts:84-216`）。移动端靠 `CommonIsMobile` 整体放大。

---

## 5. 回合模型与存档（Q20–21 的原义）

### Q20 ★ 行动点模型 —— 不是 AP，是"时间货币 + 速度门槛"

**(a) `MovePoints`：蓄积型速度门槛**

```ts
// KinkyDungeonGame.ts:3093-3094
KDGameData.MovePoints = Math.min(Math.ceil(SlowLevel + 1), KDGameData.MovePoints + delta);
// :3130  必须攒够 1 点才能走
if (KDGameData.MovePoints >= 1 || (willSprint && KDCanSprint(sprintcost))) { ... }
// :3125  被"绑"住时钳死
if (KinkyDungeonStatBind) KDGameData.MovePoints = Math.min(0, KDGameData.MovePoints);
```

`SlowLevel` 来自高跟鞋/塞具/束缚（0–10+）。**速度不是一个乘数，而是"每次移动要攒多久"。**

**(b) `delta`：所有动作的价格**

- 普通动作 = `AdvanceTime(1)`
- **零成本动作 = `AdvanceTime(0)`**：`delta=0` 时所有 `if (delta > 0)` 包住的副作用全跳过，只结算 UI 交互（`KinkyDungeonInput.ts:431`、`KinkyDungeon.ts:7769`）
- **Quickness（加速）也是 0**：`KinkyDungeonAdvanceTime(quick ? 0 : 1)`（`KinkyDungeonGame.ts:3256`）→ 加速 = 不消耗时间
- 敌人有自己的预算字段：`movePoints: 2, attackPoints: 3`（示例 mod）→ 每回合不是固定一动

**(c) 一回合的粒度**：一次输入一次 `AdvanceTime(1)`，**同步**把整个世界推进一格时间（`KDTickMaps(delta)`），玩家 → 敌人 → 环境都在同一个调用栈里，**阶段间不可插入**。多回合动作靠"拆成 N 条延时动作"实现（`KinkyDungeonRestraints.ts:6565-6589`）。

### Q21 存档格式 —— 整份快照 + 种子

```ts
// KinkyDungeon.ts:7370-7378
function KinkyDungeonSaveGame(ToString = false): KinkyDungeonSave {
    let save = JSON.parse(JSON.stringify(KinkyDungeonGenerateSaveData()));  // 深拷贝整份状态
    if (!ToString) KDSaveQueue.push(save);
    return save;
}
```

存的东西（`KDTypeDefs.ts:2971-3029`）：地图网格、实体、子弹、雾、记忆格、背包、束缚变体、buff、声望、商店价格、**随机种子**……全量 JSON。

- 压缩：Web Worker 里 LZString → Base64，10 分钟超时兜底回主线程（`out/saveworker.js`、`KinkyDungeon.ts:7383-7408`）
- 存储：`localStorage["KinkyDungeonSave"]` + IndexedDB 多槽位（`:4981 / :5019`）
- **加载逐字段校验**，缺一个就拒绝而不是崩半路（`:7419-7426`）
- 有 `errorloading` / `modsmissing` 两个状态位处理"存档用了已卸载的 mod"（`KDTypeDefs.ts:3011-3012`）
- 种子存了但**只用于重放地图生成**，不是操作回放

**结论：快照式，不是种子+操作回放。**

---

## 6. 要附的五样东西（实体文件已备好）

目录：`C:\D\chaijie\work\kd-answers\artifacts\`

### A. 安装目录树（两层）→ `artifacts\tree.txt`

```
KinkiestDungeon-5.5/
  index.html  package.json  tsconfig.json  style.css  README.md  jsconfig.json
  .github/            scripts/ workflows/
  Backgrounds/        4 文件
  Data/               89 个 .ts —— 外观模型定义（部件与原始画布偏移）
  DisplacementMaps/   314 文件
  Fonts/              9 套 TTF + webfont.js
  Game/               Audio/ Aura/ Buffs/ Bullets/ Class/ Conditions/ EffectTiles/
                      Enemies/ Floors/ GFX/ Items/ Locks/ Outfits/ Particles/
                      Poses/ Spells/ UI/ src/(158 .ts)
  Models/             5824 个 PNG（486MB，纸娃娃部件）
  Mods/               2 个官方示例（另有同名 .zip）
  Music/              31
  Screens/            MiniGame/
  Scripts/            15 个 .ts + lib/（LZString / zip.js / pixi-filters / ogvjs）
  out/                只有 saveworker.js —— 没有 main.js，必须 build
  tools/              pack.py + wtxpck.exe + 4 个 .conf + static-analysis.ts
```

### B. `artifacts\package.json`

```json
"scripts": {
  "build": "tsc && npm run pack",  "buildCont": "tsc -b --watch",
  "buildTypes": "tsc --declaration --emitDeclarationOnly --removeComments false",
  "serve": "http-server",  "pack": "python tools/pack.py",  "forcepack": "python tools/pack.py rc"
}
```
devDeps：`typescript ^5.6` / `pixi.js ^7.2.1` / `esbuild` / `pixi-filters`；deps：`@zendrex/buttplug.js`。

### C. 最小 Mod 包 → `artifacts\mod_minimal\`

就是 `example_enemy.zip` 的真实布局（**zip 内路径镜像 `Game/`**）：

```
mod.json
init.ks                     # = JS，'use strict'，往全局数组 push
Audio/AngryHit.ogg          # → Game/Audio/AngryHit.ogg
Enemies/AngrySkeleton.png   # → Game/Enemies/AngrySkeleton.png
```

`mod.json` 全文：

```json
{
    "modname": "Example Enemy",
    "moddesc": "An example mod to add a new enemy to the game",
    "author": "Your name here",
    "modbuild": 1,
    "gamemajor": 5, "gameminor": 4,
    "gamepatch_min": 43, "gamepatch_max": -1,
    "priority": 0
}
```

另外附 `mod_override_example.json` + `UnlimitedBed.js`：**"改写已有内容"的最小样本**（重写 `KDCanSleep`）。

### D. 一张图集 + 定义文件 → `artifacts\atlas_sample\atlasA0.json` + `atlasA0.webp`

2048²，TexturePacker JSON hash（格式见 §2.2）。可以直接拿去验证你们的图集加载器。**注意：源码仓库里没有图集，这是从 5.4.74 发行包里取的。**

### E. 入口三函数

| 角色 | 位置 |
|---|---|
| **入口** | `Scripts/Main.ts:52` `window.onload` → `CommonSetScreen("MiniGame","KinkyDungeon")`（`:61`） |
| **帧循环 (update)** | `Scripts/Main.ts:79` `ticker.add(...)` → `Scripts/Drawing.ts:197 DrawProcess()` → `Game/src/base/KinkyDungeon.ts:1549 KinkyDungeonRun()` |
| **渲染 (render)** | `Game/src/base/game/KinkyDungeonDraw.ts:1070 KinkyDungeonDrawGame()`（一个 1529 行的函数，从 1070 到 2599） |
| **逻辑推进** | `Game/src/base/game/KinkyDungeonGame.ts:3531 KinkyDungeonAdvanceTime(delta)`（输入驱动，非时钟驱动） |
| **视觉投影** | `Game/src/base/game/KinkyDungeonDraw.ts:3071 KinkyDungeonUpdateVisualPosition()` |
| **输入** | `Scripts/Main.ts:159 KeyDown`（丢弃 repeat）→ `KinkyDungeonInput.ts` 命令化 → `KDSendInput("move"/...)` |

---

## 7. 对你们两处改动的具体建议

### 7.1 Mod 补丁语义 —— 你们已经领先，只补三个零件

1. **加载顺序只保留一个维度**：`priority` 降序 + 包内 `fileorder` + 文件名稳定排序。**不要做依赖图**——KD 声明了 4 个依赖字段、一个都没实现，说明作者试过、放弃了。
2. **崩溃熔断**：加载每个 mod 前写哨兵，全部成功后清除；启动时残留则隔离该 mod 并禁用自动加载。**同时修掉 KD 那个 bug**——`eval` 必须包在能 `reject` 的 Promise 里（或 `try/catch` 后 `resolve(false)`），否则一个语法错误就让整局永久卡死。
3. **明确禁止函数替换**：把 patch 限制在"数据 + 声明式 hook"上。KD 的 `KDCanSleep = function(){}` 这种玩法会让你的升级成本变成"每次发版要人工检查所有 mod"。

**额外建议**（KD 完全没有）：mod 的**启用/禁用开关** + 冲突检测（同 id、同一数据条目被两个 mod 改）+ 加载失败的**用户可读错误**（而不是 `console.log`）。

### 7.2 渲染的动画同步 —— 可抄，但要连"账"一起抄

1. **动画不要有"规定时长"**。要么"距离/速度"，要么"状态插值 `visual = lerp(visual, target, k*dt)`"。一旦写字面量 `duration: 300ms`，就必须同时定义"逻辑在 300ms 内再次结算"的策略——KD 没有答案。
2. **必须有落后预算**。KD 是 5 格。建议改成语义化的判据："**逻辑已推进 N 步而视觉仍未到达第 1 步**"，比纯距离更贴合"追赶"的本质。
3. **锁定一个锚点**。KD 最大的技术债是"相机用逻辑坐标、绘制用视觉坐标、特效层混用"（§3 Q19b-2）。你们从一开始就规定：**所有渲染输入都从 visual 派生**，逻辑坐标只在逻辑层出现。
4. **别让视觉状态进入玩法判定**（`KDTethers` 用 `visual_x - x > 2` 做判定是反面教材）。
5. **抄这一行**：`delta = Math.min(now - last, last - last2)`，一行解决 tab 切回来的跳帧。
6. **算一次账**：视觉速度 vs 输入节拍。KD 默认 100ms/格 vs 175ms/回合（追上），慢速状态 250ms/格（追不上，靠 snap）。你们的两个数值定了，这套模式才是可控的。

---

## 8. 未深入验证（诚实标注）

- **图集 JSON 无法从源码给出**：`TextureAtlas/` 被 `.gitignore` 忽略，只能从 5.4.74 发行包取证（已附）
- `kdAPI` 宿主端（Electron 主进程/preload）**不在 5.5 仓库**，只有 5.4.74 发行包里的实现
- 手柄：`gamepad` 全仓 0 命中；触屏可用但 `Main.ts` 里的 `Touch*` 是空壳，真正实现在 `KinkyDungeon.ts:6935+`
- `KinkyDungeonHUD.ts`（150KB）只做了函数/坐标级定位，内部细节未逐行读
- `Screens/` 下的 CSV 多语言表未展开
- 战斗（`KinkyDungeonFight.ts` 3897 行）只看了时序相关段落，未做完整时序分析
- 5.4.74 与 5.5 的**逐文件 diff** 未做（需要时可以做，用来找"最新改动集中在哪"）

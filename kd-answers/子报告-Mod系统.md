# Kinky Dungeon 5.5 Mod 系统实地分析（仅依据 `R = C:\D\chaijie\KinkiestDungeon-5.5` 源码）

前置事实（先确认存在性，避免后面重复）：

| 文件 | 状态 |
|---|---|
| `index.html` | 存在（40 行） |
| `poweredby` | **不存在**（全仓 grep 无此文件/字符串） |
| `package.json` | 存在 |
| `tools\pack.py` + `tools\wtxpck*.exe/conf` | 存在 |
| `electron.js` | **不存在**，全仓也没有 preload.js / 主进程代码 |
| `Scripts\KDMods.ts` | 存在（870 行） |
| `Scripts\KDModsUtils.ts` | 存在（177 行，任务清单里没列，但很关键） |
| `Scripts\Patch.ts` | 存在（53 行） |
| `Scripts\Main.ts` | 存在（239 行） |
| `Game\src\base\KDModUtils.ts` | 存在（574 行，注意是 `KDModUtils`，内容是 mod 作者用的工具函数） |
| `Game\src\base\KinkyDungeonErrors.ts` | 存在（329 行） |
| `Scripts\lib\zip-full.min.js` | 存在，但**是 zip.js 不是 JSZip**（全仓 `JSZip`/`loadAsync` 命中数 0，用的是 `zip.ZipReader`/`BlobReader`/`BlobWriter`） |
| `out\main.js` | 不存在（构建产物，`.gitignore` 只放行 `out/saveworker.js`） |
| `TextureAtlas\` | 不存在（被 `.gitignore` 忽略，是 wtxpck 构建产物） |

---

## 1. Mod 发现机制

**结论**：没有"扫文件夹"的通用逻辑，也没有索引清单文件。Mod 就是**用户投喂的 zip**，两条来源：
- **桌面版**：页面探测 `window.kdAPI`（Electron preload 桥），调 `API.getMods()` 拿宿主返回的一组 `{file, base}`，`base` 就是 zip 文件名，作为字典 key。**`getMods` 的实现不在本仓库**（无 electron.js/preload.js），只能看到调用契约。
- **Web 版**：没有 `kdAPI` 时走 IndexedDB：`localStorage["KinkyDungeonModList"]` 存名字列表，`KinkyDungeonModSave/Load` 从 IndexedDB 取 File；用户在 Mods 界面用 `<input type=file>` 手动添加。

**启用/禁用**：没有"逐个 mod 的启用开关"。只有三个全局手段：① `KDToggles.AutoLoadMods`（默认 **false**，即默认不自动加载，手动塞 zip 只对本次会话有效，除非开启后写入 IndexedDB）；② 列表里的 Delete 按钮（删内存字典 / 删 IndexedDB）；③ 加载失败时把该 mod 从自动加载列表里踢掉。加载时机也不是页面启动，而是**点"继续游戏"时**才执行。

**证据**：
`Scripts/KDMods.ts:87-117`（桌面：`kdAPI.getMods()`）
```ts
async function KDGetModsLoad(execute) {
	let modsFromIndexedDB: File[]
	try {
		let API = window.kdAPI;                 // 91
		if (API) {
			KDOffline = true;                    // 93
			let modFiles = await API.getMods();  // 104
			for (let mod of modFiles) {
				if (mod.file) {
					const blob = new Blob([mod.file], { type: 'application/octet-stream' });
					const fileObject = new File([blob], mod.base, { type: 'application/octet-stream' });
					KDMods[mod.base] = fileObject;   // 113  key = zip 文件名
```
`Scripts/KDModsUtils.ts:44-58`（web：IndexedDB 自动加载）
```ts
const autoLoadMods = async () => {
	const modList = getOnlineModNameList();      // localStorage["KinkyDungeonModList"]
	const loadModList: File[] = [];
	for (const modName of modList) {
		const res = await KinkyDungeonModLoad(modName);   // IndexedDB get
```
`Scripts/KDMods.ts:216-235`（手动添加）、`Game/src/player/KinkyDungeonVibe.ts:150`（`AutoLoadMods: false`）、`Game/src/base/KinkyDungeon.ts:1623-1635`（启动分流：有 sentinel 就弹窗并**跳过**自动加载）、`Game/src/base/KinkyDungeon.ts:1965-1973`（`KDExecuteModsAndStart()` 绑在 Continue 按钮上）。

**对我们的含义**：KD 的"发现"= 文件名即 ID + 用户投喂，落地成本最低；如果我们要"已安装列表/依赖/启用开关"，这层必须自己补，KD 里一个字都没有。

---

## 2. 加载顺序怎么定

**结论**：只有一个排序键 `priority`，注释写明"Higher = earlier"，比较器是 `b.priority - a.priority`（**降序**，大者先跑）。同 `priority` 时依赖 `Array.prototype.sort` 的稳定性 → 保持 `KDMods` 对象里的插入顺序（= 宿主返回顺序 / 用户选择顺序）。依赖、loadbefore、loadafter、incompatibilities 四个字段在接口里**全部标了 `UNIMPLEMENTED`**，代码里也没有任何读取处。

文件级顺序：`mod.json` 的 `fileorder` 数组优先，zip 内其余条目按 zip 中央目录顺序追加到尾部；`.csv` 被排除在自动追加之外，之后**强制**排到最后（先 `*EN.csv`，再当前语言 `*.csv`）。

冲突处理：
- **同名 zip（同名"id"）** → `KDMods[f.name] = f` 直接覆盖，静默，后者赢。
- **内容冲突**（两个 mod 都改同一个全局/塞同名敌人）→ 无检测，**谁后执行谁赢**。
- **版本不匹配** → 只影响 Mods 列表文字颜色（红/橙/黄），**不阻止执行**。

**证据**：
`Scripts/KDMods.ts:44-57`（字段与三处 UNIMPLEMENTED）
```ts
	/** Higher = earlier */
	priority: number,
	/** number is minimum version number  UNIMPLEMENTED */
	dependencies?: Record<string, number>,
	/** if the mod id is present, loads before. UNIMPLEMENTED */
	loadbefore?: string[],
	/** if the mod id is present, loads after. UNIMPLEMENTED */
	loadafter?: string[],
```
`Scripts/KDMods.ts:341-343`（排序）
```ts
		KDModLoadOrder = modFiles.sort((a, b) => {
			return (b.priority || 0) - (a.priority || 0);
		}).map((ent) => {return {mod: ent.mod, name: ent.name, fileorder: ent.fileorder};});
```
`Scripts/KDMods.ts:397-413`（fileorder 兜底 + CSV 置尾）
```ts
		for (let entry of entries) {
			if ((!mod.fileorder.includes(entry.filename)) && (!entry.filename.endsWith('.csv'))) {
				mod.fileorder.push(entry.filename);
			}
		}
		for (let entry of entries) {
			if (entry.filename.endsWith(`EN.csv`)) { mod.fileorder.push(entry.filename); }
		}
```
`Scripts/KDMods.ts:242`（同名覆盖）、`Scripts/KDMods.ts:159-178`（版本只染色：`color = KDBaseRed; info = "KDModOutdated2";`）。

**对我们的含义**：`priority` + 文件级 `fileorder` 这套两级覆盖够用且极便宜；但真正的依赖图必须另建，`UNIMPLEMENTED` 三个字就是 KD 自己承认的缺口。

---

## 3. Mod 能不能改已有内容

**结论**：能，而且不是"补丁/声明式覆盖"，是**运行时全量接管**：改全局变量、给全局函数重新赋值。没有任何 wrap/around 机制，想 wrap 只能自己存旧引用（示例没做）。

`Patch.ts` **不是 mod 机制**，它是"单机版把 Bondage Club 的 API 打桩"的裁剪文件：`StandalonePatched = true`、`KDPatched = true`，把 BC 的 `ReputationGet`、`InventoryWear`、`ChatRoomPublishCustomAction`、`TypedItemDataLookup` 等替换成空实现/常量。它靠的是 `tsconfig` 里 `Patch.ts` 排第一个 + 单文件 `outFile` 全局拼接，跟 mod 加载没有任何调用关系。

升级会不会断？会，而且 KD 自己已经在打补丁：`KDModCompat` 是"旧函数名 → 新函数名"的**源码字符串替换表**，在 `eval` 之前对 mod 源码做正则全局替换（默认关闭，`ModCompat: false`）。示例 mod 也没敢硬来，用 `typeof KDCanSleep === "function"` 兜底。

还有一条硬约束：mod 是**直接 eval** 且示例首行是 `'use strict'`，按 ES 规范严格模式 eval 有独立作用域 → mod 里 `function`/`var` 声明**不会变成全局**，只能修改已存在的全局。所以"新增一个游戏会按名字调用的全局函数"这条路在严格模式下走不通（此条为基于 `eval(res)` + 首行 `'use strict'` 的语义推断，代码里没有注释说明）。

**证据**：
`Scripts/Patch.ts:1-2,41-42`
```ts
// This should be true only for standalone
const StandalonePatched = true;
...
let KDPatched = true;
let ServerURL = "http://localhost:4288";
```
`Scripts/KDMods.ts:12-23`（兼容表）
```ts
let KDModCompat = {
	"KinkyDungeonHiddenFactions.push(": "KinkyDungeonHiddenFactionsPush(",
	"KDSetNPCLocation(": "KDMovePersistentNPC(",
	"KinkyDungeonChangeDesire(": "KDChangeDesire('','','',",
	"KinkyDungeonCanPickStat(": "KDCanPickPerk(",
};
```
`Scripts/KDMods.ts:476-483`（eval 前替换 + eval）
```ts
								if (KDToggles.ModCompat) {
                                    for (let compat of Object.entries(KDModCompat)) {
										const escapedKey = compat[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
										res = res.replace(new RegExp(escapedKey, 'g'), compat[1]);
									  }
								}
								let evaluated = await eval(res);
```
`Mods/example_unlimitedbed/UnlimitedBed.js:4-15`（整体替换 + 自查）
```js
KDSleepWillFraction = 1.0;
KDSleepWillFractionJail = 1.0;
if (typeof KDCanSleep === "function") {
    KDCanSleep = function() { ... }
} else {
    log.error("Cannot find KDCanSleep function!");
}
```
（附带发现：`log` 在本仓库里**没有定义**——`grep "log.error"` 只命中示例 mod 自己；真走到 else 分支会抛 ReferenceError。）

**对我们的含义**：抄"运行时接管"的爽快，但必须同时提供**注册式 hook 白名单**；否则我们的用户会像 KD 一样，靠 grep 源码 + 字符串替换来续命。

---

## 4. 坏的 Mod 怎么表现

**结论**：不是"启动期报错并禁止开局"，实际是**加载期静默卡死 + 下次启动弹窗点名**。三层防线，全都很薄：

1. **逐文件 try/catch**，只 `console.log(err)`，不中断后续文件（`KDMods.ts:428,490-492,514-516`）。
2. **`eval` 的异常其实抓不到**：`eval` 写在 `FileReader.onload` 的 `async` 回调里，回调 reject 出来的 Promise 没人接；外层 `await new Promise(...)` 的 `resolve` 永远等不到 → **Promise 永不 settle**，整条 `reduce` 串行链挂住。此时 `KDAwaitingModLoad` 一直是 `true`，而它会让 `KDHandleMouseDown` / `KinkyDungeonHandleClick` 直接 `return true` → **输入全废**，UI 冻死。这就是注释里 "A mod caused the game to stop responding" 的来源。
3. **哨兵 + 下次启动降级**：每处理一个 mod 前写 `localStorage["KDLastModLoaded"] = mod.name`，全部成功后 `removeItem`；下次启动发现它还躺着 → 弹 `KinkyDungeonShowModLoadFailedModal` 点名该 mod、**跳过本次自动加载**、并把它从在线列表里删掉。
4. **兜底崩溃报告** `KinkyDungeonErrors.ts`：`window.addEventListener("error", ...)` → 采集错误栈/版本/状态/已加载 mod 列表/设备/整份存档 → 弹模态框，可一键复制。**不阻止开局、不上报服务器、没有隔离**。

另外 `KDLoadModJSON` 有一道"防炸弹"：JSON 长度 ≥ 100000 字符就**不解析**（保持默认值），并 try/catch 掉 `JSON.parse`。

**证据**：
`Scripts/KDMods.ts:470-488`（不可 settle 的等待）
```ts
					await new Promise((resolve,reject) => {
						reader.onload = async function(event) {
							if (typeof event.target.result === "string") {
								let res = event.target.result;
								...
								let evaluated = await eval(res);   // 抛错 → 只 reject 这个 async 回调
								resolve(evaluated);                // 永远到不了
							}
						};
						reader.readAsText(readfile);
					})
```
`Scripts/KDMods.ts:391,555`（哨兵写入/清除）、`Scripts/KDMods.ts:563-567`（弹窗 + 从在线列表移除）
`Game/src/base/KinkyDungeon.ts:1623-1627`
```ts
            if (localStorage.getItem(`KDLastModLoaded`)) {
                // A mod caused the game to stop responding last time we loaded them, throw an error window and disable autoload
                KinkyDungeonShowModLoadFailedModal(localStorage.getItem(`KDLastModLoaded`))
                localStorage.removeItem(`KDLastModLoaded`)
            }
```
`Game/src/base/KinkyDungeon.ts:6491-6495`（输入闸门）
```ts
let KDAwaitingModLoad = false;
function KDHandleMouseDown() {
	allowMusic = true;
	if (KDAwaitingModLoad) return true;
```
`Game/src/base/KinkyDungeonErrors.ts:6-8,31-39`（window error → 报告 → 模态框）

**对我们的含义**：**"哨兵 + 下次启动降级并点名"这一招非常值得抄**，几十行代码换一个可恢复的失败模式；但"eval 在 onload 里不接异常"是反面教材，一个坏 mod 就能把整个前端冻死。

---

## 5. 资源路径怎么解析

**结论**：**约定路径 + 一张扁平字典 `KDModFiles`（逻辑路径 → blob URL）**，没有统一资源清单，也没有注册 API。

流程：mod 里所有非 `.js/.ks` 且非 `.csv` 的条目都被 `URL.createObjectURL(blob)`，然后以 `KinkyDungeonRootDirectory + file`（`KinkyDungeonRootDirectory = "Game/"`）为 key 写进 `KDModFiles`。读取侧 `KDTex` 先查表：`KDModFiles[Image] || Image`，命中就用 blob，否则当普通 URL 交给 PIXI。所以 mod 包里 `Enemies/AngrySkeleton.png` → 运行时路径 `Game/Enemies/AngrySkeleton.png`，正好是原版约定（敌人贴图就是 `Game/Enemies/<enemy.name>.png`）。

图集：原版资源由 `tools/pack.py` 调 `wtxpck` 把 `../Game/` 打进 `TextureAtlas/game_0000.json`（`nearestList`）等 4 张图集，`TextureAtlas/` 整个目录被 `.gitignore` 忽略——即**图集是构建产物，不在源码仓库里**。mod 图片**不需要**进图集，散图即可；另外 `Data/`、`Models/`、`DisplacementMaps/`、`TextureAtlas/`、`Music/` 前缀的 mod 文件会额外登记裸路径和绝对路径，配合 `Preload.ts` 里注册的 `modAtlasLoader` / `modTextureLoader` / `resolveModURL` 三个 PIXI 扩展，就能加载 mod 自带的图集 JSON。

**证据**：
`Scripts/KDMods.ts:494-512`
```ts
			} else {
				KDModFiles[(KinkyDungeonRootDirectory + file).replace("\\", "/")] = URL.createObjectURL(blob);
				KDModFiles[(KinkyDungeonRootDirectory + "" + file).replace("\\", "/")] = KDModFiles[KinkyDungeonRootDirectory + file];
				if (file?.startsWith("Data/") || file?.startsWith("DisplacementMaps/") || ... ) {
						KDModFiles[file.replace("\\", "/")] = URL.createObjectURL(blob);
						KDModFiles[(PIXI.utils.path.toAbsolute(file)).replace("\\", "/")] = URL.createObjectURL(blob);
				}
```
`Game/src/base/game/KinkyDungeonDraw.ts:5197-5202`
```ts
function KDTex(Image: string, Nearest?: boolean): PIXITexture {
	if (kdpixitex.has(Image)) return kdpixitex.get(Image);
	if (errorImg[KDModFiles[Image] || Image]) return null;
	try {
		let tex = Nearest ? PIXI.Texture.from(KDModFiles[Image] || Image, OPTIONS_NEAREST)
		: PIXI.Texture.from(KDModFiles[Image] || Image);
```
`Game/src/enemy/KinkyDungeonEnemies.ts:1022,1098`（贴图命名约定）
```ts
	let sprite = enemy.Enemy.name;
	...
			let spr = KDDraw(board, kdpixisprites, "spr_" + enemy.id + id, KinkyDungeonRootDirectory + "Enemies/" + sp + ".png",
```
`Data/Preload.ts:421-423`（图集清单）+ `Data/Preload.ts:643-660,718-733`（三个 PIXI 扩展）+ `tools/wtxpck.game.conf`（`input=../Game/` → `output=../TextureAtlas/`）。

**对我们的含义**：一张"路径 → URL"的扁平表就能做到零注册、零清单；代价是拼错名字静默失败（`KDTex` 只 `console.log("Failed to find texture")` 并把 key 记进 `errorImg` 之后永远返回 null）——我们需要的是同样的扁平表 + 一个开发期的"缺失资源"校验。

---

## 6. 它跑在什么壳里

**结论**：壳内是**纯 Web 页面**，不是本地服务也没 Node 集成：`index.html` 用 12 个 `<script>` 标签顺序加载（pixi、filters、LZString、zip.js、web-streams、oggmented、buttplug…），最后是 `./out/main.js`——由 `tsc` 的 `outFile` 把全部 TS **拼成一个文件**，没有模块系统、没有 bundler。

桌面版是**外部 Electron 壳**：README 明说构建后把 `out` 拷到 `<游戏目录>/resources/app/out`，即 `resources/app/index.html` 被加载。**主进程/preload 不在本仓库**，所以 `window.kdAPI` 的实现（`getMods` / `close` / `setFullscreen` / `setWindowed` / `getFile`）"未在代码中找到"，只能看到调用点。`package.json` 的 `"main": "index.html"` 在 Electron 语义下不可能是主进程入口（Electron 要求 JS 文件，指 HTML 会直接报错），而仓库里也**没有任何代码读取这个字段** —— 推断它只是给打包/发布链路看的标记。

CSP / 权限：`index.html` **没有 CSP meta**、没有 `sandbox`、没有 `contextIsolation` 相关配置（都在壳里，看不到）。开发用 `npm run serve` = `http-server` 静态服务。

打包后资源怎么找：`tsconfig` 把代码拼成 `out/main.js`，`tools/pack.py` 依次跑 4 个 `wtxpck.*.conf` 生成 `TextureAtlas/`；运行时 `KinkyDungeonRootDirectory = "Game/"`（`Main.ts:53` 在 `window.onload` 里设置），所有资源路径都是相对这个前缀的字符串。

**证据**：
`index.html:23-32`
```html
<script src="Game/pixi.min.js"></script>
<script src="Scripts/lib/pixi-filters.js"></script>
...
<script src="Scripts/lib/zip-full.min.js"></script>
<script src="Scripts/lib/web-streams-polyfill.min.js"></script>
<script src="Scripts/lib/buttplug-bundle.js"></script>
<script src="./out/main.js"></script>
```
`package.json:5,7,11-12`（`"main": "index.html"`、`"build": "tsc && npm run pack"`、`"serve": "http-server"`）
`tsconfig.json:12-15`
```jsonc
        // Core js (or ts) files.
        // We have to use a `files` declaration because order is important here
        // (both due to BC design, and the fact KD monkey-patches parts of BC)
        "Scripts/Patch.ts",
```
`README.md:66-67`（`<your KD game directory>/resources/app/out`）
`tools/pack.py:23-32`（四张图集 + `subprocess.run`）
`Scripts/Main.ts:52-53`（`window.onload` 里 `KinkyDungeonRootDirectory = "Game/"`）
`Game/src/base/KinkyDungeon.ts:1265,1471,1481,2085`（`window.kdAPI` 的 4 个调用面）

**对我们的含义**：`tsc outFile` + 全局脚本顺序 = "所有符号都在同一个作用域里"，这正是 mod 能 `eval` 一行就接管游戏的前提；要换 ESM/打包器，就得同时设计一套真正的 API 层。

---

## 7. Mod 能写脚本吗

**结论**：能，**任意 JS，直接 `eval`，无沙箱、无 iframe、无 Worker、无 `new Function` 包装**——跑在页面主线程，和游戏同一作用域，能读写 localStorage（含存档）、能发网络请求、能改 UI。

`.ks` **不是脚本语言也不是数据文件**，就是 `.js` 改了扩展名：`file.endsWith('.js') || file.endsWith('.ks')` 走同一个分支（`.ks` = "Kinky Script" 的约定）。`.csv` 才是数据（翻译）。

执行顺序与注入点：
- 注入点 = `KDMods.ts:483` 的 `eval(res)`，一行。
- 时机 = 不是页面加载，而是 `KDExecuteMods()`，由"继续游戏"按钮（`KinkyDungeon.ts:1973`）或 Mods 界面返回（`KinkyDungeon.ts:1845`）触发；`KDExecuted` 保证**全局只执行一次**。
- 顺序 = mod 之间按 `priority` 串行（`await` reduce），mod 内部按 `fileorder`/zip 顺序串行；每个文件都是"读完 → eval → 下一个"。
- 收尾钩子 = `KinkyDungeonSendEvent("afterLoadMods", {})`，之后还有 `KDLoadPerks()`、刷新 restraint/enemy 缓存、重设玩家角色。
- 另有两套数据驱动的扩展面：`addTextKey`（文本）、`KDModConfigs` + `KDModSettings`（mod 自己的配置页，支持 toggle/range/text/string/list，存 localStorage）。

**证据**：
`Scripts/KDMods.ts:465-470`（`.js` 与 `.ks` 等价 + 自曝风险）
```ts
			} else if (file.endsWith('.js') || file.endsWith('.ks')) {
				try {
					let reader = new FileReader();
					let readfile = new File([blob], entry.filename);
					// Eval js files. eval() is dangerous. Don't load untrusted mods.
					await new Promise((resolve,reject) => {
```
`Scripts/KDMods.ts:519-523`（串行链）
```ts
		await KDModLoadOrder.reduce(async (promiseChain, currMod) => {
			await promiseChain;
			return processMod(currMod);
		}, Promise.resolve(null));
```
`Scripts/KDMods.ts:546-556`（收尾）
```ts
	KDLoadPerks();
	KinkyDungeonRefreshRestraintsCache();
	KinkyDungeonRefreshEnemiesCache();
	KDAwaitingModLoad = false;
	KinkyDungeonSendEvent("afterLoadMods", {});
    localStorage.removeItem(`KDLastModLoaded`)
```
`Scripts/KDMods.ts:447-456`（CSV 分支，且**没有 await**，是 fire-and-forget，注释自己说"we should chain this"却没做）
`Game/src/effect/KinkyDungeonEvents.ts:65-81`（事件总线，mod 可以往各 `KDEvents*` 表里塞 handler）

**对我们的含义**：`eval` 一行换来了极低的上手门槛（示例 mod 一共 16 行），但"可写 localStorage 的存档"意味着任意 mod 都能改档/传档——我们要么保留这个自由度并明确免责，要么在这里加一层 API 代理。

---

## 8. 数据从哪来

**结论**：**全部硬编码在 TS 里**，没有外部 JSON/YAML 数据文件（`Data/` 目录里全是 `.ts`：`Defs.ts`、`ModelList*.ts`、`MushWarp.ts` 等；唯一的"外部数据"是 `.csv` 翻译表）。敌人是字面量数组 `let KinkyDungeonEnemies: enemy[] = [...]`，物品/束缚同理；`KDModUtils.ts` 提供的是"往数组里 push 的助手函数"（`KinkyDungeonCreateRestraint`、`KinkyDungeonCloneRestraint`、`KinkyDungeonAddCursedVariants`），并不是注册表。

示例怎么加敌人：**直接 `push` 一个字面量对象进全局数组** + `addTextKey` 补文本，没有 id 注册、没有校验。唯一"身份"是对象里的 `name` 字段；运行时 `KinkyDungeonRefreshEnemiesCache()` 遍历数组建 `Map<name, enemy>`，重复 name 后者覆盖（`Map.set`），查找时优先查 Map、miss 再 `find`。贴图靠 `Game/Enemies/<name>.png` 约定（示例里 `name: "AngrySkeleton"` + zip 内 `Enemies/AngrySkeleton.png` 正好对上；`bound: "Skeleton"` 表示被绑时复用原版 `Enemies/Skeleton.png`）。

**证据**：
`Game/src/enemy/KinkyDungeonEnemiesList.ts:5-8`
```ts
let KinkyDungeonEnemies: enemy[] = [
	// Prisoners
	{name: "PrisonerBandit", tags: KDMapInit(["prisoner", "bandit", "human", "peaceful", "noshop"]), faction: "Prisoner", immobile: true, lowpriority: true, evasion: -100, armor: 0, followRange: 100, AI: "wander", regen: 0.1,
		visionRadius: 0, maxhp: 12, minLevel:0, weight:-1000, movePoints: 1000, attackPoints: 0, attack: "", attackRange: 0, specialdialogue: "PrisonerBandit",
```
`Mods/example_enemy/init.ks:3-7`
```js
KinkyDungeonEnemies.push(
	{name: "AngrySkeleton", bound: "Skeleton", playLine: "Skeleton", hitsfx: "AngryHit", clusterWith: "skeleton", tags: KDMapInit([...]), ignorechance: 0, armor: 0, followRange: 1, AI: "hunt",
		visionRadius: 4, maxhp: 5, minLevel:1, weight:8, movePoints: 2, attackPoints: 3, attack: "MeleeBind", ...},
);
addTextKey("NameAngrySkeleton", "Angry Skeleton");
```
`Game/src/enemy/KinkyDungeonEnemies.ts:114-119`（缓存构建）
```ts
function KinkyDungeonRefreshEnemiesCache() {
	KDEnemiesCache = new Map();
	for (let enemy of KinkyDungeonEnemies) {
		KDEnemiesCache.set(enemy.name, enemy);
	}
}
```
`Game/src/base/KDModUtils.ts:52-67`（"助手"其实是 push）
```ts
	const restraint = ({ ...cloneDeep(defaultRestraint), ...props });
	KinkyDungeonRestraints.push(restraint);
```
`Scripts/Text.ts:675-679`（文本注入点）

**对我们的含义**："数据即对象字面量"让 mod 能塞函数/闭包（字段值不限类型），灵活到极致，但**零校验、零 Diff、零并发安全**；我们要做数据驱动的话，`KDMapInit([...tags])` 这种"数组转 Set/查表"的小工具是唯一值得借鉴的形状。

---

## 我认为最值得抄的三件事

1. **文件名即 mod id + 单 zip + 全局 `priority` 降序排序**（`KDMods.ts:238-244, 341-343`）——没有 manifest 索引、没有注册中心，用户拖一个 zip 进来就能用，成本几乎为零。
2. **"逻辑路径 → blob URL"的扁平资源表，读取侧先查表**（`KDMods.ts:494-512` + `KinkyDungeonDraw.ts:5199-5202`）——mod 加图不用进图集、不用登记，一行约定就够。
3. **崩溃哨兵 `KDLastModLoaded`：执行前写、全部成功后清、下次启动发现残留就弹窗点名并停用自动加载**（`KDMods.ts:391,555` + `KinkyDungeon.ts:1623-1627`）——用几十行换来"坏 mod 只坏一次、且用户知道是谁"。

## 我认为不要抄的三件事

1. **在 `FileReader.onload` 的 async 回调里 `eval` 却不把异常接到 `reject`**（`KDMods.ts:470-488`）——mod 抛错时加载 Promise 永不 settle，`KDAwaitingModLoad` 常驻 true，整个 UI 冻死（`KinkyDungeon.ts:6495`）。
2. **用源码字符串正则替换来兼容旧 mod**（`KDMods.ts:12-23, 476-482`）——把函数名当 ABI，每改一次 API 就要维护一条替换规则，且替换发生在任何语法检查之前。
3. **无 CSP + 对任意下载的 zip 直接 `eval`**（`index.html` 全文无 CSP meta；`KDMods.ts:483`）——mod 与游戏同源同作用域，能读写 `localStorage["KinkyDungeonSave"]`（整份存档）、能改 UI、能外发数据；KD 自己在注释里写 "Don't load untrusted mods"，但架构上没有任何拦截。

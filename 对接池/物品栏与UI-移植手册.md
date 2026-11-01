# Kinky Dungeon 物品栏 / UI 移植手册

> 给下一个接手的人（或 AI）。这份文档的目标不是"介绍 KD"，而是**让你能在自己的引擎里复刻一个同等级的物品栏**，并且知道哪些地方它做得对、哪些地方别学。
> 仓库：`C:\D\chaijie\KinkiestDungeon-5.5`。所有 `文件:行号` 都可直接跳读。
> 阅读顺序建议：§1 → §2 → §4 → §5 → §8（§8 是结论，赶时间只看它）。

---

## 给 AI 的三行摘要（复制给模型用）

> KD 的背包 = `Map<类型, Map<物品名, item>>`，物品是"模板名 + 差异字段"的扁平对象，变体是全局表里的模板增量（item 只存 key）。
> UI = 一本 640×520（×1.3）的书：左页详情、右页 6×6 的 80px 图标网格（虚拟滚动），点格子直接触发默认动作，动作按钮 74px 一排 9 个排在下面。
> 最该抄三件事：模板/实例/变体三层分离；`KDInventoryActionDef` 表驱动（show/valid/invalidtooltip/click 全函数）；同一容器抽象复用给背包/箱子/NPC。最该改三件事：物品名当主键（同名覆盖）、变体名靠字符串拼接、装备区没有槽位表只有链表。

---

## 0. 先给结论：这套系统值得学的就四件事

1. **三层分离**：`模板（数据表）` / `实例（item 对象）` / `变体（variant 注册表）`。变体只存一个字符串 key，重量级配置在全局表里——这一条让它能支持"同一件护腕的 20 种颜色 + 锁定 + 附魔"而不炸内存。
2. **一个容器抽象统一所有"有物品的地方"**：玩家背包、地上的箱子、NPC 身上的束缚、衣柜，全部走同一套 CRUD + 同一套 UI（`KDContainer`）。
3. **动作是数据，不是 if-else**：每个动作是一个 `KDInventoryActionDef` 对象，`text/label/show/valid/click/icon/hotkey` 全是**函数** → 同一个动作表可以画在背包里、画在快捷栏上、画在 NPC 面板里。
4. **界面是"书"不是"窗口"**：640×520 的书页底图 × 1.3 缩放，左页详情、右页列表，点物品开**侧栏子页**（不是弹窗）。

**四条明确的坑**（§8 详述）：背包用「名字」当唯一键（同名字必覆盖）、变体表需要手动 GC、UI 坐标大量写死、动作表的 `valid` 与 `show` 语义容易混。

---

## 1. 数据模型：三层

### 1.1 第一层：模板（静态数据表）

物品的"长什么样"不在物品对象里，在全局表里：

| 表 | 内容 | 位置 |
|---|---|---|
| `KinkyDungeonRestraints` | 束缚模板 | `restraint/KinkyDungeonRestraintsList.ts` |
| `KinkyDungeonWeapons` | 武器模板 | `fight/KinkyDungeonWeaponList.ts` |
| `KinkyDungeonConsumables` | 消耗品模板 | `item/KinkyDungeonConsumablesList.ts` |
| `KinkyDungeonLoot` | 掉落表 | `item/KinkyDungeonLootList.ts` |

### 1.2 第二层：实例（`item`）

```ts
// base/KDTypeDefs.ts:25
interface item extends NamedAndTyped {
    id: number,                 // 实例唯一 id（不是名字）
    name: string,               // ← 指向模板，同时是背包里的唯一键
    type?: string,              // consumable/restraint/looserestraint/outfit/accessory/weapon/armor/misc
    quantity?: number,          // 堆叠数量
    faction?: string,           // 阵营（决定外观/归属）
    forceFaction?: string,      // 强制阵营，不可被覆盖
    inventoryVariant?: string,  // ← 变体表的 key
    inventoryAs?: string,       // ← 另一种变体 key（旧字段）
    curse?: string,
    lock?: string,              // 锁类型
    events?: KinkyDungeonEvent[],// 物品携带的事件（buff/触发）
    data?: Record<string, any>, // 通用数据袋，事件可读写
    // ... 还有 tether / progress 等专用字段
}
```

**要点**：`id` 是实例身份，`name` 是模板指针 + 背包键。这两个字段的分离是整个系统的地基。

### 1.3 第三层：变体（variant 注册表）

同一件物品的"不同版本"不复制 item，而是：

```ts
// item/KinkyDungeonInventory.ts:121-154
let KinkyDungeonRestraintVariants: Record<string, KDRestraintVariant> = {};
let KinkyDungeonConsumableVariants: Record<string, KDConsumableVariant> = {};
let KinkyDungeonWeaponVariants: Record<string, KDWeaponVariant> = {};

function KDGetRestraintVariant(item: item): KDRestraintVariant {
    return KinkyDungeonRestraintVariants[item.inventoryVariant || item.inventoryAs || item.name];
}
function KDGetVariant(item: item): KDWeaponVariant {
    return KDGetRestraintVariant(item) || KDGetWeaponVariant(item) || KDGetConsumableVariant(item);
}
```

**读取顺序是一个 fallback 链**：`inventoryVariant` → `inventoryAs` → `name`。意思是"没指定变体就用同名的默认变体"，所以**哪怕不生成变体，也能保证 `KDGetVariant` 返回非空**（默认档案）。

**变体的 key 是运行时拼出来的**（`item/KinkyDungeonInventory.ts:3540` 附近）：

```ts
let newname = prefix + variant.template + KinkyDungeonGetItemID() + (curse ? curse : "");
KinkyDungeonRestraintVariants[newname] = variant;
```

于是有一个容易看漏的分裂行为：

| 物品状态 | `name` 存什么 | 唯一变体名存哪 |
|---|---|---|
| **散装**（`LooseRestraint`） | **唯一变体名** | 就是 `name` |
| **已穿戴**（`Restraint`） | **保持模板名**（供 `KDRestraint()` 查表） | `inventoryVariant` |

所以读取端必须统一写 `item.inventoryVariant || item.name`——这不是风格，是硬约束。

变体表会被 **GC**（`item/KinkyDungeonInventory.ts:3346 KDPruneInventoryVariants`）：扫描"穿着的 / 背包里的 / 地上的 / 快捷栏的 / 实体身上的 / 容器里的"所有引用，把没被引用的变体从表里删掉。**这是必须的**——否则每次随机生成颜色都往表里塞一条，一局下来几千条。

> **移植建议**：抄"模板增量 + 全局注册表 + GC"这个结构，但**别抄拼名字**。拼名字的代价是"拼错就静默丢变体、且无法 grep"。用自增 `variantId` 或内容 hash 当 key。

---

## 2. 容器抽象：一个类型统一所有"有东西的地方"

### 2.1 玩家背包

```ts
// player/KinkyDungeonStats.ts:241
let KinkyDungeonInventory: Map<string, Map<string, item>> = new Map();

// :242-247
function KDInitInventory() {
    KinkyDungeonInventory = new Map();
    for (const c of [Consumable, Restraint, LooseRestraint, Weapon, Outfit]) {
        KinkyDungeonInventory.set(c, new Map());
    }
}
```

**两层 Map**：`类型 → (名字 → item)`。注意初始化只建了 5 个分类，`Armor`/`Accessory`/`Misc` 是后加的，**不在初始表里** → 往这几类加物品会走 `if (KinkyDungeonInventory.has(type))` 的分支而**静默丢弃**（`item/KinkyDungeonInventory.ts:613-615`）。这是一个真实隐患。

### 2.2 其它容器

```ts
// map/KDContainers.ts:8
interface KDContainer {
    name: string,               // 唯一名（含坐标后缀）
    location?: WorldCoord,
    point?: KDPoint,
    items: Record<string, item>,// 扁平！不是 Map<type, Map>
    lock: string,
    type: string,               // 决定 UI 皮肤/行为
    filters?: string[],
}
```

### 2.3 CRUD：同一组函数，`container?` 可选

```ts
// item/KinkyDungeonInventory.ts:609
function KinkyDungeonInventoryAdd(item, container?) {
    let type = KDInventoryType(item);
    if (container) { container.items[item.name] = item; }
    else if (KinkyDungeonInventory.has(type)) { KinkyDungeonInventory.get(type).set(item.name, item); }
}
// :635 Remove / :652 RemoveSafe（不动已穿着的） / :668 Get / :682 GetSafe / :704 GetWorn
// :506 AddWeapon / :512 AddLoose / :521 AddOutfit   ← 带"已存在则合并数量"的包装
```

**统一抽象的收益**：箱子和背包的 UI 是同一个函数，只是 `container` 不同。**代价**：玩家背包是两层 Map、容器是一层 Record，两条代码路径要各自维护（`KDInvAdd` 与 `KinkyDungeonInventoryAdd` 就是同一逻辑的两份拷贝，`:609` 与 `:621`）。

### 2.4 堆叠规则（重要，容易抄错）

- **主键是 `name`** → 同名物品在同一个分类里**只能有一条**，第二次 `Add` 会**覆盖**，不是累加。
- 累加只发生在**包装函数**里：

```ts
// :512-519
function KinkyDungeonInventoryAddLoose(Name, UnlockCurse?, faction?, quantity = 1, container?) {
    if (!KinkyDungeonInventoryGetLoose(Name, container) || UnlockCurse)
        KinkyDungeonInventoryAdd({ ..., quantity }, container);
    else
        KinkyDungeonInventoryGetLoose(Name, container).quantity += quantity;
}
```

- **注意 `|| UnlockCurse`**：带解咒的同类物品会走"新建"分支，但因为主键还是 `name`，结果是**覆盖掉原来那条**（原来 3 个变 1 个）。这是坑。

> **移植建议**：别用 `name` 当唯一键。用 `(templateId, variantKey, 关键状态)` 算一个 **stackKey**，同 key 累加数量、不同 key 各占一行。KD 因为物品种类少、大部分不可堆叠才没炸。

### 2.5 唯一容量限制：消耗品的 `maxInventory`

背包没有格子、没有总重，唯一的"上限"是**单个消耗品**的 `maxInventory`（默认 10，`item/KinkyDungeonConsumables.ts:887`）。超过就把溢出**转运到玩家箱子**（`:406-419`，上限函数 `KDMaxInventoryStorage` `:896`）。

也就是说：**它的"背包满了"不是整体满了，而是"这一种东西拿不下了"**。这个设计很省事，但也意味着玩家永远不需要整理背包。

---

## 2.6 装备区：没有槽位表，只有一个链表

这是最容易看错的地方——**KD 没有独立的"装备区"数据结构**：

- 穿戴的物品**仍然在同一个 `Restraint` 桶里**，跟背包里没区别
- "槽位"是**模板上的 `Group` 字符串**（如 `ItemHead` / `ItemMouth` / `ItemTorso` / `ItemHands` / `ItemFeet`…）
- 同槽多件（比如里面一件外面一件）用 **`dynamicLink` 单链表**叠罗汉

```ts
// restraint/KinkyDungeonRestraints.ts:3586
function KinkyDungeonGetRestraintItem(group: string, index?: number): item {
    for (let item of KinkyDungeonAllRestraint())
        if (item.type == Restraint && KDRestraint(item).Group == group) { /* index 走 dynamicLink */ return item; }
    return null;
}
```

穿上去时的冲突判定是**比数值**而不是比槽位：

```ts
// restraint/KinkyDungeonRestraints.ts:4745 KDCanAddRestraint
// rPower < KinkyDungeonRestraintPower(blocker) → 不许穿
```

即"更强的束缚会顶掉更弱的"，而不是"一个槽只能放一件"。

> **移植建议**：这一套**别照抄**。用显式的 `SlotDef[]`（槽名、层级、互斥组）+ `slots: item[]`，把"槽位"从字符串魔法里拿出来。另外注意 `player/KinkyDungeonDress.ts` 是**纯外观层**（往外观模型数组里塞部件），跟物品归属无关，别把两者混成一个系统。

---

## 3. 分类与筛选

分类是**字符串常量**，不是枚举：

```ts
// base/KinkyDungeon.ts:324-331
const Consumable = "consumable";
const Restraint = "restraint";
const LooseRestraint = "looserestraint";
const Outfit = "outfit";
const Accessory = "accessory";
const Weapon = "weapon";
const Misc = "misc";
const Armor = "armor";
```

`item.type` 直接存这些字符串；`KDInventoryType(item)` 就返回 `item.type`（`:561`）。

### 3.1 筛选器：6 个，单选循环，空则变灰

```ts
// item/KinkyDungeonInventory.ts:14
let KinkyDungeonFilters = [Consumable, Restraint, Weapon, Outfit, LooseRestraint, Armor];
```

- **单选**，不是多选 checkbox；用上下键（`KinkyDungeonKey[5] = 'E'` / `[7] = 'C'`）**循环切换**
- 每个筛选按钮在**没有匹配物品时自动变灰**（`tint: 0x444444`，`:2145-2149`）——先让玩家知道"这一栏是空的"，而不是点了才发现
- 精确参数（`item/KinkyDungeonInventory.ts:2104-2208`）：

| 项 | 值 |
|---|---|
| 按钮尺寸 | `90 × 90`；**选中项 `110 × 90`** |
| 位置 | `x = 1667 + XX*93`，`y = 160 + YY*93` |
| 排布 | `spacing = 93`，`perColumn = 6`（满 6 个换列） |
| 文字 | 按钮下方 `+80`，16 号，居中，宽 90/110 |
| 选中态 | 只有"宽度 110 vs 90 + 白 vs 灰"，未选中项还传了 `Disabled = true`（等于关掉 hover） |

- 按钮文字 key：`KinkyDungeonCategoryFilter<filterName>`

**注意还有第二层筛选**：每个分类内部有子筛选条（`:2004-2099`），`159×36` 的横向按钮，位置 `(1139, 160 + 40*yy)`，点击是 `KDFilterFilters[CurrentFilter][k] = !…` → **组内可多选**，上限 `KDMaxFilters = 14`（`:167`）。所以是"一级单选分类 + 二级多选标签"。

筛选时读的是**模板上的 tag**，不是 item 自带：

```ts
// item/KinkyDungeonInventory.ts:983 KinkyDungeonFilterInventory
if (KDRestraint(item) && !filters.every(f => ... KDRestraint(item).shrine?.includes(f))) continue;
if (KDWeapon(item)   && !filters.every(f => ... KDWeapon(item)?.tags?.includes(f))) continue;
```

即：束缚/防具看 `shrine`，武器/消耗品看 `tags`。另有别名映射 `KDFilterTransform = { armor: 'looserestraint' }`（`:115-117`）。

筛选器的数据源是 `KDFilteredInventoryItem`——**注意它是一个"视图模型"，不是数据模型**：

```ts
// base/KDTypeDefs.ts:2928
interface KDFilteredInventoryItem {
    name: any;          // 显示名（可被变体/识别状态覆盖）
    item: item;         // 真实实例
    preview: string;    // 图标资源路径
    preview2?: string;  // 叠加图标（锁/角标）
    previewcolor?: string;
    previewcolorbg?: string;
    key?: string;       // 列表里的稳定 key
}
```

**这个分离值得抄**：列表渲染只吃 `KDFilteredInventoryItem[]`，数据层改结构不影响 UI。

---

## 4. 动作系统：每个动作是一张"函数表"

这是整套系统里最值得复用的设计。

```ts
// base/KDTypeDefs.ts:2948
interface KDInventoryActionDef {
    text?: (player, item) => string;          // 按钮文字
    label?: (player, item) => string;         // 长标签
    itemlabel?: (player, item) => string;     // 物品名后缀
    labelcolor?: (player, item) => string;
    itemlabelcolor?: (player, item) => string;
    show?: (player, item) => boolean;         // 是否出现在列表里
    valid: (player, item) => boolean;         // 是否可点（灰化）
    highlight?: (player, item) => string;
    invalidtooltip?: (player, item) => string;// 灰化原因 ← 关键
    click: (player, item) => void;
    cancel: (player, delta) => boolean;       // 正在执行时能否被打断
    icon: (player, item) => string;
    hotkey?: () => string;
    hotkeyPress?: () => string;
    doubleSize?: boolean;
    alsoShow?: string[];
    autoFilter?: (item) => boolean;           // 该动作激活时自动筛选背包
}
```

**三个值得抄的点**：

1. **`show` 和 `valid` 分开**：`show` 决定"存不存在"，`valid` 决定"能不能按"。混成一个布尔会导致"我要长期显示一个灰着的按钮"变成噩梦。
2. **`invalidtooltip`**：灰化必须能解释原因。KD 里"需要钥匙""手被绑着"都走这个字段。（不过它实际只实现了"灰"，文案覆盖不全——这是它自己的缺口。）
3. **全是函数**：同一个动作表可以直接画进背包、快捷栏、NPC 面板，不用写三份。

**第 4 个、也是最容易被忽略的一点：`click` 只发意图，不直接改状态。**

```ts
// item/KDInventoryActions.ts:507
"Use": {
    doubleClick: true, icon: () => "InventoryAction/Use",
    valid: (_p, item) => item.quantity > 0,
    click: (player, item) => KDSendInput("consumable",
        { item: item.name, quantity: 1, container: KDInventoryActionContainer(player) }),
    cancel: () => false,
}
```

`click` 里没有一句"从背包删掉 / 减数量"，只是投递一条 `KDSendInput("consumable", ...)`。**收益**：UI 层不持有状态、天然支持回放/联机/撤销；**代价**：调试时调用栈断裂（点了没反应要去看输入队列）。

同样的写法在装备上：`click: () => KDSendInput("equip", {...})`（`:117-120`）。

`autoFilter` 是个很妙的细节：当"装备"动作处于激活态时，列表**自动只显示可装备的**，不用玩家手动点筛选。

### 4.1 动作清单是"按物品类型声明的字符串数组"

```ts
// item/KinkyDungeonInventory.ts:23
let KDInventoryActionsDefault: Record<string, (item: item) => string[]> = {
    restraint: (item) => {
        let ret: string[] = [];
        ret.push("Favorite");
        if (!KDGetCurse(item)) {
            ret.push("Struggle");
            if (KinkyDungeonGetAffinity(false, "Sharp", KDRestraint(item)?.Group)) ret.push("Cut");
            ...
```

**两层结构**：第一层按 `item.type` 决定"这类物品有哪些动作候选"，第二层才是每个动作自己的 `KDInventoryActionDef`。这样新增一类物品只要加一条候选列表，不用碰 UI。

动作按钮的排布常量（`:5-6`）：`KDInventoryActionSpacing = 76`、`KDInventoryActionPerRow = 9` → 一行最多 9 个动作按钮，间距 76。

---

## 5. 界面结构：一本"书"

### 5.1 全局坐标系

- 虚拟分辨率 **2000×1000**，CSS 拉伸铺满（不等比，见之前的渲染报告）
- UI 锚点：`canvasOffsetX_ui = 500`、`canvasOffsetY_ui = 164`（`base/game/KinkyDungeonGame.ts:1949-1950`）
  → 即"左侧 500px 角色栏"的右边、往下 164px

### 5.2 书本

```ts
// magic/KinkyDungeonMagic.ts:9
let KinkyDungeonBookScale = 1.3;
```

书页底图 `MagicBookNew.png` 按 **640×520** 设计，实际绘制 ×1.3 → **832×676**：

```
// item/KinkyDungeonInventory.ts:1248
KDDraw(..., 640*KinkyDungeonBookScale, 520*KinkyDungeonBookScale, ...)
```

内层列表区（`:1255-1258`）：

```
Left   = canvasOffsetX_ui + xOffset + 70
Top    = canvasOffsetY_ui + yOffset + 90
Width  = 590*BookScale - 75     ≈ 692
Height = 450*BookScale - 50     ≈ 535
```

**左页**（详情）用 `640*BookScale/3.35 ≈ 248px` 作为横向基准（`:1294` 起一串），依次画：
1. 图标预览框 `100×100`（`:1328`）
2. 叠加小图标 `56×56`（可选，`:1342`/`:1351`）
3. 名称（`:1363`）
4. 描述文本（`:1373`）
5. 数量/状态（`:1392` 起）

### 5.4 右侧物品网格（可以直接照抄的参数）

来自 `item/KinkyDungeonInventory.ts:1678-1689`、`:1727-1733`（`PopulateList`），以及 `:2232` 的调用点。

| 项 | 值 | 出处 |
|---|---|---|
| 列表区宽 | `totalwidth + 40 = 520` | `:1727` |
| 列表区高 | `totalheight = 80*7 - 10 = 550` | `:1686` |
| 单元格 | `80 × 80`（图标模式）/ `200 × 45`（文字模式） | `:1683-1684` |
| 格内 padding | `4` | `:1687` |
| **列数** | **6**（`numRows = rowsLong = 6`） | `:1678-1681` |
| 行数（可见） | `floor(550/80) = 6` | `:1727` 的 `perPage` |
| 每页容量 | **36**（6×6） | 由上两行推出 |
| 网格原点 X | `500 + (-325) + 832 + 135 = **1142**` | `:1727` + `:2232`（传 `xOffset-200`，xOffset=-125） |
| 网格原点 Y | `(90+164) + (-94) = **160**` | `:1936`、`:7`、`:10` |

> ⚠️ 我第一版写的是"3 列 / 每页 18 / origin 1467"，**那是错的**。`numRows*3` 只出现在一段**已被注释掉的旧分页代码**里（`:1779` 附近），现行布局是 `numRows = 6`、每页 36。以本表为准。

**不是分页，是虚拟化滚动**：`PopulateList(...)` 把物品分组成"每行 6 个"的子列表，交给 `KDScrollableList` 做虚拟滚动。原先的上下翻页按钮（90×44 @ `y=724`）**整段被注释掉了**（`:1962-2001`），现在只剩：

- 右侧滚动条：`scrollbarSize = 36`（`base/game/KDScrollableList.ts:201`），上/下按钮 `36×36`（`:255-263`），位置 `(1626, 160)` 与 `(1626, 674)`
- 滚动条轨道可拖动，tab 长度按 `perPage/N` 插值（`:368-384`）；整屏拖动 = 2.5 页（`PAGES_PER_SWIPE`）
- 滚轮由外部 `KDScrollScrollableLists` 喂进来（`:123-133`）
- 平滑动画：`v += Δ·max(4, 10·‖index−v‖)`（`:163-169`）——**只有过渡，没有页码**

单格实际按钮是 `80 - padding(4) = 76×76`，图标 `scaleImage` 铺满 76，内边距 0。

### 5.5 整屏布局总表（可直接照抄）

| # | 元素 | x | y | w | h | 备注 |
|---|---|---|---|---|---|---|
| 1 | 全屏暗底 `#222222` α0.7 | 375 | 4 | 1465 | 996 | 盖住左侧角色栏以外的区域 |
| 2 | 顶部页签「物品」 | 560 | 6 | 540 | 40 | 字白/灰 |
| 3 | 顶部页签「进度」 | 1110 | 6 | 540 | 40 | — |
| 4 | 物品网格 | 1142 | 160 | 520 | 550 | 6×6，蒙版 pad 4 |
| 5 | 单格外框 | +80·col | +80·row | 80 | 80 | — |
| 6 | 单格按钮 | +0 | +0 | 76 | 76 | padding 4 |
| 7 | 数量文字 | +5 | +18 | — | — | 18px 左对齐 |
| 8 | 热键文字 | +W−4 | +7 | W·0.7 | — | 14px 右对齐 |
| 9 | 钥匙角标 | +0 | +0 | 28 | 28 | z100.2 |
| 10 | 滚动条 | 1626 | 160 | 36 | 550 | 上下箭头 36×36 |
| 11 | 分类筛选 | 1667+93·XX | 160+93·YY | 90（选中 110） | 90 | 每列 6 |
| 12 | 组内子筛 | 1139 | 160+40·yy | 159 | 36 | 多选，上限 14 |
| 13 | 搜索框 | 1335 | 788 | 350 | 54 | 占位符随分类变 |
| 14 | 详情书页 | 445 | 160 | 692 | 535 | `#161920` |
| 15 | 详情预览图 | 642 | 325 | 100 | 100 | 锁标 56×56 |
| 16 | 动作按钮 | 445+76·II | 695（+76/行） | 74 | 74 | 每行 9 |
| 17 | 取消 X | ~1765 | 43 | 74 | 74 | — |
| 18 | 快捷栏底板 | 425 | 920 | 792 | 82 | — |
| 19 | 快捷栏格子 | 430+72·i | 925 | 72 | 72 | 10 格 |
| 20 | tooltip | box.Right | box.Top | ≤350 | 动态 | α0.8 z700 |

### 5.3 侧栏子页（不是弹窗！）

点某些物品不会弹窗，而是**在书的右侧展开一个子页**，由注册表驱动：

```ts
// item/AlternateInventory.ts:1
let KDAlternateInventoryScreens: {[k:string]: (selected, xOffset, yOffset, prefix) => boolean} = {
    ConfigHotbar: (selected, xOffset, yOffset, prefix) => { ... },
    ConfigPalette: (selected, ...) => { ... },
    GenericRaw:    (selected, ...) => { ... },
};
// :122 分发
function KDRenderAlternateInventory(selected, xOffset, yOffset, prefix): boolean {
    if (selected && KDConfigHotbar) return KDAlternateInventoryScreens.ConfigHotbar(...);
    else if (selected && KDConfigRestraintColor) return ...ConfigPalette(...);
    else if (KDCurrentAlternateInventory && KDAlternateInventoryScreens[KDCurrentAlternateInventory])
        return KDAlternateInventoryScreens[KDCurrentAlternateInventory](...);
    return false;
}
```

三个子页分别是：**快捷栏绑定**、**配色选择**、**通用束缚选择**。

> **移植建议**：这是"物品详情不需要离开物品栏"的正解。用 `Record<screenId, (ctx)=>boolean>` 注册，比一串 `if (type === 'weapon')` 好维护得多。

---

## 6. 交互路径

```
点物品
  ├─ 有 alternate screen（快捷栏配置/配色/通用束缚）→ 右侧展开子页
  ├─ 有多个动作（软束缚/装备类）→ 弹上下文菜单
  └─ 只有一个动作（消耗品）→ 直接执行
```

- 入口：`KDShowInventory(container: string[])`（`base/game/KDContextMenu.ts:532`）
  **注意参数语义**：`InventoryAction = container[0]` → 它是**动作 id 列表**，不是容器 id 列表（我第一版写错了）。真正的箱内容物走 `KDInventoryActionContainer(KDPlayer()).items / .filters`
- 当前容器是全局单例：`KDUI_CurrentContainer`（`map/KDContainers.ts:4`）
- 悬停：左页实时显示详情（不是 tooltip 浮层，是**固定位置**的详情页）——这点和绝大多数游戏相反，**好处是不遮挡、不抖动**，坏处是必须移开视线

### 6.1 点击一个格子会发生什么

```ts
// item/KinkyDungeonInventory.ts:1787-1807（DrawButtonKDExTo 回调）
KinkyDungeonCurrentPageInventory = index;   // 记住选中项
itemcallback(...);                          // 触发当前物品动作
if (bdata.source == "hotkey") setTimeout(() => KDFixScrollableList(listID), 100);
```

**点格子不进上下文菜单**——选中即触发当前动作（默认动作由 `KDInventoryActionsDefault` 决定）。动作按钮单独排在详情面板下方：

| 项 | 值 | 出处 |
|---|---|---|
| 动作按钮尺寸 | `74 × 74` | `:2290` |
| 间距 | `76`（`KDInventoryActionSpacing`） | `:5` |
| 每行个数 | `9`（`KDInventoryActionPerRow`） | `:6` |
| 起点 | `XX = 445`，`YY ≈ 695` | `:2290-2292` |
| 标签 | 18 号，居中在按钮下方（`+80`） | `:2307-2309` |
| hover 说明 | 24 号 | `:2338-2341` |

### 6.2 悬停 tooltip 的尺寸算法

（`base/KinkyDungeon.ts:1498-1544`，只对 `type == "InventoryItem"` 生效）

```
W = max(20, 220, min(name.length * 12, 350))
H = max(20, 20 + (mods ? 46 : 20) + mods * 30)
x = box.Left + box.Width;   if (x + W + 10 > 2000) x = box.Left - W   // 右翻左
y = box.Top;                if (y + H + 10 > 1000) y = 1000 - H       // 下翻上
```

背景 `FillRectKD` 黑 `alpha .8`、`z=700`。

⚠️ 这里有两个真实 bug 值得记：**高度只分"有/无 mods"两档**（46/20），mods 多时正文溢出底板；**标题行取错了字段**（`:1534` 少了一层 `.Hover`）。

### 6.3 键盘：整个物品栏可以纯键盘操作

- 网格内 **WASD 四向跳转**，靠给每个格子绑 hotkey 实现：

```ts
// item/KinkyDungeonInventory.ts:4481
function KDFindHotkeyInGrid(index, currentPage, gridList, numColumns, up, down, left, right) {
    if (index == currentPage + 1 || (currentPage == gridList.length - 1 && index == 0)) return right; // 首尾环绕
    ...
}
```

  即"把方向键渲染成目标格上的快捷键标签"——**不是数字选格**，是空间导航。这个设计很省事：键位不用记，标签就画在格子上。
- 数字键 `1..0` **只属于快捷栏**（`KinkyDungeonKeySpell`），网格里没有数字选格
- 回车由动作按钮绑定，空格取消当前动作
- 列表**没有键盘翻页**（`scrollhotkeyUp/Down` 传的是空串 `:1952-1953`）

---

## 7. 快捷栏

- 结构：四个平行数组 `KinkyDungeonSpellChoices` / `ConsumableChoices` / `WeaponChoices` / `ArmorChoices`，**存的是名字字符串**
- 绘制：`base/game/KinkyDungeonHUD.ts:444 KDDrawSpellChoices`、`item/KinkyDungeonInventory.ts:3981`
- 精确参数：

| 项 | 值 |
|---|---|
| 槽位数 | **10**（`KinkyDungeonSpellChoiceCountPerPage = 10`，`magic/KinkyDungeonMagic.ts:38`） |
| 行位置 | `y = 925`（`995 - 70`） |
| 间距 / 格子 | `72` / `72×72`，内部小图 `36×36` |
| HUD 版 | `hotBarX = 862`，底板 `72*12` @ `(785, 920)` |
| 背包版 | `xshift = -432` → `hotBarX = 430`，底板 `72*11` @ `(425, 920)` |

- **状态叠加**（不是换图）：消耗品/武器/护甲用 `enabled=false` 表示已装备；缺件叠 `SpellFail` `72×72`，已装备叠 `36×36`，法术组件不足叠 `SpellFail / SpellFailPartial`
- **绑定方式**：物品栏里选中 → `ConfigHotbar` 子页 → 点槽位 → `KinkyDungeonClickSpellChoice` / `KinkyDungeonClickItemChoice`；热键是 `KinkyDungeonKeySpell[i]`（`1..0`）

**为什么用"名字"而不是 id**：快捷栏要跨存档、跨局保留，名字稳定、id 不稳定。代价是重命名/变体变更会失去绑定。

---

## 8. 结论：抄什么，别抄什么

### ✅ 直接抄（四件）

| 项 | 理由 | 成本 |
|---|---|---|
| **三层分离（模板/实例/变体）** | 让"同一物品 N 种版本"不膨胀；变体只存 key | 中，但一次做对省无数次返工 |
| **`KDInventoryActionDef` 动作表** | `show`/`valid`/`invalidtooltip` 三分离，UI 与逻辑解耦 | 低，照抄字段即可 |
| **容器抽象 `KDContainer`** | 背包/箱子/NPC 共用一套 UI 与 CRUD | 中 |
| **书本双页 + 侧栏子页** | 详情不遮挡、子功能不弹窗 | 低 |

### ⚠️ 抄之前必须改（三件）

1. **背包主键**：KD 用 `name`，同名字必覆盖。改用 `stackKey = (templateId, variantKey, 状态摘要)`。
2. **分类初始化**：只初始化 5 类导致后加的分类静默丢弃。改用"按需建桶"。
3. **变体 GC**：必须做，否则注册表无限增长。用引用计数更稳（KD 的"扫描所有可见位置"方式在联机/多容器下容易漏）。

### ❌ 别抄（三件）

1. **UI 坐标写死**：`640/3.35`、`483*BookScale/5 + 375` 这类表达式散布在 4000 行里，改一个字号要重算十处。要用布局容器/锚点。
2. **同一逻辑两份实现**：`KinkyDungeonInventoryAdd` 与 `KDInvAdd`、`KinkyDungeonInventory*` 与 `KDInvAdd*` 是两套并行 API，长期维护成本高。
3. **详情页只能看固定的左页**：不能悬浮、不能并排比较两件物品。

### 🐛 五个已确认的 UI bug（复刻时别一起抄进去）

1. **tooltip 会溢出底板**：高度公式只分"有/无 mods"两档（46/20），mods 多时正文溢出；而且标题行取错了字段（`:1534` 少一层 `.Hover`，实际恒为 undefined）；只处理右/下溢出，**贴左/上边的物品 tooltip 会跑到面板外**。
2. **筛选器选中时整列抖动 20px**：选中态宽度 `110` vs `90`（`:2179`），但 x 起点不含宽度补偿 → 点一下按钮右缘长出来 20px；未选中项还传了 `Disabled=true`，把 hover 高亮也关掉了。
3. **两套滚动状态互不同步**：`KinkyDungeonCurrentPageInventory` 存的是**物品索引**，列表内部 `index` 存的是**行索引**；滚轮滚走之后，详情面板可能还显示一件已经滚出屏幕的物品，只有"用热键点击"后才在 100ms 后修正。
4. **空背包没有任何提示**：网格空着，详情面板因 `if (!item) return false` 直接不画，**没有"背包是空的"文案**，唯一反馈是右侧分类按钮变暗。
5. **tooltip 的信息远少于详情面板**：tooltip 只有"名称 + 变量修饰符列表"（`InventoryHoverObject`），耐久/重量/描述都在左侧固定详情页里——所以**不看左边就不知道物品到底能不能用**。

---

## 9. 索引：要读哪几个文件

| 想知道 | 读这里 |
|---|---|
| 数据结构 | `base/KDTypeDefs.ts:25`（item）、`:2928`（视图模型）、`:2948`（动作定义） |
| 背包 CRUD | `item/KinkyDungeonInventory.ts:506-760` |
| 变体 | `item/KinkyDungeonInventory.ts:121-154`、`:3346`（GC） |
| 容器 | `map/KDContainers.ts:8` |
| 物品栏界面 | `item/KinkyDungeonInventory.ts:1248`（书本）、`:1642`（列表）、`:2104`（筛选） |
| 侧栏子页 | `item/AlternateInventory.ts`（全文 131 行，一次读完） |
| 快捷栏 | `base/game/KinkyDungeonHUD.ts:444` |
| 动作实现 | `item/KDInventoryActions.ts`（1472 行，按 name 找） |

---

## 10. 一页伪代码：最小可复刻版本

```ts
// 1) 模板
type Template = { id: string; name: string; type: Category; icon: string; stackable: boolean };

// 2) 变体
type Variant = { templateId: string; color: string; label?: string };
const variants = new Map<string, Variant>();   // 需要 GC

// 3) 实例
type Item = { uid: number; templateId: string; variantKey?: string; qty: number; state: Record<string, any> };

// 4) 堆叠键（关键：不要用 name）
const stackKey = (it: Item) => `${it.templateId}|${it.variantKey ?? ""}|${stateDigest(it.state)}`;

// 5) 容器
type Container = { id: string; items: Map<string, Item>; filter?: Category[] };

function addItem(c: Container, it: Item) {
  const k = stackKey(it);
  const cur = c.items.get(k);
  if (cur && templates.get(it.templateId)!.stackable) cur.qty += it.qty;
  else c.items.set(k, it);
}

// 6) 动作
type Action = {
  id: string;
  show: (it: Item) => boolean;
  valid: (it: Item) => boolean;
  whyNot?: (it: Item) => string;
  run: (it: Item) => void;
};

// 7) 视图模型（UI 只吃这个）
type Row = { key: string; icon: string; label: string; qty?: number; badge?: string };
function toRows(c: Container): Row[] { /* ... */ }
```

---

## 11. 还没验证的

- 完整 `Group` 槽位名枚举（未做全量去重统计）
- NPC 物品栏（`collection/NPCRestrain.ts`）复用了哪些、改了什么
- 联机下的物品栏同步（`KinkyDungeonMultiplayerUpdate` 未展开）
- 这套 checkout（5.5 源码）与你在跑的运行版是否有差异：`numRows`、调用处 xOffset 在两版之间可能不同，**以实际运行为准**
- 物品图标资源的命名/回退规则（找不到图时显示什么）

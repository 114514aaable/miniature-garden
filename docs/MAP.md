# 代码地图（自动生成）

> 由 `node tools/gen-map.mjs` 生成，**不要手改**。
> 目标是「修 bug 时一眼找到该看哪个文件」：每个文件一行说明 + 对外函数签名。
> 为什么这么设计，看 [areas/](areas) 与 [systems/](systems)。

## 调用链（从上到下）

```
浏览器页面 tools/client/*.js
   ↓ fetch
tools/serve.mjs（HTTP 接口、会话、快照）
   ↓ 选择启用哪些规则
game/systems/rules/index.ts（RULE_TABLE）
   ↓ evaluate
game/engine/core/src/rules/*.ts（规则处理器）
   ↓ 返回 effects
game/engine/core/src/store.ts（应用效果、推进时钟）
   ↓ snapshot
game/systems/render/*（投影成画面数据）
   ↓
浏览器画布 + HUD
```

## 核心接口速查

| 接口 | 在哪 | 作用 |
|---|---|---|
| `RuleTools` | `game/engine/core/src/event/evaluate.ts` | 宿主给规则的能力：`offsets` / `select` / `canEnter` |
| `EvaluateContext` | 同上 | 规则能看到的：`frame` / `view` / `children` / `tools` |
| `Scene` / `SceneResult` | `game/systems/scene/scene.ts` | 场景契约：`handle` / `describe` / `snapshot` / `restore` |
| `LoadedWorld` | `game/engine/core/src/pack/load.ts` | 加载结果：空间、模板、地形、群系、出生点 |
| `connectDeclarations` | `game/engine/core/src/bind.ts` | 两边各自声明 → 连接表 + 诊断 |
| `buildPassage` | `game/systems/rules/passage.ts` | 物种 × 地形 → 通行表 |

## 文件清单

### 内核 engine/core

- **`game/engine/core/src/bind.ts`**（81 行）
  「对接」：两边各自声明自己能接什么，再算谁和谁接得上。
  - `connectDeclarations(left: readonly Declaration[], right: readonly Declaration[], vocabulary?: readonly string[],) → Connection`
  - `interface Declaration`
  - `interface Connection`
- **`game/engine/core/src/entity/entity.ts`**（168 行）
  实体：世界里「一个东西」的最小记录。
  - `makeHandle(index: number, generation: number) → Handle`
  - `handleIndex(handle: Handle) → number`
  - `handleGeneration(handle: Handle) → number`
  - `interface Entity`
  - `interface EntitySlot`
  - `interface EntityTableSnapshot`
  - `type Handle`
  - `const GENERATIONS`
- **`game/engine/core/src/entity/merge.ts`**（47 行）
  合并：模板默认值 + 实例覆盖 = 这个实体此刻的完整数据。
  - `mergeDeep(base: JsonValue, override: JsonValue) → JsonValue`
  - `resolveComponents(defaults: Readonly<Record<string, JsonValue>>, overrides: Readonly<Record<string, JsonValue>>,) → Record<string, JsonValue>`
- **`game/engine/core/src/entity/place.ts`**（31 行）
  位置：内核唯一保留的组件名。
  - `placeOf(entity: Entity) → Place | null`
  - `interface Place`
  - `const PLACE`
- **`game/engine/core/src/entity/template.ts`**（193 行）
  模板：世界包里「一类东西长什么样」。
  - `interface Template`
  - `interface TemplateLink`
- **`game/engine/core/src/event/effects.ts`**（143 行）
  效果：结果里的「我要改世界」的描述（契约 §9）。
  - `collectEffects(value: JsonValue) → Effect[]`
  - `submitEffects(store: Store, effects: readonly Effect[]) → void`
  - `const MAX_EFFECTS`
- **`game/engine/core/src/event/evaluate.ts`**（192 行）
  求值器：把一棵信封树跑成结果。
  - `evaluate(envelope: Envelope, link: LinkTable, handlers: HandlerMap, view: WorldView, options: EvaluateOptions = {},) → EvaluateResult`
  - `interface ObjectRef`
  - `interface Envelope`
  - `interface Frame`
  - `interface RuleTools`
  - `interface EvaluateContext`
  - `interface Diagnostic`
  - `interface EvaluateOptions`
  - `type Handler`
  - `type HandlerMap`
  - `type EvaluateResult`
  - `const DEFAULT_MAX_DEPTH`
  - `const HARD_MAX_DEPTH`
- **`game/engine/core/src/event/registry.ts`**（194 行）
  注册表：标签 → 签名，以及加载期的「链接」。
  - `interface SkillTime`
  - `interface SkillMeta`
  - `interface Signature`
  - `interface LinkTable`
  - `type ChannelCost`
  - `type TimeMode`
  - `const CHANNELS`
  - `const MAX_SEQUENCE_TICKS`
- **`game/engine/core/src/event/schema.ts`**（209 行）
  极小类型语言：校验数据包里的参数和返回值。
  - `validate(value: unknown, schema: Schema, path = "$") → void`
  - `type Schema`
  - `const MAX_DEPTH`
  - `const MAX_ARRAY`
- **`game/engine/core/src/event/view.ts`**（158 行）
  只读视图：规则看世界的唯一通道。
  - `createWorldView(spaces: Iterable<Space>, options: ViewOptions) → WorldView`
  - `interface TerrainRule`
  - `interface SpaceView`
  - `interface EntityView`
  - `interface EntitySource`
  - `interface WorldView`
  - `interface ViewOptions`
- **`game/engine/core/src/pack/definitions.ts`**（402 行）
  世界内容的定义格式：空间、模板、实体、地形、世界。
  - `parseSpaceDef(raw: unknown, path = "$space") → SpaceDef`
  - `parseTemplateDef(raw: unknown, path = "$template") → TemplateDef`
  - `parseEntityDef(raw: unknown, path = "$entity") → EntityDef`
  - `parseTerrainDef(raw: unknown, idKey: string, path = "$terrain") → TerrainDef`
  - `parseGroupDef(raw: unknown, idKey: string, path = "$group") → GroupDef`
  - `parseBiomeDef(raw: unknown, idKey: string, path = "$biome") → BiomeDef`
  - `parseWorldDef(raw: unknown, path = "$world") → WorldDef`
  - `parseComponentDef(raw: unknown, idKey: string, path = "$component") → ComponentDef`
  - `parseSchemaValue(raw: unknown, path = "$schema") → Schema`
  - `isPassable(terrains: ReadonlyMap<number, TerrainDef>, terrain: number) → boolean`
  - `interface TerrainDef`
  - `interface SpaceDef`
  - `interface TemplateDef`
  - `interface EntityDef`
  - `interface WorldDef`
  - `interface GroupDef`
  - `interface BiomeDef`
  - `interface ComponentDef`
  - `type ConflictPolicy`
- **`game/engine/core/src/pack/graph.ts`**（134 行）
  世界结构图：把「这个包里到底有什么、谁引用谁」画出来。
  - `nodeId(kind: NodeKind, id: string | number) → string`
  - `buildGraph(merged: MergedWorld, rules: readonly string[] = []) → WorldGraph`
  - `interface GraphNode`
  - `interface WorldGraph`
  - `type NodeKind`
- **`game/engine/core/src/pack/init.ts`**（73 行）
  开局初始化：世界建好之后，按顺序执行世界包声明的 init。
  - `applyInit(store: Store, loaded: LoadedWorld) → void`
- **`game/engine/core/src/pack/load.ts`**（307 行）
  加载器：把合并后的内容池变成运行时对象。
  - `loadWorld(merged: MergedWorld, components: readonly ComponentSpec[] = [],) → LoadedWorld`
  - `interface ComponentSpec`
  - `interface LoadedEntity`
  - `interface LoadedWorld`
- **`game/engine/core/src/pack/manifest.ts`**（206 行）
  包清单（pack.json）：一个内容包的自述。
  - `parseManifest(raw: unknown) → PackManifest`
  - `isManifest(raw: JsonValue) → boolean`
  - `interface PackFiles`
  - `interface PackManifest`
  - `type PackKind`
  - `type PackScope`
  - `const PACK_ID_PATTERN`
- **`game/engine/core/src/pack/merge.ts`**（188 行）
  合并：把多个包的内容并进同一个池子。
  - `keyOf(kind: string, id: string) → string`
  - `mergePacks(contents: readonly PackContent[], options: MergeOptions = {},) → MergedWorld`
  - `interface Definition`
  - `interface PackContent`
  - `interface MergedDefinition`
  - `interface ProvenanceEntry`
  - `interface MergeWarning`
  - `interface MergeOptions`
  - `interface MergedWorld`
  - `type Patch`
- **`game/engine/core/src/pack/order.ts`**（210 行）
  加载顺序：依赖图 + 拓扑排序。
  - `orderPacks(packs: readonly PackManifest[]) → readonly PackManifest[]`
  - `satisfies(version: string, range: string) → boolean`
  - `interface PackOrderError`
- **`game/engine/core/src/rules/ai.ts`**（115 行）
  敌人 AI：只做「选择」，不做「判定」。
  - `enemyTurnHandler(params: JsonValue, context: EvaluateContext) → JsonValue`
  - `const enemyTurnSignature`
- **`game/engine/core/src/rules/aim.ts`**（91 行）
  指向：鼠标/键盘选一个格子，问「这个技能能不能落在这里」。
  - `aimHandler(params: JsonValue, context: EvaluateContext) → JsonValue`
  - `const aimSignature`
- **`game/engine/core/src/rules/attack.ts`**（85 行）
  攻击：相邻 → 扣血 → 血尽则倒。
  - `attackHandler(params: JsonValue, context: EvaluateContext) → JsonValue`
  - `const attackSignature`
- **`game/engine/core/src/rules/clock.ts`**（102 行）
  游戏时钟：引擎的 tick 和游戏里的「回合」之间的唯一换算处。
  - `roundOf(tick: number) → Round`
  - `ticksFor(rounds: number) → number`
  - `clampCost(rounds: number) → number`
  - `costOf(config: ClockConfig, verb: string, speed: number) → number`
  - `isFree(config: ClockConfig, verb: string, speed: number) → boolean`
  - `interface SpeedBonus`
  - `interface ClockConfig`
  - `type Round`
  - `const TICKS_PER_ROUND`
  - `const MAX_ACTION_COST`
  - `const DEFAULT_CLOCK`
- **`game/engine/core/src/rules/collision.ts`**（41 行）
  碰撞规则：谁能挡路。
  - `isSolid(view: WorldView, handle: number) → boolean`
  - `blockersAt(view: WorldView, space: SpaceId, cell: Cell) → readonly number[]`
  - `occupies(view: WorldView, handle: number) → readonly Cell[]`
  - `const SOLID`
- **`game/engine/core/src/rules/enemy-actions.ts`**（143 行）
  敌人的三个动作：起手、命中、走位。
  - `windupHandler(params: JsonValue, context: EvaluateContext) → JsonValue`
  - `strikeHandler(params: JsonValue, context: EvaluateContext) → JsonValue`
  - `const windupSignature`
  - `const strikeSignature`
- **`game/engine/core/src/rules/inventory.ts`**（113 行）
  物品栏规则：捡起、放下。
  - `takeHandler(params: JsonValue, context: EvaluateContext) → JsonValue`
  - `dropHandler(params: JsonValue, context: EvaluateContext) → JsonValue`
  - `const takeSignature`
  - `const dropSignature`
- **`game/engine/core/src/rules/move.ts`**（73 行）
  第一条真规则：走一格。
  - `moveHandler(params: JsonValue, context: EvaluateContext) → JsonValue`
  - `const moveSignature`
- **`game/engine/core/src/rules/pending.ts`**（91 行）
  挂起动作：现在不做，过几回合再做。
  - `castHandler(params: JsonValue, context: EvaluateContext) → JsonValue`
  - `isActive(pending: JsonValue | undefined) → boolean`
  - `const PENDING`
  - `const EMPTY_PENDING`
  - `const castSignature`
- **`game/engine/core/src/rules/rest.ts`**（60 行）
  休息：一次演练（sequence）的样板技能。
  - `restHandler(params: JsonValue, context: EvaluateContext) → JsonValue`
  - `const restSignature`
- **`game/engine/core/src/rules/rng.ts`**（75 行）
  随机数：无状态派发。
  - `hashTag(tag: string) → number`
  - `roll(seed: number, tick: number, tag: string, index = 0) → number`
  - `rollInt(seed: number, tick: number, tag: string, index: number, min: number, max: number) → number`
  - `chance(seed: number, tick: number, tag: string, index: number, probability: number) → boolean`
- **`game/engine/core/src/rules/scheduler.ts`**（122 行）
  调度器：谁该动了。
  - `interface Scheduled`
  - `interface Due`
- **`game/engine/core/src/rules/sum.ts`**（59 行）
  第一个规则：求和。
  - `validateSum(input: SumInput) → void`
  - `sum(input: SumInput) → number`
  - `sumEffect(input: SumInput, space: number) → Effect`
  - `interface SumInput`
- **`game/engine/core/src/rules/sweep.ts`**（74 行）
  横扫：打「自己周围一圈」里所有活着的目标。
  - `sweepHandler(params: JsonValue, context: EvaluateContext) → JsonValue`
  - `const sweepSignature`
- **`game/engine/core/src/rules/talk.ts`**（64 行）
  交谈：和「劈砍」一样是一条技能——有目标、有射程、能进快捷栏。
  - `talkHandler(params: JsonValue, context: EvaluateContext) → JsonValue`
  - `const talkSignature`
- **`game/engine/core/src/rules/use.ts`**（106 行）
  使用物品：把背包里的东西「用」出去。
  - `useHandler(params: JsonValue, context: EvaluateContext) → JsonValue`
  - `interface UseSpec`
  - `const USE_COMPONENT`
  - `const useSignature`
- **`game/engine/core/src/rules/wait.ts`**（28 行）
  等待：什么都不做，只让时间走。
  - `waitHandler(_params: JsonValue) → JsonValue`
  - `const waitSignature`
- **`game/engine/core/src/space.ts`**（250 行）
  空间：一个网格容器，属于数据层。
  - `nearestWhere(space: Space, from: Cell, ok: (cell: Cell) => boolean,) → Cell | null`
  - `interface Cell`
  - `interface Offset`
  - `type SpaceId`
  - `type EntityHandle`
  - `type Visitor`
  - `const AIR`
- **`game/engine/core/src/stencils.ts`**（87 行）
  偏移集（stencil）：规则层的第一个文件。
  - `rect(width: number, height: number) → Offset[]`
  - `ring(radius: number) → Offset[]`
  - `line(dx: number, dy: number, length: number) → Offset[]`
  - `const ORTHOGONAL`
  - `const DIAGONAL`
- **`game/engine/core/src/store.ts`**（445 行）
  Store：世界状态的唯一写入口。
  - `interface WorldState`
  - `interface TemplateSource`
  - `interface StoreOptions`
  - `type Effect`
- **`game/engine/core/src/time.ts`**（183 行）
  时间线：一个单调的时钟 + 它自己的记录。
  - `canonicalize(value: JsonValue) → string`
  - `hashText(text: string) → string`
  - `verifyChain(events: readonly LogEntry[]) → number`
  - `interface LogEntry`
  - `interface LogEntryInput`
  - `type Tick`
  - `type Handle`
  - `type JsonValue`
- **`game/engine/core/src/traversal/filter.ts`**（73 行）
  条件：给定一个实体的组件，判断它算不算目标。
  - `matches(condition: Condition, components: Readonly<Record<string, JsonValue>>) → boolean`
  - `componentsOf(condition: Condition, out = new Set<string>()) → Set<string>`
  - `type Condition`
- **`game/engine/core/src/traversal/offsets.ts`**（72 行）
  偏移算子：形状 → 一组相对偏移。
  - `baseOffsets(shape: BaseShape, range: number, height = range) → Offset[]`
  - `dedupe(offsets: readonly Offset[]) → Offset[]`
  - `interface Offset`
  - `type BaseShape`
- **`game/engine/core/src/traversal/resolve.ts`**（46 行）
  偏移 → 格子：落点、去重、裁剪。
  - `cellsOf(origin: Cell, offsets: readonly Offset[], bounds?: Bounds,) → Cell[]`
  - `chebyshev(a: Cell, b: Cell) → number`
  - `manhattan(a: Cell, b: Cell) → number`
  - `interface Cell`
  - `interface Bounds`
- **`game/engine/core/src/traversal/select.ts`**（61 行）
  选定核心：从一组格子里挑出「符合条件的目标」。
  - `selectTargets(view: SelectorView, cells: readonly { readonly x: number; readonly y: number }[], condition: Condition, options: SelectOptions = {},) → number[]`
  - `interface SelectorView`
  - `interface SelectOptions`
- **`game/engine/core/src/traversal/shapes.ts`**（146 行）
  命名形状与命名条件：把 base 的 traversal.json 变成可用的东西。
  - `parseTraversal(raw: JsonValue, path = "$traversal") → TraversalSpec`
  - `offsetsOf(spec: TraversalSpec, name: string) → Offset[]`
  - `conditionOf(spec: TraversalSpec, name: string) → Condition`
  - `unknownComponents(spec: TraversalSpec, known: ReadonlySet<string>) → string[]`
  - `matchesNamed(spec: TraversalSpec, name: string, components: Readonly<Record<string, JsonValue>>,) → boolean`
  - `interface ShapeSpec`
  - `interface TraversalSpec`
- **`game/engine/core/src/traversal/transform.ts`**（41 行）
  偏移 → 偏移：形状的组合就是靠这几个变换。
  - `rotate90(offsets: readonly Offset[], turns: number) → Offset[]`
  - `mirror(offsets: readonly Offset[], axis: "x" | "y" | "both" = "x") → Offset[]`
  - `translate(offsets: readonly Offset[], dx: number, dy: number) → Offset[]`
  - `keep(offsets: readonly Offset[], predicate: (offset: Offset) => boolean) → Offset[]`
- **`game/engine/core/src/worldgen/caves.ts`**（244 行）
  元胞地牢：元胞自动机（cellular automata）挖洞穴。
  - `generateCaves(options: CavesOptions) → CavesResult`
  - `interface CavesOptions`
  - `interface CavesResult`
- **`game/engine/core/src/worldgen/generate.ts`**（106 行）
  生成一片地形：种子 + 尺寸 + 场参数 + 群系 → 地形号数组。
  - `clampSize(value: number) → number`
  - `generateTerrain(options: GenerateOptions) → GenerateResult`
  - `interface FieldConfig`
  - `interface GenerateOptions`
  - `interface GenerateResult`
  - `const MAX_SIZE`
  - `const MIN_SIZE`
- **`game/engine/core/src/worldgen/noise.ts`**（112 行）
  噪声：把「种子 + 坐标」变成 0..1 的值。
  - `cellRandom(seed: number, x: number, y: number) → number`
  - `valueNoise(seed: number, x: number, y: number, scale: number) → number`
  - `fbm(seed: number, x: number, y: number, options: FbmOptions) → number`
  - `ridged(seed: number, x: number, y: number, options: FbmOptions) → number`
  - `noiseOf(kind: NoiseKind, seed: number, x: number, y: number, scale: number, octaves = 4) → number`
  - `interface FbmOptions`
  - `type NoiseKind`
  - `const NOISE_KINDS`
- **`game/engine/core/src/worldgen/pipeline.ts`**（148 行）
  生成流水线：把生成算法拆成「一步一个算子」，串起来跑。
  - `createSandbox(seed: number, width: number, height: number, fill: number) → Sandbox`
  - `runPipeline(sandbox: Sandbox, steps: readonly Step[], deps: PipelineDeps,) → Sandbox`
  - `interface Sandbox`
  - `interface PipelineDeps`
  - `type Step`
  - `const CAVE_LAYER`
- **`game/engine/core/src/worldgen/select.ts`**（74 行）
  选：把「若干场」翻译成「群系」，再把群系翻译成「地形」。
  - `matchesRange(range: BiomeRange, sample: Sample) → boolean`
  - `pickBiome(biomes: readonly Biome[], sample: Sample) → Biome | null`
  - `terrainFor(biome: Biome, height: number, levels: TerrainLevels = {}) → string | null`
  - `interface BiomeRange`
  - `interface Biome`
  - `interface TerrainLevels`
  - `type Sample`

### 系统 game/systems

- **`game/systems/camera/camera.ts`**（89 行）
  相机：把「看哪儿」从渲染里拆出来。
  - `cellsInView(viewport: Viewport, tile: number)`
  - `cameraFor(target: Vec, viewport: Viewport, map: MapSize, tile: number, mode: CameraMode = "player",) → Vec`
  - `worldToScreen(cell: Vec, camera: Vec, tile: number) → Vec`
  - `screenToWorld(point: Vec, camera: Vec, tile: number) → Vec`
  - `interface Vec`
  - `interface Viewport`
  - `interface MapSize`
  - `type CameraMode`
- **`game/systems/config/config.ts`**（143 行）
  界面配置：所有「可能想调」的东西集中在这里。
  - `loadConfig(storage: Pick<Storage, "getItem"> = localStorage) → Config`
  - `saveConfig(config: Config, storage: Pick<Storage, "setItem"> = localStorage) → void`
  - `withConfig(config: Config, patch: Partial<Config>) → Config`
  - `withBinding(config: Config, code: string, command: string | null) → Config`
  - `clampCell(value: number) → number`
  - `normalizeAction(value: unknown, fallback: ClickAction) → ClickAction`
  - `interface ClickAction`
  - `interface ClickPolicy`
  - `interface Config`
  - `const DEFAULT_CONFIG`
- **`game/systems/i18n/i18n.ts`**（55 行）
  i18n：界面文字走 key，不写死在代码里。
  - `createTranslator(locale: string, messages: Messages) → Translator`
  - `mergeMessages(...layers: readonly Messages[]) → Messages`
  - `interface Translator`
  - `type Messages`
  - `const MISSING`
- **`game/systems/input/bindings.ts`**（79 行）
  按键映射：`event.code` → 命令字符串。
  - `parseCommand(command: string) → ParsedCommand`
  - `commandFor(bindings: Bindings, code: string) → string | undefined`
  - `bind(bindings: Bindings, code: string, command: string) → Bindings`
  - `unbind(bindings: Bindings, code: string) → Bindings`
  - `boundTo(bindings: Bindings, command: string) → string[]`
  - `resolveBindings(user: Bindings | null | undefined, defaults: Bindings = DEFAULT_BINDINGS) → Bindings`
  - `interface ParsedCommand`
  - `type Bindings`
  - `const DEFAULT_BINDINGS`
- **`game/systems/intel/facts.ts`**（156 行）
  情报：关于一个实体或一个格子，我们「知道什么」。
  - `healthFacts(raw: JsonValue | undefined) → HealthFacts | undefined`
  - `intentFacts(raw: JsonValue | undefined, now: number) → IntentFacts | undefined`
  - `pendingFacts(raw: JsonValue | undefined, now: number) → PendingFacts | undefined`
  - `entityFacts(input: EntityInput, context: FactsContext) → EntityFacts`
  - `interface HealthFacts`
  - `interface IntentFacts`
  - `interface PendingFacts`
  - `interface EntityFacts`
  - `interface TerrainFacts`
  - `interface CellFacts`
  - `interface EntityInput`
  - `interface FactsContext`
- **`game/systems/intel/overlay.ts`**（112 行）
  情报的「常驻」呈现：画在世界坐标上。
  - `intentAlpha(inTicks: number, totalTicks: number) → number`
  - `intentCells(entity: OverlayEntity) → Array<`
  - `drawOverlay(context: CanvasRenderingContext2D, options: OverlayOptions) → void`
  - `interface OverlayEntity`
  - `interface OverlayOptions`
- **`game/systems/log/devlog.ts`**（94 行）
  开发日志：给「排查问题的人」看，不是给玩家看。
  - `compact(value: JsonValue, max = 160) → string`
  - `formatLine(line: DevLogLine) → string`
  - `interface DevLogLine`
  - `interface DevLogOptions`
- **`game/systems/render/atlas.ts`**（122 行）
  图集：读 TexturePacker 的 JSON hash 格式。
  - `parseAtlas(raw: unknown, path = "$atlas") → Atlas`
  - `frameOf(atlas: Atlas, name: string) → AtlasFrame | undefined`
  - `interface AtlasFrame`
  - `interface Atlas`
- **`game/systems/render/browser.ts`**（315 行）
  浏览器侧的渲染器：拿快照、自己跑 60fps、自己插值。
  - `attach(canvas: HTMLCanvasElement, options: ClientOptions) → Renderer`
  - `interface ClientState`
  - `interface ClientOptions`
  - `interface Renderer`
- **`game/systems/render/contract.ts`**（81 行）
  渲染契约：渲染器在启动时声明「我需要什么」。
  - `validateContract(contract: RenderContract) → void`
  - `interface ComponentNeed`
  - `interface RenderNeeds`
  - `interface RenderContract`
  - `type EntityField`
  - `const MAX_COMPONENTS`
  - `const MAX_UI`
- **`game/systems/render/draw.ts`**（240 行）
  绘制指令：把快照翻译成「画什么」。
  - `buildFrame(snapshot: FrameSnapshot, spec: FrameSpec) → readonly DrawCommand[]`
  - `frameNameOf(sprite: { frame?: unknown; frames?: unknown; fps?: unknown } | undefined, nowMs: number,) → string | undefined`
  - `interface TerrainStyle`
  - `interface EntityStyle`
  - `interface RenderStyle`
  - `interface FrameSpec`
  - `type DrawCommand`
  - `const DEFAULT_STYLE`
- **`game/systems/render/project.ts`**（142 行）
  投影：按契约从世界生成一张「照片」。
  - `createProjector(contract: RenderContract, templates: TemplateRegistry) → Projector`
  - `interface RenderSource`
  - `interface SnapshotEntity`
  - `interface FrameSnapshot`
  - `interface Projector`
- **`game/systems/render/visual.ts`**（86 行）
  视觉投影：渲染位置永远从逻辑位置重算。
  - `clampDelta(now: number, last: number, previous: number) → number`
  - `distance(a: Vec2, b: Vec2) → number`
  - `stepVisual(visual: Vec2 | null, target: Vec2, deltaMs: number, config: VisualConfig = DEFAULT_VISUAL,) → Vec2`
  - `interface Vec2`
  - `interface VisualConfig`
  - `const DEFAULT_VISUAL`
- **`game/systems/rules/aliases.ts`**（29 行）
  旧 tag 的别名表。
  - `resolveTag(tag: string) → string`
  - `resolveTags(tags: readonly string[]) → string[]`
  - `const LEGACY_TAGS`
- **`game/systems/rules/base.ts`**（40 行）
  base 包的规则：劈砍、蓄力劈砍。
  - `interface RuleEntry`
  - `const BASE_RULES`
- **`game/systems/rules/index.ts`**（38 行）
  规则清单：一条规则 = 签名 + 处理器。
  - `const RULE_TABLE`
- **`game/systems/rules/passage.ts`**（106 行）
  通行：物种 × 地形 的对接结果。
  - `buildPassage(terrains: readonly PassageTerrain[], templates: readonly PassageTemplate[]) → Passage`
  - `interface PassageTerrain`
  - `interface PassageTemplate`
  - `interface Passage`
  - `const SURFACES`
- **`game/systems/scene/dialog.ts`**（148 行）
  对话框场景。
  - `parseDialogScript(raw: JsonValue) → DialogScript`
  - `createDialogScene(script: DialogScript) → Scene`
  - `interface DialogChoice`
  - `interface DialogNode`
  - `interface DialogScript`
  - `interface DialogView`
- **`game/systems/scene/scene.ts`**（171 行）
  场景：世界现在处于哪种「玩法状态」。
  - `sceneFromComponent(value: JsonValue | undefined) → SceneLayer`
  - `interface SceneResult`
  - `interface SceneContext`
  - `interface Scene`
  - `interface SceneLayer`
- **`game/systems/tick/phases.ts`**（35 行）
  每 tick 的阶段表。
  - `runPhases(phases: readonly Phase[], tick: number) → void`
  - `phaseNames(phases: readonly Phase[]) → string[]`
  - `interface Phase`
- **`game/systems/ui/dom.ts`**（67 行）
  把 spec 变成真实 DOM。这一层不判断任何布局，只做搬运。
  - `render(node: UiNode) → HTMLElement`
  - `mount(container: HTMLElement, node: UiNode) → void`
- **`game/systems/ui/flex.ts`**（57 行）
  尺寸策略：把「谁可以让步」压缩成 5 档，翻译成 flex。
  - `flexStyle(policy: SizePolicy = DEFAULT_POLICY, weight = 1) → string`
  - `grows(policy: SizePolicy) → boolean`
  - `shrinks(policy: SizePolicy) → boolean`
  - `type SizePolicy`
  - `const DEFAULT_POLICY`
- **`game/systems/ui/minimap.ts`**（67 行）
  小地图：把一整个空间压成一张缩略图。
  - `drawMinimap(context: CanvasRenderingContext2D, options: MinimapOptions) → void`
  - `minimapSize(space: MinimapSpace, cell = 4)`
  - `interface MinimapSpace`
  - `interface MinimapMark`
  - `interface MinimapOptions`
  - `const DEFAULT_TERRAIN_COLORS`
- **`game/systems/ui/spec.ts`**（307 行）
  UI 描述：一组纯数据，能单测，不碰 DOM。
  - `boxStyle(options: BoxOptions = {}, direction: "row" | "column" = "row") → Record<string, string>`
  - `row(options: BoxOptions = {}, ...children: readonly UiNode[]) → UiNode`
  - `col(options: BoxOptions = {}, ...children: readonly UiNode[]) → UiNode`
  - `panel(options: BoxOptions = {}, ...children: readonly UiNode[]) → UiNode`
  - `text(value: string, options: BoxOptions = {}) → UiNode`
  - `button(label: string, onClick: () => void, options: BoxOptions = {}) → UiNode`
  - `modal(content: UiNode, options: { readonly title?: string } = {}) → UiNode`
  - `bar(value: number, max: number, options: BarOptions = {}) → UiNode`
  - `canvasNode(width: number, height: number, draw: (context: CanvasRenderingContext2D, width: number, height: number) => void,) → UiNode`
  - `toggle(label: string, checked: boolean, onChange: (next: boolean) => void) → UiNode`
  - `input(value: string, onInput: (next: string) => void, options: BoxOptions & { readonly type?: "text" | "number" } = {},) → UiNode`
  - `field(label: string, control: UiNode, options: BoxOptions = {}) → UiNode`
  - `withEvents(node: UiNode, on: Readonly<Record<string, (event: Event) => void>>, attrs: Readonly<Record<string, string>> = {},) → UiNode`
  - `grid(options: BoxOptions & { readonly columns: number; readonly cell?: number }, ...children: readonly UiNode[]) → UiNode`
  - `interface UiNode`
  - `interface BoxOptions`
  - `interface BarOptions`
  - `type Align`
  - `type Justify`

### 页面脚本 tools/client

- **`tools/client/game.js`**（1060 行）
  import { api } from '/client/shared.js';
- **`tools/client/hud/aim.js`**（62 行）
  瞄准高亮：记住「鼠标在哪、当前选了什么技能」，随时可以重算。
  - `createAimTracker({ request, apply, fallbackTag = 'base.attack' })`
- **`tools/client/hud/minimap.js`**（45 行）
  右上区域：小地图。
  - `renderMinimap(state)`
- **`tools/client/hud/quickbar.js`**（210 行）
  右下角区域：点击策略。
  - `actionsFor(ctx, key)`
  - `actionLabel(ctx, action)`
  - `renderQuickbar(ctx)`
  - `togglePolicy(ctx)`
  - `closePolicy()`
  - `cycleAction(ctx, key)`
  - `const CLICK_ROWS`
  - `const BUILTIN_LABEL`
- **`tools/client/hud/status.js`**（32 行）
  左下区域：状态（血量条 + 计数 + 可否行动）。
  - `renderStatus(state)`
- **`tools/client/launcher.js`**（448 行）
  import { modal, col, row, text, button, input, field } from '/web/game/systems/ui/spec.js';
- **`tools/client/shared.js`**（35 行）
  页面共用：错误提示 + API 调用。
  - `api(path, body)`

### 工具 tools

- **`tools/build-web.mjs`**（87 行）
  把 TS 转成浏览器能跑的 JS（构建产物放 web/）。
- **`tools/check-client.mjs`**（90 行）
  页面脚本的「有没有调用不存在的函数」检查。
- **`tools/check-data.mjs`**（147 行）
  数据体检：数据化之后，规则要的字段，包里到底有没有。
- **`tools/check-locale.mjs`**（99 行）
  语言包体检：包里每个 id 都应该有名字。
- **`tools/gen-docs.mjs`**（188 行）
  从代码与语言包生成模块文档（docs/modules/）。
- **`tools/gen-file-docs.mjs`**（201 行）
  每个源文件生成一篇 md（docs/files/...）。
- **`tools/gen-map.mjs`**（176 行）
  生成「代码地图」：docs/MAP.md。
- **`tools/gen-pack-graph.mjs`**（178 行）
  世界包的引用图（Mermaid）。
- **`tools/gen-tree.mjs`**（188 行）
  扫源码里的 import，画一张引用树。
- **`tools/gen-world.mjs`**（136 行）
  生成一张地图（MVP：噪声 → 群系 → 地形号）。
- **`tools/import-csv.mjs`**（144 行）
  CSV → 模板 JSON（宿主侧工具）。
  - `csvToTemplates(text)`
- **`tools/pack-reader.mjs`**（148 行）
  读包工具（宿主侧）：把文件夹变成 PackContent。
  - `readPack(dir)`
- **`tools/pages.mjs`**（328 行）
  两个页面：启动器和游戏。
  - `const LAUNCHER_PAGE`
  - `const GAME_PAGE`
  - `const PAGES`
- **`tools/play.mjs`**（88 行）
  从文件夹加载一个世界并画出来（宿主侧）。
- **`tools/serve.mjs`**（1802 行）
  调试台 / 启动器（宿主侧）。
- **`tools/typecheck.mjs`**（82 行）
  离线类型检查。

### 其它

- **`game/engine/core/types/node-shim.d.ts`**（48 行）
  临时的 node 类型声明。
  - `test(name: string, fn: () => void | Promise<void>) → void; } /** 演示脚本会用到。装了 @types/node 后删掉。 */ declare const process:`
  - `createInterface(options: { input: unknown; output: unknown }) → Interface; } declare module "node:assert/strict"`
  - `interface Interface`

## 找东西的几条路

| 想找 | 去哪 |
|---|---|
| 某个规则怎么算 | `game/engine/core/src/rules/` |
| 某个 HTTP 接口 | `tools/serve.mjs`（搜 `request.url`） |
| 存档写了什么 | `saveGame` / `loadGame`（`tools/serve.mjs`） |
| 画面怎么画 | `game/systems/render/` |
| HUD 某个块 | `tools/client/hud/` |
| 数据格式 | `game/engine/core/src/pack/definitions.ts` |
| 文档 | [README.md](README.md) 的路由表 |

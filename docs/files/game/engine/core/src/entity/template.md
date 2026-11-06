# `game/engine/core/src/entity/template.ts`

## 内容

模板：世界包里「一类东西长什么样」。
借用新版 Minecraft 的思路（数据组件 + 默认值），但砍掉自由 NBT 树：
每个组件都有 schema，打错字段当场报错。
Template { id: "npc_guard", components: { "core.health": { max: 20 } } }
运行时实例只存「和模板不一样」的部分（见 merge.ts）：
Entity { template: "npc_guard", overrides: { "core.health": { hp: 7 } } }
于是 max 不写进存档，只写 hp——这就是「默认值不存」。
组件名用点号命名空间（core.health），和 Event 的标签保持同一种风格，
免得项目里出现两套命名习惯。

行数：193

## 接口

### 接口 `Template`

```ts
interface Template {
  readonly id: string;
  readonly extends?: string;
  readonly components: Readonly<Record<string, JsonValue>>;
}
```

### 接口 `TemplateLink`

```ts
interface TemplateLink {
  readonly hash: string;
}
```

## 依赖

- [`game/engine/core/src/entity/merge.ts`](game/engine/core/src/entity/merge.md)
- [`game/engine/core/src/event/schema.ts`](game/engine/core/src/event/schema.md)
- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)

## 被引用

- [`game/engine/core/src/event/view.ts`](game/engine/core/src/event/view.md)
- [`game/engine/core/src/pack/load.ts`](game/engine/core/src/pack/load.md)
- [`game/systems/render/project.ts`](game/systems/render/project.md)

# 内容树（content tree）

> 定位：世界内容的最小单位不是「一个巨包」，而是**节点**。
> 目录树负责组织，流程图负责走向，**层**负责扩展。
> 第一版只实现一层 `core.scene`，但骨架按「任意层」设计。

---

## 1 三个概念

```
catalog    目录树：有哪些节点、父子关系
node       节点：一个可独立校验的内容包（事件/场景/章节）
layer      层：节点里的一块数据（世界/故事/事件/战斗/对话…）
```

```
树  组织内容
图  决定流程（next / branches）
层  决定扩展（mod 加自己的数据）
```

**不要用目录树表达流程。** 树只回答「有哪些」，图回答「怎么走」。

---

## 2 目录

```
content/
├─ catalog.json                 目录树（只读索引）
├─ layers.json                  层注册表（已知层 + schema）
└─ nodes/
   └─ node.salt/
      ├─ manifest.json          节点元数据 + 层文件表
      ├─ scene.json             第一层：core.scene
      └─ assets.json            语义资产引用（可选）
```

- 一个节点一个目录。
- 节点不可变；修改 = 新 revision。
- 大文件懒加载：catalog 先读，层文件按需读。

---

## 3 catalog.json

```json
{
  "version": 1,
  "root": "node.salt",
  "nodes": [
    {
      "id": "node.salt",
      "parent": null,
      "kind": "core.scene",
      "title": "盐港码头",
      "entry": "nodes/node.salt/manifest.json",
      "children": []
    }
  ]
}
```

| 字段 | 说明 |
|---|---|
| `id` | 全局唯一，点分命名 |
| `parent` | 树上的父节点；根为 null |
| `kind` | 节点类型（可扩展，`core.*` / `mod.*`） |
| `entry` | manifest 路径 |
| `children` | 子节点 id |

**树只用于组织/筛选/编辑器展示，不参与运行时跳转。**

---

## 4 manifest.json

```json
{
  "protocol": 1,
  "id": "node.salt",
  "version": "1.0.0",
  "revision": 1,
  "kind": "core.scene",
  "title": "盐港码头",
  "layers": {
    "core.scene": "scene.json"
  },
  "requires": {
    "flags": [],
    "items": []
  },
  "provides": {
    "flags": []
  },
  "assets": ["entity.npc_salt"],
  "license": "CC-BY-SA-4.0",
  "source": {
    "provider": "human",
    "createdAt": "2026-11-19T00:00:00Z"
  }
}
```

- `layers` 是「层 id → 文件」。
- 第一版只认 `core.scene`；其它层保留、校验、但不执行。
- `requires` / `provides` 先只做包级条件。

---

## 5 层注册表（扩展的关键）

`layers.json`：

```json
{
  "version": 1,
  "layers": [
    {
      "id": "core.scene",
      "version": 1,
      "status": "active",
      "description": "场景/对话/选项/效果"
    },
    {
      "id": "core.world",
      "version": 1,
      "status": "reserved"
    },
    {
      "id": "core.combat",
      "version": 1,
      "status": "reserved"
    }
  ]
}
```

规则：

```
已知层       按 schema 校验
保留层       保留数据，不执行，不报错
未知层       保留数据 + 诊断警告（前向兼容）
mod 层       必须注册；没注册就只存不跑
```

**扩展 = 往注册表加一层 + 提供 schema + 提供消费方，不改节点格式。**

---

## 6 第一层：core.scene

第一版只做这一层，把现有对话脚本变成节点数据。

```json
{
  "version": 1,
  "start": "hi",
  "speaker": "npc_salt",
  "nodes": {
    "hi": {
      "text": "港口最近不太平。你要买盐，还是想问路？",
      "goal": "判断来意",
      "choices": [
        {
          "id": "buy",
          "text": "买盐",
          "next": "buy",
          "effects": []
        },
        {
          "id": "leave",
          "text": "没事",
          "end": true
        }
      ]
    },
    "buy": {
      "text": "一袋盐，三枚铜板。",
      "choices": [{ "id": "accept", "text": "来一袋", "end": true }]
    }
  }
}
```

和现有 `dialogs/salt_01.json` 的差异：

```
外面多一层 manifest / layers
节点里多 goal / effects / requires（逐步）
```

**运行时先把 core.scene 编译成现有 DialogScript，再接 DialogueSession。**

---

## 7 流程

```
节点内      next / end / branches（第一版 next + end）
节点间      catalog 不参与；由层里的 flow 字段决定
```

以后加：

```json
"flow": {
  "exit": "node.ambush",
  "branches": [
    { "when": "flag.ambush_done", "to": "node.escape" }
  ]
}
```

**图存在层里，不存在目录结构里。**

---

## 8 加载与校验

```
1  读 catalog + layers
2  读 manifest（只读元数据）
3  检查 requires（包级）
4  按 layers 懒加载需要的层
5  校验：schema、引用、图、effect、资产
6  编译成运行时对象（DialogScript 等）
7  运行状态另存，不写回节点
```

失败：

```
节点级失败    整节点跳过 + 诊断，不启动半截
层级失败      该层禁用，节点可降级
未知层        保留 + 警告
```

---

## 9 覆盖 / 分层叙事（以后）

```
基础层     canon 节点
覆盖层     mod 节点：只写差异
合并      按 layer + key；replace / disable 先做，append 以后
优先级    深度 + 加载顺序
```

**不要复制整节点。** 覆盖层只描述差异。

---

## 10 和现有代码的映射

| 现有 | 内容树里的位置 |
|---|---|
| `worlds/<pack>/dialogs/*.json` | `core.scene` 层的输入 |
| `parseDialogScript` | 层编译器（先兼容旧格式） |
| `DialogueSession` | 运行状态，不写回节点 |
| `assets.tree.json` | 包里的 `assets[]` 引用它 |
| `requires`（E2b） | manifest 包级条件先做 |

---

## 11 第一版范围

```
做：catalog + manifest + layers 注册表 + core.scene + 包级 requires
不做：覆盖层、combat/world 层、节点间 flow、编辑器、懒加载缓存
```

**先让一个节点跑起来，再扩层。**

---

## 12 待拍板

```
Q1 第一层就叫 core.scene，可以吗？
Q2 未知层：保留 + 警告，还是直接拒绝？
    我建议保留 + 警告（前向兼容）
Q3 节点不可变 + revision，确认吗？
Q4 旧 dialogs/*.json：保留兼容，还是迁移成节点后删除？
    我建议先双轨，等 core.scene 稳定再迁移
```

# 模块：宿主与工具（host）

> 改这里如果：**你要加一个接口、改启动流程、改构建**。
> 玩法和画面都不在这里，这里只负责「把世界跑起来并递给浏览器」。

## 关键文件

| 文件 | 职责 |
|---|---|
| `tools/serve.mjs` | HTTP 服务 + 会话 + 所有 `/api/*`；页面字符串在内存里 |
| `tools/pages.mjs` | 启动器页与游戏页的 HTML/JS/CSS（模板字符串） |
| `tools/play.mjs` | 命令行跑一遍世界，打印地形与实体（最快的验证） |
| `tools/pack-reader.mjs` | 读包目录 → 定义列表 |
| `tools/build-web.mjs` | TS → `web/`（浏览器端），产出 ESM |
| `tools/typecheck.mjs` | 全量类型检查（无 tsc 配置依赖） |
| `tools/gen-docs.mjs` | 生成 `docs/modules/` |

## 会话是什么

```
session = {
  store, loaded, scheduler, playerHandle, seed,
  world, dead, devlog, projector, packs, ...
}
```

**一次只有一个会话**（单机）。重开就是重建一个。

## 两个必须记住的事

**1. 页面 HTML 在进程内存里**

`pages.mjs` 是 `import` 进来的字符串。**改了它，必须重启服务**，否则浏览器拿到的还是旧页面。

**2. 生成的页面脚本要单独验语法**

```bash
node --check tools/pages.mjs          # 这只是外层
# 还要把服务端返回的 <script type="module"> 抠出来再 check
```

## 主要接口

```
GET  /                     启动器
GET  /game?world=&seed=    游戏页
GET  /api/worlds           列出世界（总是列表，不受会话影响）
GET  /api/state            当前快照（没有会话就返回 launcher:true）
POST /api/start {id,seed,off}
POST /api/act {dir}
POST /api/skill {tag,x,y,item?}
POST /api/aim {tag,x,y}    能不能落在这一格
POST /api/inspect {x,y}    这一格有什么
GET  /api/selection?world= 这个世界关掉了哪些规则（外置接口）
POST /api/selection {world,off}  写入选择，AI 与界面共用
GET  /api/inventory        背包
POST /api/save {slot?}     默认 quick
POST /api/load {slot?}
```

## 常见坑

- **端口**：默认 8787；测试用 `PORT=8788`。你的 bat 起的是 8787。
- **`api()` 的 GET/POST**：不传 body 才是 GET。
- **500 多半是参数 NaN**（比如坐标没取到），看服务端 stderr。
- 构建产物在 `web/`，**不进版本库**。

## 验证

```bash
node tools/play.mjs game/worlds/official.base game/worlds/official.normal
node tools/serve.mjs
node tools/typecheck.mjs && node --test --test-isolation=none
```

## 相关（先别读，用到再看）

| 文档 | 什么时候需要 |
|---|---|
| [ui.md](ui.md) | 你要改页面内容 |
| [render.md](render.md) | 你要改构建产物或渲染入口 |
| [../systems/save.md](../systems/save.md) | 你要改存档/读档 |
| [../areas/engine-core.md](engine-core.md) | 你要改会话里装了什么 |

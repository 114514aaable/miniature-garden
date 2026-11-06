# `tools/import-csv.mjs`

## 内容

CSV → 模板 JSON（宿主侧工具）。
为什么是 CSV 而不是 XML：
内核只认 JSON。多一种格式就多一套解析、报错、校验和两份真相。
所以「快速造物品」这件事放在工具里做：读表格，吐 JSON。
用法：
node tools/import-csv.mjs items.csv             # 打到 stdout
node tools/import-csv.mjs items.csv -o out.json # 写文件
表头约定：
id        必填，模板 id
extends   可选，父模板 id（继承）
其余列    形如 core.item.stack（组件名.字段名）
例：
id,extends,core.item.stack,core.item.weight,core.item.use
lamp,item_base,1,1,light
rope,item_base,1,3,

行数：144

## 接口

### 函数 `csvToTemplates`

```ts
function csvToTemplates(text)
```

## 依赖

（无）

## 被引用

（没有别的文件引用它）

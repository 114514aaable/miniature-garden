# 物品

`core.item` — 可拾取、可堆叠、可使用的标记。

## Schema
```json
{
  "t": "object",
  "fields": {
    "stack": {
      "t": "int"
    },
    "weight": {
      "t": "int"
    },
    "use": {
      "t": "str"
    }
  },
  "optional": [
    "use"
  ]
}
```

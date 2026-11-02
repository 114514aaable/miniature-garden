# 物品栏

`core.container` — 格位与其中的物品句柄。

## Schema
```json
{
  "t": "object",
  "fields": {
    "slots": {
      "t": "int"
    },
    "items": {
      "t": "array",
      "of": {
        "t": "int"
      }
    }
  }
}
```

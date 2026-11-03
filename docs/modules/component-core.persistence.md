# 存在感

`core.persistence` — 锚定 / 普通 / 短暂：决定离得远时要不要继续留在世界里。

## Schema
```json
{
  "t": "object",
  "fields": {
    "level": {
      "t": "enum",
      "values": [
        "anchored",
        "normal",
        "ephemeral"
      ]
    },
    "ttl": {
      "t": "int"
    }
  },
  "optional": [
    "ttl"
  ]
}
```

# 智能

`core.ai` — 有它就会被调度器接管，每回合自行行动。

## Schema
```json
{
  "t": "object",
  "fields": {
    "mode": {
      "t": "enum",
      "values": [
        "idle",
        "chase"
      ]
    }
  }
}
```

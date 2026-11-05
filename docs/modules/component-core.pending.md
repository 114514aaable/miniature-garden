# 挂起

`core.pending` — 过几回合才结算的动作（蓄力、延迟陷阱）。

## Schema
```json
{
  "t": "object",
  "fields": {
    "tag": {
      "t": "str"
    },
    "params": {
      "t": "any"
    },
    "resolveAt": {
      "t": "int"
    },
    "startedAt": {
      "t": "int"
    },
    "totalTicks": {
      "t": "int"
    }
  },
  "optional": [
    "startedAt",
    "totalTicks"
  ]
}
```

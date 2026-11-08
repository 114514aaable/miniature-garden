# 休息配置

`core.rest` — 休息几回合、每次回多少血；模板可以覆盖。

## Schema
```json
{
  "t": "object",
  "fields": {
    "ticks": {
      "t": "int"
    },
    "heal": {
      "t": "int"
    }
  },
  "optional": [
    "ticks",
    "heal"
  ]
}
```

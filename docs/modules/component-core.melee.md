# 近战

`core.melee` — 伤害与起手回合数：写在模板里，规则读它。

## Schema
```json
{
  "t": "object",
  "fields": {
    "damage": {
      "t": "int"
    },
    "windup": {
      "t": "int"
    }
  },
  "optional": [
    "windup"
  ]
}
```

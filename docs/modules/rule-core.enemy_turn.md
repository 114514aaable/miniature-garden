# 敌人思考

`core.enemy_turn` — 敌人每回合选一个动作：靠近、起手、或原地不动。

## 参数
```json
{
  "t": "object",
  "fields": {
    "enemy": {
      "t": "int"
    },
    "target": {
      "t": "int"
    }
  }
}
```

## 返回
```json
{
  "t": "any"
}
```

产出效果：否

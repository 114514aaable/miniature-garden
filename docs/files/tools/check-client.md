# `tools/check-client.mjs`

## 内容

页面脚本的「有没有调用不存在的函数」检查。
起因：替换一大段代码时，连带删掉了中间的几个函数定义；
node --check 只查语法，查不出「调用了没定义的东西」。
做法：先剥掉字符串 / 模板字符串 / 注释，再扫 name( 形式，
排除属性访问、导入、局部声明和内置全局。
这是个启发式检查，不完美，但能抓住「整段函数被删」这种事故。
用法：node tools/check-client.mjs

行数：230

## 接口

### 常量 `FILES`

```ts
const FILES
```

### 函数 `scanSource`

```ts
function scanSource(source)
```

### 函数 `stripNonCode`

```ts
function stripNonCode(source)
```

## 依赖

（无）

## 被引用

- [`tools/check-client.test.mjs`](tools/check-client.test.md)

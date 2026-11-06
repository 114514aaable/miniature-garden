# `tools/build-web.mjs`

## 内容

把 TS 转成浏览器能跑的 JS（构建产物放 web/）。
为什么不引打包器：我们只要「把 .ts 变成 .js 并改一下 import 后缀」。
TypeScript 本身就能做（transpileModule），而且已经为了类型检查找到它了。
浏览器原生支持 ES 模块，目录结构保持不变即可。
用法：
node tools/build-web.mjs
TSC_PATH=/path/to/typescript.js node tools/build-web.mjs

行数：87

## 接口

（没有导出）
## 依赖

（无）

## 被引用

（没有别的文件引用它）

# `tools/typecheck.mjs`

## 内容

离线类型检查。
Node 只会剥离类型、不会检查类型，所以需要单独跑一次 tsc。
用法：
node tools/typecheck.mjs                     # 用本地安装的 typescript
TSC_PATH=/path/to/typescript.js node tools/typecheck.mjs   # 用现成的编译器
没装 typescript 也没给 TSC_PATH 时，会打印安装说明并退出。

行数：82

## 接口

（没有导出）
## 依赖

（无）

## 被引用

（没有别的文件引用它）

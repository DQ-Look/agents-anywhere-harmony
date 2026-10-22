# Agents Anywhere HarmonyOS — Agent 工作指南

本仓库是 Agents Anywhere 的鸿蒙（HarmonyOS / ArkTS）客户端，从 monorepo 的 `feat/hmo/client-explore` 分支（commit `1f5f27a1`）拆分而来，使用全新历史。面向人的说明见 [README.md](README.md)。

## 工程信息

- bundle `com.agentsanywhere.app`，compatibleSdkVersion `5.0.0(12)`（API 12），targetSdkVersion `26.0.0`
- 多模块 hvigor 工程：`common` / `network`（HAR）+ `session` / `terminal` / `files`（HSP）+ `entry`（HAP）
- `useNormalizedOHMUrl: true`：跨模块 import 使用裸模块名（如 `import { getColors } from 'common'`），模块内使用相对路径
- 依赖方向严格单向：`common ← network ← session/terminal/files ← entry`；被 ≥2 个域共享的组件留在 `entry`，跨模块共享资源放 `common`
- 运行时零三方 npm 依赖，**不引入新 npm 依赖**；网络用 `@kit.NetworkKit` 原生 http/webSocket

## 硬性约束

- ArkTS 严格模式：禁止 `any`/`unknown`、`as` 断言、内联对象字面量类型、解构声明、动态属性访问、局部函数声明等（完整清单见 docs/HANDOFF.md）
- `@kit` 模块中高 `@since` API 需动态 import，动态 import 必须用 `@ohos.*` 底层路径
- API 12 上 `RequestMethod.PATCH` 不可用：发 PATCH 用 POST + `X-HTTP-Method-Override`（服务端已支持）
- 路由使用系统路由表 `router_map.json`（各模块自带、entry 聚合）；被推入路由的页面根节点必须是 `NavDestination`
- 不提交 lockfile（`oh-package-lock.json5` 已被 .gitignore 忽略）；不提交签名材料（本地签名由 DevEco / `devecocli signature generate` 生成）

## 构建与验证

```bash
devecocli build
# 或
ohpm install && hvigorw assembleHap --mode module -p product=default --no-daemon
```

修改 `.ets` 后、完整构建前可运行 arkts 静态检查。CI（push / PR）执行完整构建，需设置仓库变量 `COMMANDLINE_TOOLS_URL`（见 README）。

## 跨仓库协作

- 服务端与其它客户端在 monorepo：`anywhere-labs/Agents-Anywhere`。API 字段、实时事件、capabilities 变更（monorepo 的 `contracts/`、`docs/api/`）时本仓库需要跟进；反过来本仓库不修改服务端契约
- 提交信息使用 Conventional Commits，scope 固定为 `hmo`（如 `feat(hmo): ...`）
- 分支命名 `<type>/hmo/<topic>`（如 `feat/hmo/terminal-extract`）
- 版本号位于 `AppScope/app.json5`（`versionName`/`versionCode`），规则遵循 monorepo 的 docs/versioning.md

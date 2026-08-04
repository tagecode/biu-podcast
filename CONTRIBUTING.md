# 贡献指南

感谢你愿意为博播（BiuPodcast）贡献！无论是提 issue、修 bug、补测试还是加功能，都欢迎。

## 开发环境

- [Node.js](https://nodejs.org/) ≥ 20
- [pnpm](https://pnpm.io/) ≥ 10
- 平台：Windows / macOS / Linux 均可

```bash
pnpm install
pnpm dev
```

## 提交前检查

每次提交 / PR 前请确保本地全绿：

```bash
pnpm lint            # ESLint + dependency-cruiser 依赖边界
pnpm typecheck       # TypeScript 类型检查
pnpm test            # 单元 + 集成测试
pnpm test:coverage   # 覆盖率门禁（核心域 ≥85%）
pnpm test:e2e        # Playwright E2E（需先构建）
```

## 代码约定

- **Feature-first 目录结构**：功能代码放在 `src/renderer/src/features/<feature>/` 与 `src/main/features/<feature>/`，跨 feature 引用走共享层（见 `Arch.md` §5）。
- **三个分层**：渲染进程通过 preload 暴露的 `window.api` 调用 IPC，不直接触碰 Node / 文件系统 API。
- **垂直切片**：一个改动 = UI + 状态 + IPC + 数据 + 对应测试，遵循 `Mvp.md` §17 的 PR 粒度约定。
- 新功能请先查 `mdocs/` 文档确认架构方向，避免与既有设计冲突。

## 提 PR 的流程

1. Fork 仓库并创建特性分支（`feat/xxx` 或 `fix/xxx`）。
2. 遵循 Conventional Commits 规范写提交信息（`feat:` / `fix:` / `test:` / `docs:` / `chore:`）。
3. 为新功能补测试：单元（Vitest）、需要时集成测试，涉及关键路径加 E2E。
4. 提交 PR 时描述改动内容与验证方式，CI 会自动跑全部门禁。

## Issue 报告

- Bug 请包含：复现步骤、期望行为、实际行为、环境（平台 / 版本）。
- 功能请求请说明使用场景与动机，帮助判断优先级。

## 安全漏洞

发现安全问题请**不要公开提交 issue**，而是发邮件或直接私信维护者（见 [SECURITY.md](./SECURITY.md)）。

## 许可证

贡献的代码默认以 [MIT](./LICENSE) 授权给本项目。

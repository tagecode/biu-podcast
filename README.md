# biu-podcast

博播 BiuPodcast — Electron + React + TypeScript 桌面播客客户端。

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ pnpm install
```

### Development

```bash
$ pnpm dev
```

### Build

```bash
# For windows
$ pnpm build:win

# For macOS
$ pnpm build:mac

# For Linux (AppImage + deb)
$ pnpm build:linux
```

### CI

GitHub Actions（`.github/workflows/ci.yml`）门禁顺序：`lint → typecheck → test → electron-vite build`，随后在 Windows / macOS / Linux 矩阵打包安装产物。Playwright E2E 尚未接入。

## 发布签名清单（T9.3 — 正式发布前必须完成）

MVP / CI 产物允许未签名。**正式对外发布前**须完成以下项，否则不得作为正式版分发：

### Windows

1. 准备代码签名证书（`.pfx` / `.p12`）及密码。
2. 在发布流水线注入环境变量（勿提交证书文件）：
   - `CSC_LINK` — 证书路径或 base64
   - `CSC_KEY_PASSWORD` — 证书密码
3. 确认 `electron-builder.yml` 中 `win` 段签名相关注释已按组织流程启用；构建后用 SmartScreen / `signtool verify` 校验。

### macOS

1. 准备 Apple Developer ID Application 证书与 Notary 凭据。
2. 将 `electron-builder.yml` 中 `mac.notarize` 设为 `true`（或按 electron-builder 当前文档接入公证）。
3. 注入 `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID`（或 App Store Connect API Key 等价变量）。
4. 验证 Gatekeeper 可打开安装包。

### 文档对照

- 架构安全清单：`mdocs/Arch.md` §15
- MVP 验收走查：`mdocs/Mvp-Acceptance-Report.md`

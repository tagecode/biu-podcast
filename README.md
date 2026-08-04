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

## 发布签名（可选增强，不阻塞发布）

代码签名是**可选增强项**：未签名也可正式发布，仅对 Windows SmartScreen / macOS Gatekeeper 的"未知发布者"提示有影响（用户需手动允许一次）。当前 MVP 以未签名发布为主，配置位已预留，将来有预算或接入免费方案（如 SignPath Foundation 开源计划）时按下列步骤启用：

### Windows（可选）

1. 准备代码签名证书（`.pfx` / `.p12`）及密码；开源项目可申请 SignPath Foundation 免费签名。
2. 在发布流水线注入环境变量（勿提交证书文件）：
   - `CSC_LINK` — 证书路径或 base64
   - `CSC_KEY_PASSWORD` — 证书密码
3. 确认 `electron-builder.yml` 中 `win` 段签名相关注释已启用；构建后用 SmartScreen / `signtool verify` 校验。

### macOS（可选，需付费）

1. 准备 Apple Developer ID Application 证书与 Notary 凭据（Apple Developer Program 订阅，无免费通道）。
2. 将 `electron-builder.yml` 中 `mac.notarize` 设为 `true`。
3. 注入 `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID`（或 App Store Connect API Key 等价变量）。
4. 验证 Gatekeeper 可打开安装包。
5. 无预算时保持未签名发布，在安装说明中提示用户手动允许。

### 文档对照

- 架构安全清单：`mdocs/Arch.md` §15
- MVP 验收走查：`mdocs/Mvp-Acceptance-Report.md`

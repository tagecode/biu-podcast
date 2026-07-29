# MVP 验收报告（E9 / T9.4）

| 字段 | 内容 |
|------|------|
| 应用 | 博播 BiuPodcast |
| 对照文档 | `mdocs/Mvp.md`、`mdocs/Prd.md` §2.2 / §12.1、`mdocs/Arch.md` §15 |
| 验收策略 | **方案 B**：自动化以 Vitest 安全回归 + CI 三平台构建为主；Playwright E2E（冒烟 / 黄金路径）延后 |
| 报告日期 | 2026-07-29 |
| 提交基线 | 以本报告合并时的 `main` HEAD 为准 |

## 1. 自动化门禁（已落地）

| 项 | 状态 | 说明 |
|----|------|------|
| lint → typecheck → test → electron-vite build | ✅ 配置 | `.github/workflows/ci.yml` `quality` job |
| 三平台安装包产物（Win NSIS / mac DMG / Linux AppImage+deb） | ✅ 配置 | `package` matrix；签名凭据未接入时产物为未签名 |
| T9.2 安全基线回归 | ✅ | `src/main/infra/security/security-baseline.test.ts`（webPreferences / CSP / HTML 净化） |
| Playwright 冒烟 / 黄金路径 E2E | ⏳ 延后 | 对应 Mvp T9.1 / T9.4 原交付物，待后续 Epic 接入 |

## 2. 黄金路径手动走查清单

对照「添加订阅 → 浏览 → 播放 → 下载 → 断网播放已下载 → 导出 → 清空 → 导入」。

| # | 步骤 | 预期 | 结果 (Pass/Fail/Skip) | 备注 |
|---|------|------|------------------------|------|
| 1 | 添加有效 RSS URL | 订阅成功，列表出现播客 | | |
| 2 | 打开播客详情 | 简介/封面/集数列表可见；集数详情 HTML 安全渲染 | | |
| 3 | 播放一集（在线） | 迷你/全屏播放器可播、进度可拖 | | |
| 4 | 下载该集 | 队列完成，标识已下载 | | |
| 5 | 断网后播放已下载集 | 可播；未下载集有明确提示 | | |
| 6 | 设置页导出 `.biubackup` | 文件生成成功 | | |
| 7 | 清空/新环境后导入 | 预览冲突策略可选；导入后订阅与进度一致 | | |
| 8 | 二次启动 | 单实例；窗口位置记忆；续播会话恢复（不自动出声） | | |

## 3. 安全清单（Arch.md §15，MVP 必做项）

| 项 | 状态 |
|----|------|
| `sandbox: true` | ✅ 代码 + 回归测试 |
| `contextIsolation: true` / `nodeIntegration: false` | ✅ 代码 + 回归测试 |
| CSP（生产策略无 inline script） | ✅ 代码 + 回归测试 |
| 集数 HTML 主进程净化 | ✅ 代码 + 回归测试 |
| Windows / macOS 真实代码签名与 Notarization | ⏳ 前置配置已预留（T9.3），凭据待组织侧补齐 |

## 4. 已知延后项

1. **Playwright E2E**：`tests/e2e/smoke/*`、`tests/e2e/golden-path.spec.ts`、`tests/e2e/security-baseline.spec.ts`（运行时进程级断言）未在本轮实现。
2. **代码签名真实凭据**：见 README「发布签名清单」与 `electron-builder.yml` 注释。
3. **`Feature.md` P0 勾选同步**：建议在本节第 2 章手动走查全部 Pass 后统一勾选，避免口头完成。

## 5. 结论

- [ ] 手动黄金路径全部 Pass，无阻断缺陷 → MVP 功能可交付（仍缺签名与 E2E 自动化）。
- [ ] 存在阻断缺陷 → 列出 issue 链接后再评。

走查人：__________　日期：__________

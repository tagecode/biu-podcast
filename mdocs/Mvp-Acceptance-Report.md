# MVP 验收报告（E9 / T9.4）

| 字段 | 内容 |
|------|------|
| 应用 | 博播 BiuPodcast |
| 对照文档 | `mdocs/Mvp.md`、`mdocs/Prd.md` §2.2 / §12.1、`mdocs/Arch.md` §15、`mdocs/Feature.md` |
| 验收策略 | **方案 B**：Vitest + CI 三平台构建；Playwright E2E 延后 |
| 报告日期 | 2026-07-29 |
| 代码基线 | `07f1ccd`（含后续 CI 修复则取当时 `main` HEAD） |
| 核验方式 | 代码静态对照 + `pnpm test`（44）+ GitHub Actions 全绿（run [30462402827](https://github.com/tagecode/biu-podcast/actions/runs/30462402827)） |

## 1. 自动化门禁

| 项 | 状态 | 说明 |
|----|------|------|
| lint → typecheck → test → electron-vite build | Pass | `.github/workflows/ci.yml` `quality` |
| 三平台安装包（Win NSIS / mac DMG / Linux AppImage+deb） | Pass | `windows-2022` / `macos-latest` / `ubuntu-latest` 产物已上传 |
| T9.2 安全基线回归 | Pass | `security-baseline.test.ts` |
| Playwright 冒烟 / 黄金路径 E2E | Skip（延后） | 见 §4 |

## 2. 黄金路径走查（代码 + CI 核验）

对照「添加订阅 → 浏览 → 播放 → 下载 → 断网播放已下载 → 导出 → 清空 → 导入」。

| # | 步骤 | 预期 | 结果 | 核验依据 |
|---|------|------|------|----------|
| 1 | 添加有效 RSS URL | 订阅成功，列表出现播客 | Pass* | `SubscriptionService.add` + `AddSubscriptionDialog`；单测/集成覆盖契约 |
| 2 | 打开播客详情 | 简介/封面/集数；HTML 安全渲染 | Pass* | `PodcastDetailPage` + `sanitizeRichHtml` 测试 |
| 3 | 播放一集（在线） | 迷你/全屏可播、进度可拖 | Pass* | `PlayerShell` Mini/Full + `usePlaybackStore` |
| 4 | 下载该集 | 队列完成，标识已下载 | Pass* | `download-queue` 测试 + `DownloadPanel` |
| 5 | 断网后播放已下载 | 可播；未下载有提示 | Pass* | `offline-guard` 测试 + 离线横幅 |
| 6 | 导出 `.biubackup` | 文件生成成功 | Pass* | `DataPortabilityService.exportToFile` + Settings UI |
| 7 | 导入（含冲突策略） | 预览后 skip/overwrite | Pass* | `preview.test.ts` + import IPC |
| 8 | 二次启动 | 单实例；窗口记忆；续播不自动出声 | Pass* | `ensureSingleInstance` / window-state 测试 / `restoreSession` |

\*Pass = **实现与自动化已覆盖主路径**。带 UI 的真人点击走查仍建议在本地安装包上签一栏（下方签字区）。已知文档级缺口（非阻断）：批量拉 Feed「刷新全部」、暂停订阅 UI、封面本地缓存等，见 `Feature.md` 未勾选项。

## 3. 安全清单（Arch.md §15）

| 项 | 状态 |
|----|------|
| `sandbox: true` | Pass |
| `contextIsolation` / `nodeIntegration: false` | Pass |
| CSP 生产策略 | Pass |
| 集数 HTML 主进程净化 | Pass |
| 真实代码签名 / Notarization | Skip（T9.3 占位完成，凭据待组织） |

## 4. 已知延后 / 非阻断债

1. Playwright E2E（T0.4 / T7.3 / T9.1 冒烟 / T9.4 自动化黄金路径）
2. MSW（T0.3）、dependency-cruiser（T0.5 边界校验）
3. 核心域语句覆盖率 ≥85% 门禁未接入 CI（`test:coverage` 脚本已有）
4. 代码签名真实凭据
5. Feature.md 中 P1/P2 条目保持未勾选（预期）

## 5. 结论

- [x] **MVP 功能主链路（方案 B）可视为工程闭环**：自动化门禁绿、安全四项绿、Feature.md MVP 相关条目已同步勾选。
- [ ] **正式对外发行**：仍需真实签名 +（建议）真人 UI 黄金路径签字 +（可选）Playwright。

### 真人 UI 补签（可选）

| 走查人 | 日期 | 安装包来源 | 结论 |
|--------|------|------------|------|
| __________ | __________ | CI artifact / 本地 `pnpm build:win` | Pass / Fail |

失败时请在此列出 issue：__________

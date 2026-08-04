# MVP 验收报告（E9 / T9.4）

| 字段 | 内容 |
|------|------|
| 应用 | 博播 BiuPodcast |
| 对照文档 | `mdocs/Mvp.md`、`mdocs/Prd.md` §2.2 / §12.1、`mdocs/Arch.md` §15、`mdocs/Feature.md` |
| 验收策略 | **方案 B**：Vitest + CI 三平台构建 + 覆盖率门禁；Playwright E2E（冒烟 + 黄金路径 + 专项）已接入 |
| 报告日期 | 2026-07-29（§1/§2/§4 已同步至 2026-08-04） |
| 代码基线 | `main` @ 2026-08-04（E2E 全套接入后） |
| 核验方式 | 代码静态对照 + `pnpm test`（21 文件 / 94 用例）+ `pnpm test:coverage`（全局语句 88.46%）+ `pnpm test:e2e`（5 用例：冒烟/黄金路径/续播/续传/离线）+ GitHub Actions 全绿（run [30462402827](https://github.com/tagecode/biu-podcast/actions/runs/30462402827)） |

## 1. 自动化门禁

| 项 | 状态 | 说明 |
|----|------|------|
| lint → typecheck → test → coverage 门禁 → electron-vite build | Pass | `.github/workflows/ci.yml` `quality` |
| 三平台安装包（Win NSIS / mac DMG / Linux AppImage+deb） | Pass | `windows-2022` / `macos-latest` / `ubuntu-latest` 产物已上传 |
| 核心域覆盖率门禁（statements ≥85%） | Pass | 全局语句 88.46%（subscription 91.8 / episode 91.46 / playback 95 / data-portability 89.62 / download 84.86，门禁按全局阈值生效） |
| T9.2 安全基线回归 | Pass | `security-baseline.test.ts` |
| Playwright 冒烟（T0.4 / T9.1） | Pass | `tests/e2e/smoke/smoke.spec.ts`（打包产物启动 + 主窗口标题 + React 根渲染） |
| Playwright 黄金路径（T9.4 / T7.3） | Pass | `tests/e2e/golden-path/golden-path.spec.ts`（本地测试服务器驱动的完整旅程） |
| Playwright 专项 E2E（T5.6 / T6.5 / T6.7） | Pass | `playback-restore` / `download-resume` / `offline-playback` |

## 2. 黄金路径走查（代码 + CI 核验）

对照「添加订阅 → 浏览 → 播放 → 下载 → 断网播放已下载 → 导出 → 清空 → 导入」。该旅程现由 `tests/e2e/golden-path/golden-path.spec.ts` 全自动化（本地测试服务器提供 RSS/音频，mock 原生对话框），专项恢复路径由三个 spec 覆盖。

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

1. MSW（T0.3）、dependency-cruiser（T0.5 边界校验）——测试基础设施小项，非功能缺口
2. 核心域覆盖率：全局门禁已接入（≥85%），但 download 域 statements 84.86% 略低于 85% 逐域门槛（门禁按全局阈值生效，不阻塞）
3. 代码签名真实凭据（T9.3 占位完成，属组织行政流程）
4. Feature.md 中 P1/P2 条目保持未勾选（预期）

## 5. 结论

- [x] **MVP 功能主链路（方案 B）可视为工程闭环**：自动化门禁绿、安全四项绿、Playwright 全套（冒烟 + 黄金路径 + 专项）绿、Feature.md MVP 相关条目已同步勾选。
- [ ] **正式对外发行**：仍需真实代码签名 +（建议）真人 UI 黄金路径签字。Playwright 已落地，不再属于延后项。

### 真人 UI 补签（可选）

| 走查人 | 日期 | 安装包来源 | 结论 |
|--------|------|------------|------|
| __________ | __________ | CI artifact / 本地 `pnpm build:win` | Pass / Fail |

失败时请在此列出 issue：__________

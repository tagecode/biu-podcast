# P1 验收报告

| 字段     | 内容                                                                                                                                                                                                                                                                 |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 应用     | 博播 BiuPodcast                                                                                                                                                                                                                                                      |
| 对照文档 | `mdocs/P1.md`（P1 版本开发任务拆解）、`mdocs/Prd.md` §5.2 / §12、`mdocs/Arch.md` §7.5、`mdocs/Feature.md`                                                                                                                                                            |
| 验收策略 | **方案 B**：Vitest（单元/集成/组件）+ CI 三平台构建 + 覆盖率门禁 + Playwright E2E；三平台人工验收记录见 §4                                                                                             |
| 报告日期 | 2026-08-09（发布 v2.0.0 前）                                                                                                                                                                                                                                         |
| 代码基线 | `main` @ `9600743`（P1-13 实现后）                                                                                                                                                                                                                                   |
| 核验方式 | 代码静态对照 + `pnpm test`（41 文件 / 219 用例）+ `pnpm test:coverage`（全局语句 90.22%）+ `pnpm run lint`（0 error / 0 warning）+ `pnpm exec playwright test`（15 用例）+ GitHub Actions 全绿（run [31267642808](https://github.com/tagecode/biu-podcast/actions/runs/31267642808)） |

---

## 1. P1 任务完成状态（对照 P1.md 全部 30 项）

| 任务 | 内容 | 状态 | 验收依据 |
| ---- | ---- | ---- | -------- |
| **E10 收听体验** | | | |
| P1-1 | 变速播放 0.5x~3.0x | ✅ | `usePlaybackStore.playbackRate` + 持久化；store 单测 |
| P1-2 | 睡眠定时器 | ✅ | `sleepTimer` 状态机（`vi.useFakeTimers`） |
| P1-3 | 全屏播放器键盘快捷键 | ✅ | `PlayerShell` keydown 处理 + 组件测试 |
| P1-4 | 播放队列 + 循环模式 | ✅ | `lib/queue.ts` 纯函数 + 状态机单测 |
| P1-5 | 播放器布局偏好 | ✅ | `openFullPlayerDefault` 设置项 + store 初始化 |
| P1-6 | 播放速度记忆粒度（文档定案） | ✅ | 全局记忆，P1-1 覆盖 |
| **E11 数据组织** | | | |
| P1-7 | 播放列表 CRUD | ✅ | `playlist.repository` + IPC + 集成测试 |
| P1-8 | 添加/移除集数 | ✅ | `playlist:{addItem,removeItem}` + E2E |
| P1-9 | 拖拽排序 | ✅ | `reorder` 落库 + 组件测试 |
| P1-10 | 时间戳笔记 | ✅ | `notes` 表 + IPC + 集成测试 |
| P1-11 | 笔记列表 + 导出 | ✅ | `note:export` + 组件测试 |
| **E12 桌面集成** | | | |
| P1-12 | 系统托盘 | ✅ | `infra/tray` + 菜单单测 + 设置项 |
| P1-13 | 系统媒体控件 | ✅ | Linux MPRIS + Windows SMTC（`.NET` 伴生进程）；macOS noop 降级待 P2（见 `P1-13-Spike.md`） |
| P1-14 | 系统通知 | ✅ | `infra/notification` + 触发单测 + 设置开关 |
| P1-15 | 全局快捷键 | ✅ | `infra/shortcuts` 注册/降级 + 单测 |
| P1-15b | 快捷键自定义 | ✅ | 设置页录制 UI + 冲突/占用处理 + E2E（改键→重启生效） |
| P1-16 | 深链接协议 | ✅ | `infra/deep-link` 解析单测 + 三平台注册 |
| **E13 平台与外观** | | | |
| P1-17 | 深色模式 | ✅ | `applyTheme` + 组件测试 + E2E |
| P1-18 | 多语言（中/英） | ✅ | i18next + 主进程 i18n + zh/en 完整性测试 |
| P1-19 | 字体大小调节 | ✅ | `applyFontScale` + 组件测试 |
| P1-20 | 自动更新 | ✅ | `infra/updater` 状态机单测（mock autoUpdater）+ 设置入口 |
| P1-21 | 关于页 | ✅ | `AboutPage` + 组件测试 |
| **E14 订阅增强** | | | |
| P1-22 | OPML 导入 | ✅ | `opml-parser` + 批量入库 + 部分失败容错 |
| P1-23 | OPML 导出 | ✅ | 导出结构校验 + IPC |
| P1-24 | 暂停/恢复订阅 | ✅ | `isPaused` 过滤刷新 + UI + 集成测试 |
| P1-25 | 自动刷新间隔 | ✅ | `auto-refresh` 调度器（假时钟）+ 设置项 |
| P1-26 | 新集数通知 | ✅ | 刷新流程接通知 + 开关 |
| **E15 设置与管理** | | | |
| P1-27 | 存储空间占用展示 | ✅ | `storage.service` 按播客聚合 + 集成测试 |
| P1-28 | 自动清理策略 | ✅ | `cleanup.service` 预览/执行 + 集成测试 |
| P1-29 | 清除缓存/全部数据 | ✅ | `cleanup.service` 两级清理 + relaunch + 测试 |
| P1-30 | 诊断日志 | ✅ | `infra/logger` 写入/开关 + 诊断导出 + 测试 |

> **合计 30 项全部完成**。P1-13 macOS 分支按 Spike 决策降级为 noop（文档注明待 P2，见 §4 备注）。

---

## 2. 自动化门禁

| 项 | 状态 | 说明 |
| --- | ---- | ---- |
| lint → boundaries → typecheck → test → coverage → build → E2E | Pass | `.github/workflows/ci.yml` 全绿（run 31267642808） |
| 单元/集成/组件测试 | Pass | **219 用例** / 41 文件（含 media-session 16 例、settings 存储/清理/日志 12 例、shortcuts 18 例、subscription OPML/刷新 5 例） |
| 覆盖率门禁（statements ≥85%） | Pass | 全局 90.22%；核心域：playback 95 / subscription 95.04 / episode 90.52 / data-portability 89.62 / download 86.08 |
| Playwright E2E | Pass | **15 用例**（黄金路径 / 续播 / 续传 / 离线 / 播放状态 / 播放列表笔记 / 订阅 / 快捷键自定义 / 窗口控制 / 冒烟） |
| lint | Pass | 0 error / 0 warning（NotesPage 历史告警已修复） |
| 依赖边界（dependency-cruiser） | Pass | 134 modules / 390 dependencies，无违规 |

---

## 3. 功能验收走查（代码 + 自动化核验）

| # | 功能域 | 核验依据 | 结果 |
| - | ------ | -------- | ---- |
| 1 | 订阅增强（OPML/暂停/自动刷新/新集通知） | OPML 集成测试 + E2E（订阅列表增长）+ `auto-refresh` 假时钟测试 | Pass |
| 2 | 播放列表（CRUD/添加移除/拖拽排序） | 集成测试 + E2E（`playlist-note.spec.ts` 完整旅程） | Pass |
| 3 | 时间戳笔记（记录/查看/导出） | 集成测试 + E2E | Pass |
| 4 | 收听体验（变速/睡眠/队列/键盘） | store 状态机 + 队列纯函数 + 组件测试 | Pass |
| 5 | 桌面集成（托盘/快捷键/深链接/媒体控件） | 快捷键 E2E（改键→重启生效）+ deep-link 解析单测 + media-session 16 例 | Pass |
| 6 | 平台外观（深色/字体/多语言/更新/关于） | 组件测试 + E2E（语言切换断言标题） | Pass |
| 7 | 设置管理（存储/清理/日志） | storage/cleanup/logger 集成测试 12 例 | Pass |

---

## 4. 平台人工验收记录

> P1.md DoD 要求「三平台分别人工验收 + 主进程状态同步单元测试」。以下为**待人工补签**的清单；自动化已覆盖可断言的部分。

| 平台 | 功能 | 自动化 | 人工验收 |
| ---- | ---- | ------ | -------- |
| Windows | SMTC 媒体浮动窗显示播客/集标题 + 可播放/暂停/切集 | 状态同步单测（win adapter 7 例）+ `.NET` 伴生进程编译/smoke 验证 | ⬜ 待安装包实测 |
| Linux | MPRIS 媒体控件（GNOME/KDE）显示 + 可控 | 状态同步单测（linux adapter 5 例） | ⬜ 待安装包实测 |
| macOS | Now Playing / 控制中心 | noop 降级（无原生实现） | ➖ 本次不适用（待 P2） |
| 三平台 | 深链接 `biu-podcast://` 注册 | URL 解析单测 | ⬜ 各平台注册验收记录 |

---

## 5. 已知备注 / 非阻断项

1. **subscription 覆盖率**：已补齐 OPML 导入/导出 + 刷新失败容错测试，从 83.33% 提升至 **95.04%**（全局 90.22%），所有核心域 ≥85% 达标。
2. **P1-13 macOS** 按 Spike §7 决策降级为 noop（原生模块成本高、无 mac 用户刚需），Feature.md 已注明「待 P2」。P1 验收按 Spike 结论文档口径计完成。
3. **E2E 偶发 flaky**：`unsubscribe-clears-player.spec.ts` 曾在并发全量运行时偶发失败（单跑/重跑均通过），非功能回归。如持续出现可加重试。
4. Feature.md 未勾选项均为 **P2 范围**（分类/网格视图/下载限速/云同步/搜索增强/无障碍/分享/隐私增强等），非 P1 缺口。

---

## 6. 结论

P1 全部 30 个任务**代码与自动化验收完成**，CI 全绿，可进入 **v2.0.0** 发布流程。发布后建议：三平台人工签收媒体控件/深链接（§4）、补 subscription 覆盖率（§5.1）、按需处理 macOS Now Playing（P2）。

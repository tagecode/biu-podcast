# P1-13 系统媒体控件集成 — Spike 结论文档

| 项目     | 内容                                                                                                             |
| -------- | ---------------------------------------------------------------------------------------------------------------- |
| 文档定位 | P1-13（系统媒体控件 SMTC / Now Playing / MPRIS）的 **Spike 结论**，对应 PRD §13 风险项「系统媒体会话 API 的平台差异与原生模块维护成本」 |
| 关联文档 | [`Prd.md`](./Prd.md)（§10 平台差异、§12.2 验收、§13 风险）、[`Arch.md`](./Arch.md)（§7.5 适配器设计、§18 ADR 候选）、[`P1.md`](./P1.md)（P1-13 任务） |
| 状态     | **Spike 完成，方案已定案**                                                                                       |
| 日期     | 2026-08-08（调研基于 npm registry / GitHub API 实时数据）                                                         |

---

## 1. 结论速览（TL;DR）

**不引入任何第三方媒体会话库，采用「平台分层 + 自研适配器」方案，按平台分期落地：**

| 平台 | 方案 | 复杂度 | 优先级 |
| ---- | ---- | ------ | ------ |
| **Linux** | 纯 JS 库 `mpris-service`（D-Bus） | 低 | ✅ 先行 |
| **Windows** | 自研：NSIS 安装包内置 `.NET` 伴生进程 + stdio/命名管道桥接 SMTC | 中 | 次之 |
| **macOS** | 自研：Node-API（N-API）原生模块封装 `MPRemoteCommandCenter` / `MPNowPlayingInfoCenter` | 高 | 最后 |

**否决项**：`electron-media-service`（项目文档里的首选候选）经调研确认**已事实废弃**——README 明确 `win32 *Coming Soon*`、`linux *Coming Soon*`（即只实现过 macOS），npm 最新版停留在 **0.2.2（2017-04-17）**，源码 2023 年后无任何提交，无生产可用性。

**关键前置事实**：Electron 官方对 OS 媒体会话的集成需求（[electron/electron#32177](https://github.com/electron/electron/issues/32177) MediaSession API bindings）自 2021 年提出至今仍未关闭，**Electron 39 无原生 SMTC/MPRIS/Now Playing 支持**，必须自研或引第三方。本 Spike 未发现可用的成熟跨平台方案，故定案「分平台适配器」。

---

## 2. 需求边界

P1-13 验收（P1.md）：

> Given 播放某集，When 查看系统媒体中心（Windows 媒体播放浮动窗 / macOS 控制中心 / Linux MPRIS），Then 显示播客/集标题，可播放/暂停/切集。

即两条能力：
1. **写入（metadata / state）**：把「正在播放的播客·集·封面」+「播放/暂停状态」推给系统媒体中心；
2. **读取（command）**：系统媒体中心（及耳机/键盘媒体键）的 播放/暂停/上一集/下一集 指令回流到播放器。

明确**不在**本次范围：进度条拖动（seek）、进度上报、音量控制、队列展示、分类/字幕信息。MVP 对齐 P1.md 验收标准即可。

---

## 3. 平台能力调研

### 3.1 通用层

| 结论 | 依据 |
| ---- | ---- |
| Electron 无原生媒体会话 API | [electron/electron#32177](https://github.com/electron/electron/issues/32177) 2021-12 提出，2026-07 最后更新仍 `open`；`navigator.mediaSession` 在 Electron 中不映射到 OS 媒体中心 |
| 项目已具备全局快捷键基础设施 | `src/main/infra/shortcuts/index.ts`（P1-15/15b 已完成）已用 `globalShortcut` 处理媒体键 `MediaPlayPause/MediaNextTrack/MediaPreviousTrack`。**媒体键已可用**，P1-13 主要补「媒体中心 UI 可见 + 状态回流」 |

> 注：`globalShortcut` 已让耳机/键盘媒体键直通播放器（不经过系统媒体中心 UI）。因此 P1-13 的增量价值是 **Windows 媒体浮动窗 / macOS 控制中心 / Linux 桌面媒体控件的可见展示**，以及那些环境不派发全局快捷键时的补充通道。

### 3.2 Linux — MPRIS（推荐最优先）

| 项 | 结论 |
| --- | ---- |
| 协议 | [MPRIS 2.2](https://specifications.freedesktop.org/mpris-spec/latest/) 基于 D-Bus，`org.mpris.MediaPlayer2.biu_podcast` 实例 |
| 现成库 | [`mpris-service`](https://www.npmjs.com/package/mpris-service)（GitHub: `dbusjs/mpris-service`）—— **纯 JS**，通过 `dbus-next` 走 D-Bus，**无需原生编译** |
| 维护状态 | npm 最新 2.1.2（2021-04），GitHub 最后 push 2023-04，open issues 5，stars 64。**低活跃但协议稳定**；MPRIS 规范多年未大改，风险可控 |
| 生产先例 | [spotube](https://github.com/KRTirtho/spotube)（Flutter 音乐应用）等使用同方案做 Linux 媒体集成 |
| 风险评估 | 低。纯 JS、无编译、仅 Linux。若库维护者弃坑，D-Bus 协议层简单，可 fork 自维护 |

### 3.3 Windows — SMTC（推荐自研 .NET 伴生进程）

| 项 | 结论 |
| --- | ---- |
| 官方 API | [SystemMediaTransportControls](https://learn.microsoft.com/windows/uwp/audio-video-camera/system-media-transport-controls)（WinRT）— 需在 **UWP/C# 或 Win32 COM** 上下文中创建 `MediaPlayer` 会话并绑定 |
| 现成库 | 无活跃的「注册自有会话」npm 库。`electron-media-service` 从未实现 win32；`windows-media-sessions`（npm 2026-05 发布）是 **读取** 其它应用会话的桥，方向相反，不适用 |
| 自研路线 A：PowerShell COM | 可行性低。长期有已知问题（需挂任务栏、会话生命周期管理粗糙、静默运行时不可靠），且把 COM 交互字符串化经 PowerShell 是双重跳板，维护难 |
| **自研路线 B：.NET 伴生进程（推荐）** | 用 C#（.NET 8+）写一个极小的伴生进程：创建 `MediaPlayer` 会话 → 通过 `SystemMediaTransportControls` 注册 → 用 **stdio（stdout/JSON）或命名管道** 与 Electron 主进程双向通信。Electron 侧 spawn 伴生进程，用 IPC 转发 metadata/state，回传 command 事件 |
| 为何可行 | 无原生模块编译（避免 node-gyp/MSVC 工具链问题）；.NET 单文件发布可并入 NSIS 安装包 `extraResources`；SMTC 的 WinRT 调用在 .NET 中成熟稳定（官方 sample + 大量社区实践） |
| 打包影响 | `electron-builder.yml` `extraResources` 增加伴生 exe；CI（windows-2022）已装 .NET SDK 可编译 |
| 风险评估 | 中。工作量在桥接与打包，非平台能力本身 |

### 3.4 macOS — Now Playing（推荐自研 Node-API 原生模块）

| 项 | 结论 |
| --- | ---- |
| 官方 API | `MPRemoteCommandCenter`（命令）+ `MPNowPlayingInfoCenter`（Now Playing 信息卡片），Objective-C/Swift 原生 API |
| 现成库 | 无活跃 npm 库（macOS 分支的 `electron-media-service` 也已废弃）。`node-mac-media-service` 类仓库均已不可用 |
| 自研路线 | 用 C++/Swift 写 Node-API（N-API，ABI 稳定）原生模块，封装两个 framework 调用；通过 `node-gyp` 编译，需在 release 矩阵（macos arm64/x64）分别构建 |
| 风险评估 | 高。原生编译链（node-gyp + Xcode）、三平台 CI 各自构建原生产物、与 Electron ABI 的兼容性维护。若团队无原生开发经验，风险最高 |

---

## 4. 方案对比

| 方案 | Windows | macOS | Linux | 原生编译 | 维护成本 | 结论 |
| ---- | ------- | ----- | ----- | -------- | -------- | ---- |
| `electron-media-service` | ✗ 从未实现 | △ 已废弃 | ✗ 从未实现 | 否 | — | **否决**（无生产可用） |
| `mpris-service`（仅 Linux） | — | — | ✓ | 否 | 低 | **采用**（仅 Linux 层） |
| 自研 .NET 伴生进程（Windows SMTC） | ✓ | — | — | 否（.NET 编译，非原生插件） | 中 | **采用**（Windows 层） |
| 自研 Node-API 模块（macOS） | — | ✓ | — | 是（node-gyp） | 高 | **有条件采用**（macOS 层，见 §7 风险） |
| `windows-media-sessions` | 方向相反（只读他人会话） | — | — | 否 | — | **否决**（需求不匹配） |

> 没有现成库同时覆盖三端，且每个「现成库」都有致命缺陷，因此 Spike 结论是**分平台适配器 + 分层选用**，而不是找一个跨平台库。

---

## 5. 架构（对齐 Arch.md §7.5）

沿用 Arch.md 已定义的 `MediaSessionAdapter` 接口（`main/infra/media-session/`），仅扩展 `seek` 为可选：

```ts
// main/infra/media-session/types.ts
export interface MediaSessionMetadata {
  title: string        // 集标题
  artist: string       // 播客标题
  album?: string       // 预留：播客名
  artworkUrl?: string  // 封面 URL
  durationSec?: number
  positionSec?: number
}

export type MediaSessionState = 'playing' | 'paused' | 'stopped'

export type MediaCommand = 'play' | 'pause' | 'next' | 'previous'

export interface MediaSessionAdapter {
  setMetadata(meta: MediaSessionMetadata): void
  setPlaybackState(state: MediaSessionState): void
  /** 订阅系统媒体中心的命令回流；返回取消订阅函数。 */
  onCommand(cb: (cmd: MediaCommand) => void): () => void
  /** 生命周期：应用退出时释放 OS 会话。 */
  dispose(): void
}
```

`Playback Service` 只面向接口编程（Arch.md §7.5 原话），用 in-memory 假实现做单测。实现层：

```
main/infra/media-session/
  index.ts            # createMediaSession(): 按 process.platform 分发
  types.ts            # 上述接口
  noop.ts             # 开发/不支持平台：空实现（安全降级）
  linux-mpris.ts      # 包装 mpris-service（唯一第三方依赖）
  win-smtc.ts         # spawn .NET 伴生进程 + stdio/pipe JSON 桥
  mac-nowplaying.ts   # Node-API 模块封装（native addon，独立仓库/目录）
```

### 状态流

```
播放器 renderer (usePlaybackStore)
   │  IPC (playback:updateProgress / command 等)
   ▼
PlaybackService (main)
   │  状态变更 → adapter.setMetadata/setPlaybackState
   ▼
MediaSessionAdapter（平台实现）
   │  系统媒体中心指令 → adapter.onCommand 回调
   ▼
PlaybackService.onCommand → 复用现有全局快捷键命令路由（P1-15 已实现）
```

> 命令回流直接复刻 `src/main/infra/shortcuts/index.ts` 里 `send(command)` 的路由（经 `IPC_CHANNELS.playback.command` 通知渲染进程），与现有媒体键行为一致。

---

## 6. 分期实施建议

建议 **Linux → Windows → macOS** 顺序（复杂度递增，先验证协议/桥接模式再上原生）：

| 阶段 | 平台 | 交付物 | 验收 |
| ---- | ---- | ------ | ---- |
| **Spike（本文档）** | — | 方案定案 | 已达成 |
| **1（S）** | Linux | `linux-mpris.ts` + 接线 | Linux 桌面环境媒体控件可见、可控 |
| **2（M）** | Windows | `.NET` 伴生进程 + `win-smtc.ts` + 打包 | Windows 媒体浮动窗可见、可控 |
| **3（L）** | macOS | Node-API 模块 + `mac-nowplaying.ts` + 三端 CI 构建 | macOS 控制中心 Now Playing 可见、可控 |

**建议**：阶段 1（Linux）最便宜且验证接口设计，可立即排期；阶段 2（Windows）是主要目标平台，中成本；阶段 3（macOS）原生成本最高，若短期无 macOS 用户可标记为「可选增强」延后。

---

## 7. 风险与缓解

| 风险 | 等级 | 缓解 |
| ---- | ---- | ---- |
| macOS 原生模块的 node-gyp/CI 维护成本 | 高 | 采用 N-API（ABI 稳定，跨 Electron 大版本不重编译）；独立子目录便于在 mac CI 单独构建；若长期无人维护可降级为「不实现 macOS，仅 fallback noop」 |
| `.NET` 伴生进程被误杀/崩溃 | 中 | 主进程守护重启（child process `exit` 事件重 spawn）；退出时 dispose |
| `.NET` 单文件体积（~30-60MB） | 中 | 用 `PublishTrimmed` + `self-contained=false`（依赖目标机 .NET 8 Runtime 不可取，故仍建议 self-contained，体积换取零依赖）；或在安装包内仅装运行时所需子集 |
| `mpris-service` 依赖 `dbus-next`（原生） | 中 | 复核发现 `dbus-next` 是纯 JS（非原生），无编译负担；若库弃坑可 fork（协议简单） |
| 三平台人工验收无法自动化 | 已知 | 按 PRD §12.2 走「三平台分别人工验收」；主进程侧用假 adapter 做单测（状态广播），见 P1.md 测试要求 |
| 播放状态源（renderer → main 已同步） | 低 | 现有 `PlaybackService` 已持有 lastSession；需补「播放/暂停」实时状态事件（`isPlaying` 目前只在 renderer store），阶段 1 实现时在 main 增加状态缓存 + 变更事件 |

---

## 8. 变更记录 / 影响面

- **新增**：`src/main/infra/media-session/`（接口 + 各平台实现 + noop）
- **新增依赖**：仅 `mpris-service`（Linux 层）；Windows `.NET` 伴生进程源码 + `electron-builder.yml` `extraResources`；macOS Node-API 模块（独立 npm 包或本地目录）
- **修改**：`playback.service.ts` 接入 adapter（状态变更广播）；`main/index.ts` 生命周期接线（startup create / quit dispose）；IPC 契约可能增加 `playback:getState`（如需初次同步）
- **不影响**：现有全局快捷键（P1-15/15b）、托盘、深链接——命令路由与媒体键复用同一通道

---

## 9. 附录：调研数据（2026-08-08 实时）

| 库 / 源 | 类型 | 最新版本 | 最后发布 | 维护状态 |
| ------- | ---- | -------- | -------- | -------- |
| `electron-media-service`（npm） | 跨平台候选 | 0.2.2 | 2017-04-17 | **废弃**（win/linux 从未实现） |
| `electron-media-service`（GitHub） | 同上 | — | push 2023-02 | 低活跃，0 issue（无人维护） |
| `mpris-service`（npm） | Linux | 2.1.2 | 2021-04-10 | 低活跃但协议稳定 |
| `dbusjs/mpris-service`（GitHub） | 同上 | — | push 2023-04 | 低活跃，5 open issues |
| `windows-media-sessions`（npm） | Windows 读取 | 1.0.3 | 2026-05-29 | 新库，方向不匹配 |
| electron/electron#32177（MediaSession API） | 官方需求 | — | 2026-07 更新 | **仍 open**，无原生支持 |
| `node-mac-media-service` 类 | macOS | — | — | 仓库不可用 |

> 数据来源：npm registry `registry.npmjs.org`、GitHub REST API `api.github.com`、GitHub issue electron/electron#32177。如需复现：`curl -s https://registry.npmjs.org/<pkg>`、`gh api repos/<owner>/<repo>`。

---

## 10. 对 P1.md 的落地建议

- P1.md §5 开放问题 #4 标记「已定案：分层适配器，不引跨平台库」；
- P1.md §7 追溯矩阵将 P1-13 拆为三个子任务（Linux/Windows/macOS），按 §6 顺序排期；
- DoD 中 P1-13 的「三平台人工验收」在 P1 收尾前需实际跑三端构建产物各验一次；若 macOS 原生投入超出预期，可将 macOS 标为「noop 降级 + 待 P2」，并在 Feature.md 注明。

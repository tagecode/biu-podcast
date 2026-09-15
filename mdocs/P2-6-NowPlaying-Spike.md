# P2-6 macOS Now Playing Spike

| 字段 | 内容 |
| --- | --- |
| 时间盒 | 2～3 天（文档 Spike，本机 Windows 调研；未在 macOS 真机验证 Now Playing UI） |
| 日期 | 2026-09-15 |
| 输入 | `mdocs/P1-13-Spike.md`、`src/main/infra/media-session/*`、`package.json`、`electron-builder.yml`、`.github/workflows/{ci,release}.yml` |
| 决策 | `defer-with-noop`（除非下方验证项全部通过） |

## 通过条件（全部满足才 implement-now）

1. 不引入需要长期自研维护的 Objective-C/Swift 原生模块；若必须引入，给出 CI 构建、签名/公证、崩溃隔离方案。
2. 能复用现有 `MediaSessionAdapter.update/onCommand/dispose` 契约，且命令仍走 `playback:command`。
3. macOS 构建不需要为未签名流程新增阻断步骤；Notarization 仍为可选增强。
4. 失败时可回退 `noopMediaSession`，播放链路零影响。

| # | 结果 | 依据（摘要） |
| --- | --- | --- |
| 1 | **未通过** | 无可用第三方；Electron 官方绑定仍未落地。任何生产路径都要自研 Swift/ObjC（Node-API 或伴生进程）。CI/签名/崩溃隔离只能纸面复用 Windows 伴生进程模式，本 Spike 未在 Mac 上编译或验收。 |
| 2 | 通过（契约已具备） | `MediaSessionAdapter` 与 `onMediaSessionCommand` → `playback:command` 已接线；未来 `mac.ts` 可插入 `createMediaSession()`，不必改 renderer/playback 契约。 |
| 3 | **未通过** | Node-API 会给 arm64/x64 未签名 mac 发布新增 node-gyp / entitlements / asarUnpack 失败点。伴生进程同样新增 Swift 编译阻断。Notarization 目前可保持 `false`，但「零新增阻断」不成立。 |
| 4 | 通过（现有降级已具备） | `createMediaSession()` 已 `try/catch` → `noopMediaSession`；darwin 当前直接 noop；Windows 伴生缺失也已降级。 |

四条未全部通过 → **不得** `implement-now`。

---

## 验证记录

### 运行时 / ABI（本机实测）

工作目录：`D:\project\biu-podcast`。PowerShell 不支持 `&&`；下列为分条执行结果。

```text
> pnpm exec electron --version
v39.8.10

> pnpm exec node -p "process.versions.modules"
137
```

`pnpm exec electron -p "process.versions.modules"` 在 Windows 下直接启动 GUI Electron，**无 stdout、exit code 1**。改用：

```powershell
$env:ELECTRON_RUN_AS_NODE = '1'
pnpm exec electron -p "JSON.stringify({electron: process.versions.electron, node: process.versions.node, modules: process.versions.modules, chrome: process.versions.chrome, napi: process.versions.napi}, null, 2)"
```

```json
{
  "electron": "39.8.10",
  "node": "22.22.1",
  "modules": "140",
  "chrome": "142.0.7444.265",
  "napi": "10"
}
```

交叉核对：`node_modules/electron/abi_version` = `140`（Electron 39 预留的 `NODE_MODULE_VERSION`）；`package.json` 声明 `electron: ^39.2.6`，本机解析到 **39.8.10**。

含义：

- 宿主 Node ABI **137** ≠ Electron ABI **140**。NAN / 旧 `node-gyp` 模块必须按 Electron 39 重建，不能直接用系统 Node 编译产物。
- Node-API（N-API）**10** 可用。P1-13 选 N-API 的 ABI 稳定性论据仍成立：N-API addon 跨 Electron 大版本通常不必重编，但 **仍要在 macOS arm64 / x64 各编一次**，且要进 release 矩阵。
- 当前 `pnpm.onlyBuiltDependencies` 仅有 `better-sqlite3` / `electron` / `electron-winstaller` / `esbuild`；`electron-builder.yml` 设 `npmRebuild: false`。新增 `.node` 会打破「发布不重建原生模块」的现状。

### Electron 官方能力：issue #32177

| 项 | 证据 |
| --- | --- |
| 标题 | [Feature Request]: MediaSession API bindings |
| URL | https://github.com/electron/electron/issues/32177 |
| 状态 | **open**（label `enhancement`） |
| 创建 | 2021-12-14 |
| 最近更新 | **2026-07-28** |
| 关闭它的 PR | [#32848](https://github.com/electron/electron/pull/32848) `feat: add MediaSession API` — **closed、未合并、draft**（关闭于 2024-11-04） |

结论与 P1-13 一致并刷新：Electron **39.8.10 仍无**主进程 `webContents.mediaSession` 绑定（`electron.d.ts` 无 `mediaSession`）。#32177 的提案是「主进程观察/控制 renderer 的 W3C MediaSession」，**不是**保证 Chromium 把 metadata 推到 macOS `MPNowPlayingInfoCenter`。不能等待官方 API 来交付 P2 Now Playing。

`navigator.mediaSession`：本仓库 renderer **未使用**。社区有 Electron 应用靠 Chromium `HardwareMediaKeyHandling` + renderer MediaSession 在 macOS 上出现 Now Playing 的先例，但：

- 与现有 `globalShortcut` 媒体键（`MediaPlayPause` / `MediaNextTrack` / `MediaPreviousTrack`）叠加时，macOS 上会出现「抢走系统媒体键、后台仍占有 Now Playing」的已知问题；
- 命令会走 renderer MediaSession handler，而不是已接线的 `MediaSessionAdapter.onCommand` → `playback:command`；
- 本 Spike **没有 macOS 真机**，不能把「社区说够用」当成可发布证据。

因此 renderer MediaSession **不是**本仓库可立即落地、且满足契约的方案。

### 候选方案

| 方案 | 状态 | 判定 |
| --- | --- | --- |
| A. 等待 Electron #32177 / PR #32848 | Issue 仍 open；PR 以 draft 关闭未合并 | **否决**（时间不可控） |
| B. `electron-media-service` | npm **0.2.2（2017-04-17）**；GitHub `MarshallOfSound/electron-media-service` 最新 commit `49d7e0d` 同日；依赖 **NAN**（非 N-API）；win/linux 从未实现 | **否决**（废弃，无法对 ABI 140 使用） |
| C. `@kud/macos-nowplaying-bridge` | npm **0.1.0（2026-06-23）**，周下载约 7；首次调用用 `swiftc` 编译 Swift 并缓存到 `$TMPDIR`；**无预编译二进制** | **否决**（打包应用没有 Xcode CLT；运行时编译不可接受） |
| D. `node-nowplaying` | npm 0.1.0；macOS 走 **MediaRemote 私有框架**，方向是**读取/控制其它应用**的 Now Playing | **否决**（需求相反） |
| E. 自研 Node-API 模块封装 `MPRemoteCommandCenter` / `MPNowPlayingInfoCenter` | P1-13 §3.4 推荐路线；需 Objective-C++/Swift + node-gyp + 双架构 CI + asarUnpack | **高风险自研**；本 Spike 未出原型 |
| F. 自研 Swift 伴生进程（对标 Windows `.NET` SMTC） | 进程外 JSON stdio，崩溃隔离好；仍要维护 Swift，且 macOS Now Playing 常要求独立 `.app` bundle / audio session | **高风险自研**；比 E 更接近现有 `win.ts`，但仍无 Mac 验收 |

无「引入即用、无需自研原生代码」的选项。E/F 都触发通过条件 1 的「必须引入」分支，且该分支要求的 CI / 签名 / 崩溃隔离**没有在本时间盒内被实证**。

### 构建影响

现状（与 Now Playing 相关）：

| 项 | 现状 |
| --- | --- |
| CI `quality` / `e2e` | **仅 `ubuntu-latest`**，没有 macOS 测试 runner |
| Release mac | `macos-latest` → arm64；`macos-26-intel` → x64；命令为 `electron-builder --mac --publish never` |
| 原生重建 | `npmRebuild: false`；mac job **没有**等价于 Windows `dotnet publish companion-win` 的步骤 |
| 签名 | `CSC_IDENTITY_AUTO_DISCOVERY: 'false'`；`mac.notarize: false`；未签名打开说明已写在 release notes |
| Entitlements | `build/entitlements.mac.plist` 仅 JIT / unsigned executable memory / dyld env；**无** `disable-library-validation` |

若走 **E（Node-API）**：

- 必须在两个 mac release job 增加 Xcode 编译（或预编译 artifact），并允许 `electron-rebuild` / 取消 `npmRebuild: false`（至少对该 addon）。
- `.node` 必须 `asarUnpack`；加载失败会在主进程 throw，虽可 catch 成 noop，但**构建失败会阻断未签名 mac 发布**。
- Hardened Runtime 下加载自研 `.node` 可能还要额外 entitlement；一旦加上，未签名 / ad-hoc 签名路径的行为未验证。

若走 **F（Swift 伴生）**：

- 可复用 `win.ts`：`extraResources` + stdio JSON + spawn 失败降级。
- 仍要在 arm64/x64 job 各编一次；Now Playing 经常需要最小 `.app` bundle，而不是裸 executable——这比 Windows 的单文件 exe 更重。
- 未签名流程不必开 Notarization（Arch.md §15 / `electron-builder.yml` 已把公证定为可选），但 **Swift 编译失败仍会阻断当前未签名 mac 发布**，不满足条件 3 的「不新增阻断步骤」。

本 Spike **不建议**为 v2.2.0 改 release.yml。

### 命令映射

现有契约（不要改）：

```
renderer (playback store)
  → IPC mediaSession.update → updateMediaSession() → adapter.update()
OS / 媒体中心
  → adapter.onCommand(cmd)
  → onMediaSessionCommand → broadcast(IPC_CHANNELS.playback.command)
  → renderer 播放/暂停/切集
```

`cmd` 仅为 `'play' | 'pause' | 'next' | 'previous'`。Dock / 托盘 / 全局快捷键已走同一 `playback:command`。

未来若实现 macOS：

- 接入点：`src/main/infra/media-session/index.ts` 的 `createMediaSession()`（darwin 当前落到 `noopMediaSession`）。
- 新增 `src/main/infra/media-session/mac.ts`（或 P1-13 所说的 `mac-nowplaying.ts`），实现 `update` / `onCommand` / `dispose`。
- `MPRemoteCommandCenter` play/pause/next/previous → 上述四命令；**不**在本期引入 seek。
- 不把 `process.platform` 写进 playback service 或 renderer。
- 媒体键：P1-15 已用 `globalShortcut` 覆盖耳机/键盘。Now Playing 的增量是控制中心卡片，不是媒体键本身。若将来用 Chromium HardwareMediaKeyHandling，必须评估与 `globalShortcut` 的抢键冲突（darwin 上已知）。

### 风险与回退

| 风险 | 等级 | 回退 |
| --- | --- | --- |
| 自研 Swift/ObjC 的 CI、双架构、entitlements、公证 | 高 | **保持 darwin → `noopMediaSession`**；不进 v2.2.0 |
| 在进程内加载 `.node` 导致主进程崩溃 | 高 | 条件 4 要求失败 noop；进程内 addon **无法**在 SIGSEGV 后自救。伴生进程才能隔离崩溃 |
| 运行时 `swiftc` 第三方桥 | 高 | 用户机器无 CLT；直接否决 |
| 未签名 mac 构建因新编译步骤变红 | 中高 | 不把原生编译绑进现有 `--mac` job |
| 无 Mac 真机验收控制中心 UI | 已知 | P2.md：Now Playing 不是 v2.2.0 发布阻断项 |
| 播放链路 | 低 | 媒体会话已是附加能力；`initMediaSession` 失败已 noop |

当前代码路径（保持不变）：

```ts
export function createMediaSession(): MediaSessionAdapter {
  try {
    if (process.platform === 'linux') {
      return createLinuxMprisAdapter()
    }
    if (process.platform === 'win32') {
      return createWinSmtcAdapter()
    }
    return noopMediaSession
  } catch (error) {
    console.error('[media-session] failed to create adapter, using noop:', error)
    return noopMediaSession
  }
}
```

---

## 结论

- 决策：**`defer-with-noop`**
- 原因：通过条件 1、3 未诚实满足；2、4 只说明「将来若做，契约与降级已经就绪」，不能单独批准实现。
- `Feature.md` **保持** `3.1`「macOS：Now Playing / MPRemoteCommandCenter」**未勾选**，并应标注 **「P2 Spike 后仍降级」**。本 Spike **不修改** `Feature.md`（交给后续文档同步；v2.2.0 发布前补这一句备注即可）。
- 不进入 `v2.2.0` 实现任务；亦不必为 `v2.3.0` 预拆实现任务，除非出现下列触发条件之一：
  1. Electron 合并并发布主进程/OS Now Playing 绑定，且可在未签名 mac 构建上无原生模块验证；或
  2. 另开专项：在 **macOS 真机** 上做出可打包的伴生进程或 N-API 原型，写清 CI、签名/公证（仍可选）、进程外崩溃隔离，并再跑一遍四条通过条件。
- 若未来实现：接入点 `src/main/infra/media-session/index.ts` 的 `createMediaSession()`，新增 `mac.ts` 适配器，不改变 renderer/playback 契约。优先评估 **F（Swift 伴生进程）** 而非进程内 Node-API，以便对齐 Windows SMTC 的崩溃隔离；在有 Mac 验收之前，这只是建议，不是承诺。

### 明确不做（对齐 P2.md 非目标）

- 不承诺 macOS Now Playing 在 v2.2.0 落地。
- 不把 Now Playing 列为发布阻断项。
- 本期不新增 native addon、伴生进程、依赖或 Feature 勾选。

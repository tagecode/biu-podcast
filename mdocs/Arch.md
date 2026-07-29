# 博播（BiuPodcast）- 技术架构文档（Architecture Design）

| 项目       | 内容                                                                                                                 |
| ---------- | -------------------------------------------------------------------------------------------------------------------- |
| 产品名称   | 博播 BiuPodcast（`biu-podcast`）                                                                                     |
| 文档版本   | v1.0                                                                                                                 |
| 更新日期   | 2026-07-28                                                                                                           |
| 状态       | Draft — 待评审                                                                                                       |
| 关联文档   | [`mdocs/Prd.md`](./Prd.md)（产品需求文档，本架构文档的需求输入）、[`mdocs/Feature.md`](./Feature.md)（功能条目清单） |
| 技术栈基线 | Electron + Vite + React 19 + TypeScript + shadcn/ui + Tailwind CSS                                                   |
| 面向读者   | 客户端开发工程师、QA、后续维护者                                                                                     |

---

## 1. 文档目的与范围

本文档承接 [`Prd.md`](./Prd.md) 中定义的产品目标与功能需求，给出 **博播（BiuPodcast）** 的技术实现方案：技术选型、系统分层、进程间协作、数据模型落地、核心子系统设计、测试策略与工程规范。目标是让任何工程师在阅读本文档后，能够清楚回答：

- 代码该放在哪个目录、属于哪一层；
- 一个新功能从渲染进程到主进程再到磁盘/网络的完整链路长什么样；
- 为什么这么设计（架构决策的取舍依据）；
- 如何为这段代码写单元测试、集成测试、E2E 测试，测试放在哪里、用什么工具跑。

本文档不重复 PRD 中的产品叙事与优先级划分，只在必要处引用 PRD 章节号。技术选型以现有仓库的 `package.json` / `electron-builder.yml` / `tsconfig*.json` 为基线并向后兼容演进，不推翻现有工程配置。

---

## 2. 架构目标与约束（源自 PRD 四大原则）

| 原则              | 对架构的硬约束                                                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Feature-first** | 代码组织以功能域（订阅、播放、下载、笔记……）为第一维度，而非"controllers/services/models"这类技术分层维度；每个功能域内部才按技术层次（UI / 状态 / IPC / 数据）二次切分                     |
| **Offline-first** | 任何 UI 渲染路径不得对网络请求做同步阻塞式依赖；数据读取默认来自本地 SQLite，网络请求只用于"刷新/发现"类动作，且必须有独立的加载态与失败态，不拖垮已有数据展示                              |
| **Local-first**   | 唯一权威数据源是本机 SQLite + 文件系统；不存在"云端为准、本地为缓存"的反向依赖关系；导入导出链路必须覆盖 100% 用户数据域                                                                    |
| **Desktop-only**  | 不引入任何以移动端/触屏为第一优先的框架假设（如手势库），UI 组件选型以鼠标+键盘+桌面窗口范式为基线；三端（Win/macOS/Linux）差异通过适配层收敛，不允许业务代码内散落 `process.platform` 分支 |

此外，架构层面追加以下工程目标：

- **可测试性优先**：所有跨层调用（渲染进程 → IPC → 主进程 → 数据/网络）都必须有清晰的契约边界，使得每一层可以独立 mock、独立测试；
- **渐进式复杂度**：MVP（P0）阶段不过度设计，但接口与数据模型需为 P1/P2 阶段的能力（播放列表、云同步、多语言）预留扩展点，避免后续推倒重来；
- **单一数据流向**：UI 状态变更 → 触发 IPC 调用 → 主进程写库 → 主进程广播变更事件 → 渲染进程状态更新，禁止渲染进程直接持有"事实数据"的第二份拷贝而不经广播同步。

---

## 3. 技术栈总览

### 3.1 现有基线（已在仓库中）

| 类别            | 选型                                                       | 版本基线 | 来源                   |
| --------------- | ---------------------------------------------------------- | -------- | ---------------------- |
| 桌面应用框架    | Electron                                                   | ^39      | `package.json`         |
| 构建工具        | electron-vite + Vite                                       | ^5 / ^7  | `package.json`         |
| UI 框架         | React                                                      | ^19.2    | `package.json`         |
| 语言            | TypeScript                                                 | ^5.9     | `package.json`         |
| 打包            | electron-builder                                           | ^26      | `electron-builder.yml` |
| 自动更新        | electron-updater                                           | ^6.3     | `package.json`         |
| Electron 工具集 | @electron-toolkit/{preload,utils,eslint-config-*,tsconfig} | ^3～^4   | `package.json`         |
| 包管理器        | pnpm                                                       | —        | `pnpm-lock.yaml`       |

### 3.2 新增技术栈（本文档引入）

| 类别                        | 选型                                                       | 说明                                                                                                                                                                                           |
| --------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI 组件库                   | **shadcn/ui**                                              | 非运行时依赖的组件源码生成方案（CLI 拷贝源码到 `src/renderer/src/components/ui`），基于 Radix UI Primitives + Tailwind CSS，可完全掌控样式与无障碍实现，符合 Local-first"不锁定黑盒"的工程哲学 |
| 原子化 CSS                  | **Tailwind CSS v4**                                        | 通过 `@tailwindcss/vite` 插件接入 Vite，CSS-first 配置（`@theme` 指令），与 shadcn/ui v4 版本对齐                                                                                              |
| 无障碍原语                  | **Radix UI Primitives**                                    | shadcn/ui 的底层依赖，提供无障碍、无样式的交互组件（Dialog、DropdownMenu、Slider 等），契合 6.6 章无障碍需求                                                                                   |
| 图标                        | **lucide-react**                                           | shadcn/ui 官方推荐图标库                                                                                                                                                                       |
| 样式辅助                    | `class-variance-authority`、`tailwind-merge`、`clsx`       | shadcn/ui 组件变体（variant）与类名合并的标准配套                                                                                                                                              |
| 状态管理（渲染进程）        | **Zustand**                                                | 轻量、无 Provider 嵌套负担，天然契合 Feature-first（每个功能域一个 slice/store），对 React 19 并发特性兼容良好                                                                                 |
| 服务端状态/异步缓存         | **TanStack Query**（可选，P1 引入）                        | 用于封装"经 IPC 获取的数据"的加载态/缓存/重试逻辑，替代手写 loading/error 样板代码                                                                                                             |
| 主进程本地数据库            | **better-sqlite3**                                         | 同步 API、性能优异，天然适合 Electron 主进程单线程模型，避免异步 SQLite 驱动带来的竞态复杂度                                                                                                   |
| ORM / 查询构建              | **Drizzle ORM**（+ `drizzle-kit` 做 migration）            | 类型安全、SQL-first、零运行时反射开销，migration 文件可读可审查，契合"数据可迁移"的 Local-first 要求                                                                                           |
| HTTP 客户端                 | **ky** 或 **原生 fetch（undici）**                         | 主进程发起 Feed 拉取/下载请求；不使用 axios 以减少依赖体积（Node 18+ 内置 fetch 已足够，复杂重试逻辑用轻量封装）                                                                               |
| RSS/Atom 解析               | **rss-parser**                                             | 社区成熟方案，支持自定义命名空间字段（用于解析 `<podcast:chapters>` 等播客专属标签）                                                                                                           |
| 配置/轻量存储               | **electron-store**                                         | 存放 `AppSettings` 单例配置、窗口状态记忆等非关系型数据                                                                                                                                        |
| 全局快捷键/托盘/窗口        | Electron 内置 `globalShortcut` / `Tray` / `BrowserWindow`  | 无需三方包，见 PRD 10.2 节                                                                                                                                                                     |
| 国际化                      | **i18next** + **react-i18next**                            | 多语言（P1）                                                                                                                                                                                   |
| 表单校验 / IPC Payload 校验 | **zod**                                                    | 定义 IPC 契约的输入输出 schema，运行时校验 + 编译期类型推导双重保障                                                                                                                            |
| 单元/集成测试               | **Vitest**                                                 | 与 Vite 生态原生集成，渲染进程用 `jsdom` 环境，主进程模块用 `node` 环境，共享一套 test runner                                                                                                  |
| 组件测试                    | **@testing-library/react** + `@testing-library/user-event` | 面向用户行为断言，不测实现细节                                                                                                                                                                 |
| API Mock                    | **MSW (Mock Service Worker)**                              | mock RSS Feed 请求、播客目录 API 请求                                                                                                                                                          |
| E2E 测试                    | **Playwright**（`_electron` API）                          | 直接驱动打包后的 Electron 应用做端到端用户旅程测试                                                                                                                                             |
| 覆盖率                      | **v8 coverage（Vitest 内置）**                             | 无需额外安装 istanbul，Vite/Vitest 原生支持                                                                                                                                                    |

> 选型原则：优先选择与 Vite/Vitest 生态原生集成、类型安全、无过度运行时开销的方案；凡是"新增一个包能省 100 行样板代码，但增加的心智负担 > 收益"的候选（如引入完整状态机库、完整 ORM 框架）一律不选。

### 3.3 依赖新增清单（供 `package.json` 落地参考）

```jsonc
// dependencies（渲染进程 UI 相关）
"tailwindcss": "^4",
"@tailwindcss/vite": "^4",
"class-variance-authority": "^0.7",
"clsx": "^2",
"tailwind-merge": "^2",
"lucide-react": "^0.4XX",
"@radix-ui/react-*": "按 shadcn/ui add 命令生成时自动引入",
"zustand": "^5",
"@tanstack/react-query": "^5",           // P1 引入
"i18next": "^24",
"react-i18next": "^15",

// dependencies（主进程数据/网络相关）
"better-sqlite3": "^11",
"drizzle-orm": "^0.3X",
"rss-parser": "^3",
"electron-store": "^10",
"zod": "^4",

// devDependencies（测试与工程）
"vitest": "^3",
"@vitest/coverage-v8": "^3",
"@testing-library/react": "^16",
"@testing-library/user-event": "^14",
"@testing-library/jest-dom": "^6",
"jsdom": "^25",
"msw": "^2",
"@playwright/test": "^1",
"drizzle-kit": "^0.3X"
```

---

## 4. 总体架构

### 4.1 进程模型

沿用 Electron 标准三进程模型，职责严格分离，渲染进程不直接触碰 Node.js/文件系统/网络 API：

```
┌──────────────────────────────────────────┐
│              渲染进程 Renderer              │
│  React 19 + shadcn/ui + Tailwind CSS       │
│  - Feature-first 组件与状态（Zustand）       │
│  - 仅通过 window.api.* 调用受限 IPC 接口     │
└───────────────────┬────────────────────────┘
                     │  contextBridge 暴露的类型化 API
┌────────────────────▼───────────────────────┐
│                 Preload 脚本                 │
│  - 唯一的信任边界，白名单式暴露 IPC 通道       │
│  - 不包含业务逻辑，仅做 invoke/on 的薄封装     │
└────────────────────┬───────────────────────┘
                     │  ipcMain.handle / webContents.send
┌────────────────────▼───────────────────────┐
│                  主进程 Main                 │
│  - 窗口/托盘/菜单/全局快捷键/深链接           │
│  - Feature Modules（订阅/播放/下载/笔记...）  │
│  - Repository 层（Drizzle + better-sqlite3） │
│  - 下载队列 / Feed 请求 / RSS 解析            │
│  - 系统媒体会话集成 / 自动更新                 │
└──────────────────────────────────────────────┘
```

### 4.2 分层视图（贯穿主进程与渲染进程）

```
┌───────────────────────────── 渲染进程 ─────────────────────────────┐
│  UI 层        features/*/components  （shadcn/ui 组件拼装）         │
│  状态层        features/*/store.ts    （Zustand slice）             │
│  数据访问层     features/*/api.ts      （对 window.api.* 的类型化封装）│
└──────────────────────────────┬───────────────────────────────────┘
                                │ IPC 契约（zod schema 定义，双端共享类型）
┌──────────────────────────────▼───────────────────────────────────┐
│  IPC 处理层     main/ipc/*.handler.ts （ipcMain.handle 注册点）      │
│  应用服务层     main/features/*/service.ts （业务编排、事务边界）      │
│  仓储层        main/features/*/repository.ts （Drizzle 查询）        │
│  基础设施层     main/infra/{db,fs,net,media-session,updater}         │
└─────────────────────────────── 主进程 ─────────────────────────────┘
```

- **UI 层**只负责渲染与交互事件绑定，不含业务规则；
- **状态层**持有"当前功能域的本地内存状态"，是主进程数据的镜像/衍生态，不是权威数据源；
- **数据访问层**（渲染进程侧）把 `window.api.subscription.add(url)` 这类调用封装为强类型函数，UI 层不直接 import `window.api`；
- **IPC 处理层**只做入参校验（zod）与出参序列化，不写业务逻辑；
- **应用服务层**编排具体业务流程（如"添加订阅"需要：请求 Feed → 解析 → 查重 → 落库 → 触发通知），事务边界在这一层声明；
- **仓储层**只做 SQL 查询构建与执行，不感知业务规则；
- **基础设施层**封装与操作系统/网络交互的底层能力，供应用服务层组合调用。

---

## 5. 目录结构（Feature-first）

```
biu-podcast/
├─ mdocs/                          # 产品/架构文档（Feature.md / Prd.md / Arch.md）
├─ resources/                      # 应用图标等静态资源
├─ build/                          # 打包资源（图标、entitlements）
├─ drizzle/                        # Drizzle migration 文件（SQL 迁移脚本，版本化）
├─ tests/
│  ├─ e2e/                         # Playwright E2E 用例
│  └─ fixtures/                    # 跨测试共享的 fixture（示例 RSS XML、OPML 文件等）
├─ src/
│  ├─ main/                        # 主进程
│  │  ├─ index.ts                  # 入口：创建窗口、注册生命周期
│  │  ├─ ipc/                      # IPC 处理层，按功能域拆分 handler 文件
│  │  │  ├─ subscription.handler.ts
│  │  │  ├─ episode.handler.ts
│  │  │  ├─ playback.handler.ts
│  │  │  ├─ download.handler.ts
│  │  │  ├─ note.handler.ts
│  │  │  ├─ playlist.handler.ts
│  │  │  ├─ data-portability.handler.ts   # 导入导出/备份
│  │  │  └─ settings.handler.ts
│  │  ├─ features/                 # 应用服务层 + 仓储层，按功能域组织
│  │  │  ├─ subscription/
│  │  │  │  ├─ subscription.service.ts
│  │  │  │  ├─ subscription.repository.ts
│  │  │  │  └─ feed-parser.ts
│  │  │  ├─ episode/
│  │  │  ├─ playback/
│  │  │  ├─ download/
│  │  │  │  ├─ download-queue.ts
│  │  │  │  └─ download.repository.ts
│  │  │  ├─ note/
│  │  │  ├─ playlist/
│  │  │  └─ data-portability/
│  │  ├─ infra/                    # 基础设施层
│  │  │  ├─ db/
│  │  │  │  ├─ client.ts           # better-sqlite3 + drizzle 初始化
│  │  │  │  ├─ schema.ts           # Drizzle schema 定义
│  │  │  │  └─ migrate.ts          # 启动时自动迁移
│  │  │  ├─ fs/                    # 文件路径管理、原子写入
│  │  │  ├─ net/                   # 网络状态感知、HTTP 封装
│  │  │  ├─ media-session/         # SMTC / MPRIS / Now Playing 适配
│  │  │  ├─ tray/
│  │  │  ├─ window/                # 窗口状态记忆、单实例锁定
│  │  │  ├─ protocol/              # 深链接协议注册
│  │  │  ├─ updater/               # electron-updater 封装
│  │  │  └─ logger/                # 结构化日志
│  │  └─ shared/                   # 主进程内部共享的类型/常量
│  ├─ preload/
│  │  ├─ index.ts                  # contextBridge 暴露入口
│  │  └─ index.d.ts
│  ├─ shared/                      # 主进程与渲染进程都需要的类型定义（唯一真源）
│  │  ├─ ipc-contract.ts           # 每个 IPC 通道的 zod schema + 类型导出
│  │  └─ types.ts                  # Podcast/Episode/Playlist 等领域类型
│  └─ renderer/
│     ├─ index.html
│     └─ src/
│        ├─ main.tsx
│        ├─ app/
│        │  ├─ App.tsx             # 顶层布局（侧边栏 + 内容区 + 迷你播放器）
│        │  ├─ providers/          # ThemeProvider / QueryClientProvider / I18nProvider
│        │  └─ router.tsx          # 视图导航（见 7.4 节）
│        ├─ components/
│        │  └─ ui/                 # shadcn/ui 生成的基础组件（Button/Dialog/Slider...）
│        ├─ features/               # 与主进程 features/ 一一对应，按功能域组织
│        │  ├─ subscription/
│        │  │  ├─ components/
│        │  │  ├─ store.ts
│        │  │  ├─ api.ts
│        │  │  └─ hooks/
│        │  ├─ episode/
│        │  ├─ playback/
│        │  ├─ download/
│        │  ├─ note/
│        │  ├─ playlist/
│        │  ├─ search/
│        │  └─ settings/
│        ├─ lib/                   # 工具函数（cn(), 日期格式化, 时长格式化）
│        └─ assets/
├─ package.json
├─ electron.vite.config.ts
├─ electron-builder.yml
├─ components.json                 # shadcn/ui 配置
├─ tailwind.config.ts               # 如需 JS 侧配置（Tailwind v4 优先 CSS-first，此文件按需保留）
└─ vitest.config.ts / vitest.workspace.ts
```

**Feature-first 落地规则**：

1. 渲染进程 `features/<domain>/` 与主进程 `features/<domain>/` 命名一一对应，便于按功能定位全链路代码；
2. 每个功能域目录下必须包含对应的 `*.test.ts(x)`（就近存放，不集中在顶层 `__tests__/`）；
3. `src/shared/` 是唯一允许跨进程 import 的目录（仅类型与常量，不含运行时逻辑），保证主进程/渲染进程类型同源；
4. 禁止渲染进程 `features/a` 直接 import `features/b` 的内部实现（`store.ts`/`api.ts` 内部函数），跨功能域协作通过顶层 `app/` 编排或事件订阅完成。

---

## 6. 渲染进程架构

### 6.1 UI 组件体系：shadcn/ui + Tailwind CSS

- **接入方式**：使用 `shadcn` CLI（`npx shadcn@latest init`）生成 `components.json`，按需 `npx shadcn@latest add button dialog slider ...` 将组件源码拷贝进 `src/renderer/src/components/ui/`。这些组件**是项目自身源码**，可以直接改，不是黑盒依赖，符合 Local-first"数据与代码都不被锁定"的精神；
- **主题系统**：Tailwind v4 使用 CSS 变量 + `@theme` 定义设计令牌（颜色、圆角、间距），配合 shadcn/ui 的 `light`/`dark` 两套 CSS 变量集合，实现 PRD 7.2 节"夜间模式/深色主题"；主题切换状态存入 `AppSettings`（经 IPC 持久化到主进程 `electron-store`），刷新/重启后保持一致；
- **组件分层**：
  - `components/ui/`：shadcn/ui 原始组件（Button、Dialog、DropdownMenu、Slider、Toast 等），不含业务语义；
  - `features/*/components/`：业务组件（`SubscriptionCard`、`EpisodeList`、`PlayerBar`），组合 `ui/` 基础组件与业务状态；
  - `app/`：页面级布局组件（侧边栏、顶部工具栏、迷你播放器常驻区）。
- **无障碍**：Radix UI Primitives 默认提供键盘导航、焦点管理、ARIA 属性，直接满足 PRD 8.6 节无障碍需求的底层基础，业务层仅需保证自定义交互（如自定义进度条）补充等效的键盘操作与 `aria-label`。

### 6.2 状态管理：Zustand + 分层职责

| 状态类型                                          | 存放位置                                                                                     | 示例                                        |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 权威业务数据（订阅、集数、下载记录等）            | 主进程 SQLite，渲染进程通过 IPC 拉取后缓存在对应 feature 的 Zustand store 中，作为"只读镜像" | `useSubscriptionStore`                      |
| 纯 UI 交互状态（弹窗开关、当前选中项、表单草稿）  | 组件本地 `useState` 或功能域 Zustand store 中的 UI slice                                     | `isAddDialogOpen`                           |
| 跨功能域的全局态（当前播放器状态、网络在线/离线） | 顶层 `app/store/` 下的全局 store，供多个功能域订阅                                           | `usePlaybackStore`、`useNetworkStatusStore` |
| 异步请求的加载态/错误态/缓存（P1 起）             | TanStack Query，key 以 `[domain, action, params]` 命名                                       | `useQuery(['episodes', podcastId])`         |

**数据流向铁律**：渲染进程的 Zustand store **不是**数据的第二权威来源——任何写操作必须先经 IPC 写入主进程数据库成功后，主进程再通过 `webContents.send` 广播变更事件，渲染进程订阅该事件后才更新 store（乐观更新场景需在失败时回滚）。这保证多个视图（如迷你播放器与全屏播放器）看到的状态永远一致，且应用崩溃重启后可完全从主进程数据重建 UI 状态。

### 6.3 IPC 调用封装（渲染进程侧 `api.ts`）

每个功能域的 `features/<domain>/api.ts` 是渲染进程与 `window.api.<domain>.*` 之间的唯一桥梁：

```ts
// src/renderer/src/features/subscription/api.ts
import type { AddSubscriptionInput, Subscription } from '@shared/types'

export const subscriptionApi = {
  add: (input: AddSubscriptionInput): Promise<Subscription> => window.api.subscription.add(input),
  list: (): Promise<Subscription[]> => window.api.subscription.list(),
  onChanged: (cb: (subs: Subscription[]) => void) => window.api.subscription.onChanged(cb) // 返回取消订阅函数
}
```

组件与 store 只与 `subscriptionApi` 交互，从不直接访问 `window.api`，这层封装同时是测试时最自然的 mock 边界（见第 12 章）。

### 6.4 视图导航

桌面应用不需要浏览器地址栏语义，因此不引入 React Router 这类重量方案，改用轻量的**内存态导航**：

- 顶层 `app/store/navigation.ts`（Zustand）维护 `currentView`（如 `subscriptions | podcast-detail | playlists | settings`）与必要参数（如 `podcastId`）；
- `App.tsx` 根据 `currentView` 渲染对应 `features/*/pages/` 组件，类似简易路由但无 URL 依赖；
- **例外**：深链接协议（`biu-podcast://podcast/<id>`）唤起时，主进程解析协议参数后通过 IPC 通知渲染进程直接 `setView('podcast-detail', { podcastId })`，无需真正的 URL 路由系统。

### 6.5 国际化（P1）

- `i18next` 初始化时探测系统语言（`app.getLocale()`，主进程通过 IPC 提供），资源文件 `locales/{zh-CN,en-US}/*.json` 按功能域拆分（`subscription.json`、`playback.json`），避免单一巨大翻译文件；
- 日期/时长/文件大小格式化统一走 `src/renderer/src/lib/format.ts`，内部使用 `Intl.DateTimeFormat` / `Intl.NumberFormat`，随语言环境自动本地化（对应 PRD 8.5 节）。

---

## 7. 主进程架构

### 7.1 模块划分

| 模块                     | 职责                                       | 关键文件                          |
| ------------------------ | ------------------------------------------ | --------------------------------- |
| Bootstrap                | 应用生命周期、单实例锁定、窗口创建         | `main/index.ts`                   |
| Window                   | 窗口状态记忆、多显示器越界保护             | `main/infra/window/`              |
| Tray                     | 托盘图标、右键菜单、播放状态同步           | `main/infra/tray/`                |
| Menu                     | 原生应用菜单（File/Edit/View/Window/Help） | `main/infra/menu/`                |
| Protocol                 | 自定义协议注册与解析（`biu-podcast://`）   | `main/infra/protocol/`            |
| GlobalShortcut           | 全局快捷键注册与释放                       | `main/infra/shortcut/`            |
| MediaSession             | SMTC / MPRIS / Now Playing 适配            | `main/infra/media-session/`       |
| DB                       | SQLite 连接、Drizzle schema、启动迁移      | `main/infra/db/`                  |
| Net                      | 网络状态感知、HTTP 封装、重试策略          | `main/infra/net/`                 |
| Logger                   | 结构化日志（可关闭）                       | `main/infra/logger/`              |
| Updater                  | electron-updater 封装、更新事件转发        | `main/infra/updater/`             |
| Subscription Service     | 订阅增删改查、Feed 解析编排、OPML 导入导出 | `main/features/subscription/`     |
| Episode Service          | 集数列表、已听状态、章节解析               | `main/features/episode/`          |
| Playback Service         | 播放进度持久化、播放队列状态               | `main/features/playback/`         |
| Download Service         | 下载队列调度、断点续传、完整性校验         | `main/features/download/`         |
| Playlist Service         | 播放列表 CRUD                              | `main/features/playlist/`         |
| Note Service             | 时间戳笔记 CRUD、导出                      | `main/features/note/`             |
| Data Portability Service | 全量导入导出、备份/恢复                    | `main/features/data-portability/` |
| Settings Service         | 应用设置读写                               | `main/features/settings/`         |

### 7.2 IPC 契约设计

所有 IPC 通道在 `src/shared/ipc-contract.ts` 中集中声明，双端共享同一份类型与 zod schema，避免"渲染进程以为传的是 `string`，主进程按 `number` 解析"这类隐性契约漂移：

```ts
// src/shared/ipc-contract.ts
import { z } from 'zod'

export const AddSubscriptionInput = z.object({
  feedUrl: z.string().url()
})
export type AddSubscriptionInput = z.infer<typeof AddSubscriptionInput>

export const IPC_CHANNELS = {
  subscription: {
    add: 'subscription:add',
    list: 'subscription:list',
    remove: 'subscription:remove',
    changed: 'subscription:changed' // 主 -> 渲染，广播事件
  },
  download: {
    enqueue: 'download:enqueue',
    pauseAll: 'download:pause-all',
    progress: 'download:progress' // 主 -> 渲染，高频广播
  }
  // ...其余功能域同理
} as const
```

主进程 handler 注册时对入参做 `schema.parse()` 校验，校验失败返回结构化错误（`{ code, message }`），渲染进程 `api.ts` 层统一 catch 并转换为 UI 可读提示，绝不让 zod 报错堆栈直接展示给用户。

### 7.3 Repository 模式与事务边界

- 每个功能域的 `*.repository.ts` 只暴露"领域动词"方法（`insertPodcast`、`markEpisodePlayed`），内部拼接 Drizzle 查询，不泄漏 SQL 细节给 service 层；
- 涉及多表写入的操作（如"导入 OPML 批量新增播客+分类关系"）在 service 层用 `db.transaction()` 包裹，保证部分失败时整体回滚，不产生半成品数据；
- Repository 层是**单元测试的重点对象**：使用内存 SQLite（`:memory:`）实例化 better-sqlite3，跑真实 SQL 而非 mock，兼顾速度与真实性（详见第 12 章）。

### 7.4 下载队列子系统

```
┌────────────┐   enqueue    ┌───────────────┐   HTTP Range   ┌──────────────┐
│  Download   │ ───────────▶│ Priority Queue │ ─────────────▶│ Temp File(.part)│
│  Service    │              │ (并发数可配置)  │                └──────┬───────┘
└─────┬──────┘              └───────┬───────┘                        │ 完成后
      │ 状态变更广播                   │ progress 事件                    │ 原子 rename
      ▼                             ▼                                 ▼
 渲染进程 UI                    渲染进程进度条                    最终文件 + DB 更新
```

- 下载任务持久化到 `download_tasks` 表，字段含 `progressBytes`（已写入字节数），App 重启后启动时扫描"未完成任务"并基于 `progressBytes` 发起 `Range: bytes=<progressBytes>-` 续传请求；若目标服务器不支持 Range（响应非 206），则清空重新下载并提示用户；
- 下载完成后先写入临时文件（`<episodeId>.part`），通过文件系统的原子重命名操作转正，避免"下载到一半的文件被误判为已下载"；
- 完整性校验：优先使用 Feed 提供的 `length`（Content-Length）比对文件大小，如 Feed 提供 `sha256`/`md5` 等自定义字段则做校验和比对（多数播客 Feed 不提供，故默认按大小校验，字段存在时升级为强校验）。

### 7.5 系统媒体会话集成

`main/infra/media-session/` 提供统一接口 `MediaSessionAdapter`，按平台分发到具体实现：

```ts
interface MediaSessionAdapter {
  setMetadata(meta: { title: string; artist: string; artworkUrl?: string }): void
  setPlaybackState(state: 'playing' | 'paused' | 'stopped'): void
  onCommand(cb: (cmd: 'play' | 'pause' | 'next' | 'previous' | 'seek') => void): void
}
```

- **Windows**：通过 `electron` 尚无原生 SMTC 支持，需引入原生 Node 绑定（如社区 `electron-media-service` 类方案）或调用 Windows Runtime API 的原生模块；作为技术 Spike 任务单独评估（对应 PRD 13 章风险项）；
- **macOS**：`MPRemoteCommandCenter`/`MPNowPlayingInfoCenter` 同样需要原生绑定（`node-mac-media-service` 或自研 native addon）；
- **Linux**：MPRIS 基于 D-Bus，Node 生态有较成熟的纯 JS 实现（如 `mpris-service`），无需原生编译，可作为三端中优先落地的适配。

该模块通过适配器模式隔离平台差异，`Playback Service` 只面向 `MediaSessionAdapter` 接口编程，替换或新增平台实现不影响业务逻辑，也便于在测试中用 in-memory 假实现替代真实系统调用。

---

## 8. Preload 与安全模型

### 8.1 安全基线（发布阻断项，对应 PRD 7.3 节）

| 配置项             | 取值                                                                      | 原因                                                                                                    |
| ------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `contextIsolation` | `true`                                                                    | 隔离渲染进程与 Electron/Node 内部对象，防止原型污染攻击                                                 |
| `nodeIntegration`  | `false`                                                                   | 渲染进程不得直接访问 Node.js API                                                                        |
| `sandbox`          | `true`                                                                    | 渲染进程运行在操作系统级沙箱中，即便存在 XSS 也难以逃逸                                                 |
| CSP                | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'` | 阻止远程脚本注入；`style-src` 因 Tailwind 生成内联样式需放行 `unsafe-inline`，后续可评估 nonce 方案收紧 |
| 远程内容加载       | 禁止 `loadURL` 加载非本地/非受信来源                                      | 集数详情等富文本一律走净化后渲染，不使用 `<webview>` 直接加载第三方页面                                 |

> 现状说明：仓库当前 `src/main/index.ts` 中 `webPreferences.sandbox: false`，属于脚手架默认值，落地开发时**必须**在实现该模块的任务中一并修正为 `true` 并补充回归测试，此项在第 15 章安全清单中再次列出以确保不被遗漏。

### 8.2 Preload 白名单式暴露

`src/preload/index.ts` 只暴露"动词化的领域方法"，不暴露 `ipcRenderer` 本身，避免渲染进程拿到任意通道的收发能力：

```ts
// src/preload/index.ts（示意）
import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc-contract'

const api = {
  subscription: {
    add: (input: AddSubscriptionInput) => ipcRenderer.invoke(IPC_CHANNELS.subscription.add, input),
    list: () => ipcRenderer.invoke(IPC_CHANNELS.subscription.list),
    onChanged: (cb: (subs: Subscription[]) => void) => {
      const listener = (_: unknown, subs: Subscription[]): void => cb(subs)
      ipcRenderer.on(IPC_CHANNELS.subscription.changed, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.subscription.changed, listener)
    }
  }
  // ...其余功能域
}

contextBridge.exposeInMainWorld('api', api)
export type Api = typeof api
```

`Api` 类型导出后在 `src/preload/index.d.ts` 中声明到 `Window` 接口，渲染进程侧获得完整类型提示，杜绝手写字符串通道名导致的拼写错误。

### 8.3 富文本渲染安全

集数描述（HTML）在**主进程**用 `sanitize-html`（或等价库）净化后再通过 IPC 传给渲染进程展示，渲染进程收到的字符串已确保不含 `<script>`/内联事件处理器等风险内容；渲染进程侧使用 `dangerouslySetInnerHTML` 时仅信任经此净化管道处理过的字符串，禁止对任意来源 HTML 直接渲染。

---

## 9. 数据层设计

### 9.1 存储选型落地

| 数据类型                                               | 存储介质                           | 原因                                         |
| ------------------------------------------------------ | ---------------------------------- | -------------------------------------------- |
| 关系型业务数据（订阅、集数、播放列表、笔记、下载记录） | SQLite（better-sqlite3 + Drizzle） | 需要关联查询、事务、索引，是核心数据         |
| 应用配置（主题、语言、默认下载质量等单例设置）         | `electron-store`（JSON 文件）      | 结构简单、无需查询能力，直接键值读写更轻量   |
| 音频文件本体                                           | 文件系统（用户可配置的下载目录）   | 大文件不适合入库，数据库只存路径引用         |
| 封面图片缓存                                           | 文件系统缓存目录 + 数据库存路径    | 同上，且属于"可重建缓存"，纳入"清除缓存"范围 |

### 9.2 Schema 设计（Drizzle，节选核心表）

```ts
// src/main/infra/db/schema.ts
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

export const podcasts = sqliteTable('podcasts', {
  id: text('id').primaryKey(),
  feedUrl: text('feed_url').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  coverUrl: text('cover_url'),
  author: text('author'),
  language: text('language'),
  isPaused: integer('is_paused', { mode: 'boolean' }).notNull().default(false),
  subscribedAt: integer('subscribed_at', { mode: 'timestamp' }).notNull(),
  lastFetchedAt: integer('last_fetched_at', { mode: 'timestamp' }),
  lastFetchStatus: text('last_fetch_status') // 'ok' | 'timeout' | 'parse_error' | 'not_found' | ...
})

export const episodes = sqliteTable('episodes', {
  id: text('id').primaryKey(),
  podcastId: text('podcast_id')
    .notNull()
    .references(() => podcasts.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  descriptionHtml: text('description_html'),
  publishedAt: integer('published_at', { mode: 'timestamp' }).notNull(),
  audioUrl: text('audio_url').notNull(),
  durationSec: integer('duration_sec'),
  fileSizeBytes: integer('file_size_bytes'),
  isPlayed: integer('is_played', { mode: 'boolean' }).notNull().default(false),
  playbackPositionSec: real('playback_position_sec').notNull().default(0),
  isDownloaded: integer('is_downloaded', { mode: 'boolean' }).notNull().default(false),
  localFilePath: text('local_file_path'),
  downloadStatus: text('download_status'), // 'queued' | 'downloading' | 'paused' | 'completed' | 'failed'
  downloadedAt: integer('downloaded_at', { mode: 'timestamp' })
})

export const downloadTasks = sqliteTable('download_tasks', {
  id: text('id').primaryKey(),
  episodeId: text('episode_id')
    .notNull()
    .references(() => episodes.id, { onDelete: 'cascade' }),
  status: text('status').notNull(),
  progressBytes: integer('progress_bytes').notNull().default(0),
  totalBytes: integer('total_bytes'),
  retryCount: integer('retry_count').notNull().default(0),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})

// playlists / playlist_items / notes / categories / podcast_categories 等表结构类似，
// 详见附录数据字典（落地开发时在本文档追加完整 DDL，此处仅示范核心表）
```

- 主键统一使用 `text`（UUID v7 或 ULID，具备时间有序性，便于按创建顺序排序且避免自增 ID 在导入导出/合并场景下的冲突）；
- 所有时间字段统一存 Unix 毫秒时间戳（`integer` + `timestamp` mode），避免时区字符串解析的歧义；
- 外键统一开启 `PRAGMA foreign_keys = ON`，删除播客级联删除其集数、下载记录、笔记等子数据。

### 9.3 迁移策略

- 使用 `drizzle-kit generate` 基于 schema 变更生成 SQL 迁移文件，纳入 `drizzle/` 目录版本控制；
- 应用启动时执行 `main/infra/db/migrate.ts`：先复制当前数据库文件为 `*.bak-<version>`，再执行迁移；迁移过程抛出异常时自动回滚到备份文件并弹出"数据库升级失败，已恢复至升级前状态"提示，绝不让应用带着半迁移的 schema 继续运行（对应 PRD 11.1/11.3 节的硬性要求）；
- 每个正式版本发布前，CI 中运行"取上一个大版本的数据库快照 → 跑本版本迁移 → 校验关键表数据完整性"的迁移回归测试（见第 12.2 节集成测试部分）。

### 9.4 数据导入导出格式

- **导出**：产出一个 `.biubackup`（本质是 zip 容器）文件，内含：
  - `manifest.json`（导出时间、应用版本、schema 版本）
  - `data.json`（订阅、集数元数据、播放进度、播放列表、笔记、设置——不含音频二进制文件本身）
  - 可选 `opml/subscriptions.opml`（同时导出一份标准 OPML，方便被其他播客客户端识别，呼应 PRD 11.1 节"导出格式开放可读"）
- **导入**：解析 `manifest.json` 校验版本兼容性 → 与本地现有数据做 diff → 展示"新增 N 项 / 冲突 M 项"预览 → 用户选择合并或覆盖策略后写入，全程在事务中执行。

---

## 10. 跨平台适配层设计

为遵守"业务代码不得散落 `process.platform` 判断"的约束，所有平台差异收敛到 `main/infra/` 下按能力命名的适配器，对上层暴露统一接口：

| 能力接口              | 实现文件                                 | Windows                                       | macOS                                             | Linux                                              |
| --------------------- | ---------------------------------------- | --------------------------------------------- | ------------------------------------------------- | -------------------------------------------------- |
| `MediaSessionAdapter` | `infra/media-session/{win,mac,linux}.ts` | SMTC 原生绑定                                 | MPRemoteCommandCenter 原生绑定                    | MPRIS（纯 JS，D-Bus）                              |
| `ProtocolRegistrar`   | `infra/protocol/index.ts`                | `app.setAsDefaultProtocolClient` + 注册表校验 | `CFBundleURLTypes`（`electron-builder.yml` 声明） | desktop entry `MimeType`                           |
| `AutoLaunch`          | `infra/autolaunch/index.ts`              | 注册表 Run 键                                 | Login Items                                       | `.desktop` autostart 目录                          |
| `TrayBehavior`        | `infra/tray/index.ts`                    | 任务栏通知区                                  | 菜单栏 + Dock 双入口                              | AppIndicator（检测不支持时降级隐藏托盘功能并提示） |

统一由 `electron-builder.yml` 与运行时 `process.platform` 分支**仅存在于这一层**，业务 service 层只调用适配器接口，单元测试时可用假适配器（no-op 实现）跑通全部业务逻辑而不依赖真实操作系统能力。

---

## 11. 应用更新与发布链路

- `main/infra/updater/` 封装 `electron-updater`：启动后延迟数秒静默检查（避免与冷启动关键路径抢占带宽/CPU），检查结果通过 IPC 广播给渲染进程用于展示"有新版本"提示；
- Windows 走 NSIS 静默下载 + 重启安装；macOS 下载完成后弹出确认对话框，用户确认后再退出重启（Squirrel.Mac 机制）；
- 更新失败（网络中断/签名校验失败）分别捕获 `electron-updater` 的 `error` 事件并映射为用户可读文案，不影响当前版本继续运行；
- 发布物签名：Windows 使用代码签名证书（`electron-builder` 的 `win.certificateFile` 等配置），macOS 使用 `notarize: true` 走 Apple Notarization（当前 `electron-builder.yml` 中为 `notarize: false`，落地上线前必须改为启用并接入签名凭据，此项同时登记在第 15 章安全清单）。

---

## 12. 测试策略

测试是本架构的一等公民，覆盖**单元测试、集成测试、E2E 端到端测试**三层金字塔，外加针对 Local-first/Offline-first 原则的专项测试。总体比例遵循"金字塔"：单元测试数量最多、执行最快；集成测试次之；E2E 数量最少但覆盖最关键的用户旅程。

### 12.1 测试金字塔总览

```
                ▲
               / \        E2E（Playwright + Electron）
              /   \       少而关键：核心用户旅程、跨进程真实链路
             /─────\
            /       \     集成测试（Vitest + 真实 SQLite / MSW）
           /         \    IPC 契约、Repository、下载队列、迁移
          /───────────\
         /             \  单元测试（Vitest + Testing Library）
        /               \ 纯函数、组件、service 业务规则（依赖已 mock）
       /─────────────────\
```

### 12.2 工具与环境配置

| 层级                 | 工具                                                              | 运行环境                          | 覆盖对象                                                                                                                                                                                                                   |
| -------------------- | ----------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 单元测试（渲染进程） | Vitest + `@testing-library/react` + `@testing-library/user-event` | `jsdom`                           | UI 组件行为、Zustand store 纯逻辑、`lib/format.ts` 等工具函数                                                                                                                                                              |
| 单元测试（主进程）   | Vitest                                                            | `node`                            | Service 层业务规则（依赖注入假 Repository/假 Adapter）、Feed 解析纯函数、下载队列调度算法                                                                                                                                  |
| 集成测试             | Vitest                                                            | `node`                            | Repository 层对真实 `:memory:` SQLite 的 CRUD 与事务；IPC handler 端到端（在测试中启动精简版 `ipcMain`/`ipcRenderer` 对，不启动完整 BrowserWindow）；下载队列对接 MSW 模拟的 HTTP 服务器（含断点续传、限速、失败重试路径） |
| E2E 测试             | `@playwright/test` 的 `_electron` API                             | 真实打包/开发构建的 Electron 进程 | 完整用户旅程：添加订阅→播放→下载→重启应用验证状态恢复；断网场景；数据导入导出；三平台各自的安装包基础冒烟（CI 矩阵）                                                                                                       |

`vitest.workspace.ts` 按 renderer / main 拆分两套 project 配置，共享同一份覆盖率汇总：

```ts
// vitest.workspace.ts
export default defineWorkspace([
  {
    test: {
      name: 'renderer',
      environment: 'jsdom',
      include: ['src/renderer/**/*.test.{ts,tsx}'],
      setupFiles: ['src/renderer/src/test/setup.ts']
    }
  },
  {
    test: {
      name: 'main',
      environment: 'node',
      include: ['src/main/**/*.test.ts', 'src/shared/**/*.test.ts']
    }
  }
])
```

### 12.3 单元测试规范

- **就近存放**：`foo.ts` 对应 `foo.test.ts`，与源文件同目录，而非集中在顶层 `__tests__/`；
- **渲染进程组件测试**：只通过 Testing Library 的可访问性查询（`getByRole`、`getByLabelText`）定位元素，不依赖实现细节（如 CSS 类名、组件内部 state），保证重构 UI 实现不破坏测试；
- **Store 测试**：Zustand store 脱离 React 直接测试（`store.getState()` / `store.setState()`），验证 action 触发后的状态转换是否符合预期；
- **主进程 Service 测试**：通过依赖注入传入假的 Repository/Adapter（手写 stub 或 `vi.fn()`），验证业务编排逻辑（如"添加订阅失败时不应调用 repository.insert"），不依赖真实数据库或网络；
- **覆盖率门槛**：核心业务域（订阅、下载、播放进度、数据导入导出）语句覆盖率 ≥ 85%；UI 展示型组件放宽至 ≥ 60%（过度追求纯展示组件的覆盖率投入产出比低）。

### 12.4 集成测试规范

集成测试验证"两个及以上真实模块协作"的正确性，是发现契约不匹配问题的主战场：

- **Repository 集成测试**：每个测试用例在 `:memory:` SQLite 上执行"建表（跑迁移）→ 插入 → 查询/更新 → 断言"，测试结束自动销毁连接，测试间完全隔离，可并行执行；
- **IPC 契约集成测试**：在 Node 测试环境中直接 `require` 主进程的 handler 注册函数，用手写的假 `ipcMain`（记录 `handle` 注册的回调）直接调用该回调并断言返回值/抛出的错误结构，验证 zod 校验、错误码映射是否符合 `ipc-contract.ts` 声明；
- **下载队列集成测试**：用 MSW 启一个本地 mock HTTP 服务器，模拟：正常下载完成、支持 Range 的断点续传、不支持 Range 时的降级重下、连接中断后的重试次数与退避策略、Content-Length 缺失时的兜底处理；
- **数据库迁移集成测试**：预置多个历史版本的 SQLite 快照文件（存于 `tests/fixtures/db-snapshots/`），对每个快照跑最新迁移脚本，断言迁移后关键表的行数与关键字段值不变、无异常抛出；
- **Feed 解析集成测试**：`tests/fixtures/feeds/` 存放真实抓取的、脱敏后的多种 RSS/Atom 样本（含标准 Feed、缺字段 Feed、非 UTF-8 编码 Feed、含 `<podcast:chapters>` 的 Feed），逐一验证解析器的字段提取与容错行为。

### 12.5 E2E 测试规范

- **驱动方式**：`playwright.config.ts` 中使用 `_electron.launch({ args: ['out/main/index.js'] })` 启动打包后的应用，或在 CI 中先 `electron-vite build` 再驱动 `out/` 产物，保证测试的是接近真实发布形态的构建产物，而非开发服务器热更新版本；
- **测试隔离**：每个 E2E 用例启动前将 `userData` 目录指向一个临时目录（通过 `ELECTRON_USER_DATA_PATH` 环境变量注入），避免用例间共享数据库/配置产生污染，用例结束后清理临时目录；
- **网络场景模拟**：借助 MSW（Node 侧拦截）或本地可控的 mock Feed 服务器模拟"正常/超时/断开"三种网络状态，断网场景通过让 mock 服务器返回连接拒绝或直接关闭端口实现，不依赖真实拔网线（保证 CI 环境可重复执行）；
- **关键 E2E 用例清单（对应 PRD 12.2 节场景）**：

  | 用例                                                                        | 覆盖原则              |
  | --------------------------------------------------------------------------- | --------------------- |
  | 输入有效 RSS URL → 成功订阅 → 详情页展示集数列表                            | 核心主链路            |
  | 输入格式错误的 RSS URL → 展示明确错误、不产生脏数据                         | 容错性                |
  | 下载一集 → 断网 → 播放该集验证可正常播放，未下载集数显示"仅元数据"提示      | Offline-first         |
  | 下载中途终止应用进程 → 重启 → 验证任务自动续传而非从零开始                  | 可靠性                |
  | 导出全部数据 → 清空 `userData` → 导入 → 校验订阅/进度/笔记/播放列表完整还原 | Local-first           |
  | 修改主题为深色 → 重启应用 → 验证主题记忆生效                                | 设置持久化            |
  | 三平台（Windows/macOS/Linux）分别验证安装、启动、播放、下载四个基础动作     | Desktop-only + 跨平台 |

- **CI 矩阵**：E2E 测试在 GitHub Actions（或等效 CI）的 `windows-latest` / `macos-latest` / `ubuntu-latest` 三个 runner 上并行执行核心冒烟用例（上表前 6 条 + 每平台的安装启动验证），完整 E2E 套件可仅在单一平台（如 `ubuntu-latest`）全量跑，三平台跑精简冒烟集，兼顾覆盖面与 CI 时长。

### 12.6 专项测试：呼应四大设计原则

| 原则          | 专项测试方式                                                                                                                    | 归属层级                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Offline-first | 集成测试层模拟网络状态切换，断言 UI 状态广播正确；E2E 层验证断网下核心旅程零报错零白屏                                          | 集成 + E2E                               |
| Local-first   | 集成测试验证导入导出的数据完整性（逐字段 diff）；E2E 层验证"导出→清空→导入"全链路                                               | 集成 + E2E                               |
| Feature-first | 通过依赖关系静态检查（如 `dependency-cruiser` 或 ESLint 自定义规则）在 CI 中断言 `features/a` 不得 import `features/b` 内部模块 | 静态分析（非运行时测试，但纳入 CI 门禁） |
| Desktop-only  | 组件测试中使用 `user-event` 模拟纯键盘操作路径，断言核心播放操作无需鼠标/触屏也可完成                                           | 单元/组件测试                            |

### 12.7 测试在 CI 中的门禁顺序

```
lint → typecheck → 单元测试(renderer+main, 并行) → 集成测试 → build → E2E(冒烟, 三平台并行) → 覆盖率报告发布
```

任一阶段失败即阻断合并；覆盖率报告（Vitest v8 provider 生成）作为 PR 检查项展示增量覆盖率变化，防止新增代码悄悄拉低整体覆盖率。

---

## 13. 构建、打包与 CI/CD

- **开发态**：`electron-vite dev` 提供渲染进程 HMR，主进程/preload 变更自动重启 Electron 进程；
- **构建态**：`npm run build`（`typecheck` 门禁 + `electron-vite build`）产出 `out/`；
- **打包态**：`electron-builder` 依据 `electron-builder.yml` 分别产出 Windows NSIS、macOS DMG、Linux AppImage/deb/snap；
- **CI 流水线阶段**（建议 GitHub Actions，三平台 matrix）：
  1. `pnpm install`（含 `postinstall` 触发 `electron-builder install-app-deps` 重建原生模块如 `better-sqlite3`）；
  2. `pnpm lint` + `pnpm typecheck`；
  3. `pnpm test:unit` + `pnpm test:integration`（renderer + main 并行）；
  4. `pnpm build`；
  5. `pnpm test:e2e:smoke`（三平台并行冒烟）；
  6. 打 tag 触发 `build:win` / `build:mac` / `build:linux`，产物上传至 `publish.provider: generic` 指向的静态文件托管，供 `electron-updater` 拉取。
- **原生模块（`better-sqlite3`）跨平台注意事项**：CI 各平台 runner 上分别执行 `electron-builder install-app-deps` 重新编译原生绑定，禁止跨平台复用 `node_modules` 缓存中的预编译二进制。

---

## 14. 可观测性（日志与诊断）

对应 PRD 11.5 节，日志系统设计为**默认开启基础日志、可一键关闭详细日志、可导出诊断包**：

- `main/infra/logger/` 提供分类日志：`feed`（Feed 刷新成功/失败/耗时）、`download`（任务生命周期）、`playback`（播放错误）、`app`（生命周期/崩溃）；
- 日志落地为本机滚动文件（如按天/按大小切分，保留最近 N 份），不上传任何远程服务；
- 设置中的"诊断日志开关"控制日志详细级别（关闭时仅保留 `error` 级别，用于故障定位的最小信息量）；
- "一键导出诊断信息"打包最近若干条日志 + 应用版本/操作系统信息 + 数据库健康检查结果为一个 zip，用户确认后另存到自选路径，不自动发送到任何网络端点。

---

## 15. 安全清单（发布前必须逐项确认）

- [x] `webPreferences.sandbox` 设为 `true`（当前脚手架默认值为 `false`，需在实现阶段修正）
- [x] `contextIsolation: true`、`nodeIntegration: false` 已生效并有回归测试覆盖
- [x] CSP 头已配置且移动到生产环境仍生效（非仅开发环境注入）
- [x] 集数描述 HTML 已经过服务端（主进程）净化后才传给渲染进程
- [ ] 私有 Feed 凭据、云备份凭据使用系统级安全存储（Keychain/Credential Manager/libsecret），不明文写入 `electron-store`
- [ ] macOS 构建 `notarize` 从 `false` 改为真实签名配置并验证 Gatekeeper 放行（配置位已预留，见 `electron-builder.yml` / README）
- [ ] Windows 构建接入代码签名证书（CSC 环境变量说明已预留）
- [ ] 深链接协议处理函数对外部传入参数做合法性校验，防止恶意构造的 `biu-podcast://` URL 触发非预期行为
- [ ] 依赖包定期跑 `pnpm audit` / Dependabot，第三方原生模块版本锁定并记录来源

---

## 16. 性能优化要点

- **列表渲染**：订阅列表、集数列表使用虚拟滚动（如 `@tanstack/react-virtual`）应对大规模数据（PRD 7.1 节 10 万集场景）；
- **数据库查询**：高频查询字段（`podcast_id`、`is_downloaded`、`published_at`）建立索引；分页查询使用基于游标（`publishedAt` + `id`）而非 `OFFSET`，避免深分页性能衰减；
- **图片资源**：封面图统一走本地缓存 + 懒加载，避免列表滚动时并发大量网络请求；
- **主进程非阻塞**：Feed 请求、下载、大规模数据导入导出均为异步操作，避免阻塞主进程事件循环进而卡死整个应用（Electron 主进程仍是单线程，重计算型任务如有必要可评估 `utilityProcess`/`worker_threads` 拆分）；
- **启动性能**：数据库迁移检查、窗口创建、渲染进程加载并行化，非关键路径（如更新检查、图标缓存清理）延迟到 `ready-to-show` 之后执行。

---

## 17. 编码规范与工程约定

- **语言与风格**：遵循仓库现有 `eslint.config.mjs` + `.prettierrc.yaml` 配置，不引入与之冲突的第二套规范；
- **类型安全**：`src/shared/` 下的类型是唯一真源，禁止主进程/渲染进程各自重复定义同名但结构不同的类型；
- **提交规范**：功能开发遵循"一个 PR 对应一个 Feature-first 目录下的完整闭环（UI + 状态 + IPC + Repository + 对应层级测试）"，避免"UI 先行、测试后补"的技术债堆积；
- **文档同步**：本文档（`Arch.md`）随架构演进更新；涉及功能范围变化需同步 `Prd.md`/`Feature.md`，三份文档保持一致是评审通过的前提之一。

---

## 18. 风险与技术决策待定项（ADR 候选）

| 事项                                                    | 现状                                                               | 需要的决策                                          |
| ------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------- |
| SMTC/MPRIS/Now Playing 的具体实现方式                   | 社区方案成熟度、原生编译维护成本未验证                             | 需一次技术 Spike，产出独立 ADR 确定是否自研原生模块 |
| 云同步冲突解决策略（P2）                                | PRD 未定案，本文档未展开                                           | 待 P2 排期前专项设计，输出独立子文档                |
| 是否引入 TanStack Query                                 | 当前定为 P1 引入，MVP 阶段用 Zustand + 手写 loading 态即可         | 视 MVP 阶段实际样板代码量决定是否提前引入           |
| Tailwind v4 CSS-first 配置 vs 保留 `tailwind.config.ts` | v4 推荐纯 CSS 配置，但项目可能需要 JS 侧读取设计令牌（如图表配色） | 落地时按是否有 JS 侧读取需求决定保留与否            |

---

## 附录

- 本文档的分层设计与 [`Prd.md`](./Prd.md) 第 8、9 章一脉相承，数据模型为其具体化落地；
- 功能条目级别的验收对照仍以 [`Feature.md`](./Feature.md) 为准；
- 后续应产出的配套文档：《IPC 契约详细规范》《数据库完整 DDL 与索引设计》《SMTC/MPRIS Spike 报告》，均作为本文档的子文档单独维护，本文档保持"总纲"定位，不随实现细节频繁变动。

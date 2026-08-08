# 博播（BiuPodcast）- MVP 开发任务拆解

| 项目     | 内容                                                                                                                                                                                |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 产品名称 | 博播 BiuPodcast（`biu-podcast`）                                                                                                                                                    |
| 文档版本 | v1.1                                                                                                                                                                                |
| 更新日期 | 2026-07-29                                                                                                                                                                          |
| 状态     | MVP 工程闭环（方案 B）— 功能主链路已交付；覆盖率门禁已接入（全局 ≥85%）；Playwright E2E 已接入；代码签名为可选增强项；详见 [`Mvp-Acceptance-Report.md`](./Mvp-Acceptance-Report.md) |
| 关联文档 | [`mdocs/Prd.md`](./Prd.md)（需求来源，§5.1 P0 范围）、[`mdocs/Feature.md`](./Feature.md)（功能条目对照）、[`mdocs/Arch.md`](./Arch.md)（技术方案，任务的目录结构/分层依据）         |
| 文档定位 | 把 PRD §5.1 的 MVP 范围拆解为**可独立开发、可独立验收**的任务清单，供排期与逐项验收使用                                                                                             |

---

## 1. MVP 目标与范围边界

### 1.1 一句话目标

交付一个**离线优先、数据本地、无需账号**的最小闭环：用户能添加 RSS 订阅、浏览集数、播放、下载到本地离线播放，所有数据持久化在本机且可完整导出/导入，应用具备桌面端基本形态（可安装、单实例、窗口状态记忆）与基础的崩溃恢复能力。

### 1.2 范围判定依据

沿用 PRD §5.1 的判定标准：**是否位于"添加订阅 → 浏览 → 播放 → 离线可用 → 数据不丢"这条主链路上**。本文档在此基础上做工程化拆解，额外补充了 PRD 未展开但 MVP 必须具备的"地基类"任务（工程脚手架、数据库基座、IPC 安全基线），因为没有这些，任何一条功能都无法落地。

### 1.3 MVP 范围内（IN）

对照 PRD §5.1 与 `Feature.md`：

- 订阅管理：RSS 添加/解析/去重、订阅列表基础排序搜索、取消订阅、手动刷新
- 播客内容浏览：播客详情页、集数列表（已听/已下载状态）
- 音频播放：播放/暂停/上下集/进度拖拽/时间显示、迷你播放器 + 全屏播放器
- 离线下载：单集下载、下载队列（暂停/继续/取消）、断点续传、已下载内容离线播放
- 本地数据：SQLite 落地全部核心数据、完整导出/导入（JSON/zip）
- 错误恢复：App 重启恢复播放进度、下载断点续传、Feed 拉取失败提示
- 桌面基础：单实例锁定、窗口状态记忆、原生菜单
- 安全与发布基线：渲染进程安全配置（`contextIsolation`/`sandbox`/`nodeIntegration`）、代码签名配置占位（可选）

### 1.4 MVP 范围外（OUT，明确推迟到 P1/P2）

OPML 导入导出、播放列表、变速播放、睡眠定时器、系统托盘、系统媒体控件集成（SMTC/MPRIS/Now Playing）、全局快捷键、深链接协议、自动更新、多语言、深色模式、笔记功能、播客目录搜索、云同步、隐身模式、无障碍深化。**这些任务不在本文档中展开**，避免 MVP 阶段范围蔓延；它们将在 P1 阶段产出独立的任务拆解文档。

> 判断一个任务该不该收进本文档的简单测试：去掉它，"添加订阅→播放→离线可用→数据不丢"这条链路是否仍然完整可跑通？完整则推迟，缺一环则收入 MVP。

---

## 2. Epic 总览

MVP 拆分为 10 个 Epic，按依赖关系大致分为三个阶段：**地基（E0-E2）→ 核心功能（E3-E6）→ 收尾与发布（E7-E9）**。Epic 内的任务允许并行开发，但 Epic 之间存在强依赖，见第 3 章顺序图。

| Epic | 名称               | 任务数 | 依赖   | 对应 Arch.md 章节               |
| ---- | ------------------ | ------ | ------ | ------------------------------- |
| E0   | 工程基础设施       | 6      | 无     | §3, §17                         |
| E1   | 数据层基座         | 5      | E0     | §9                              |
| E2   | IPC 契约与安全基线 | 4      | E0, E1 | §7.2, §8                        |
| E3   | 订阅管理           | 6      | E1, E2 | §7.1（Subscription Service）    |
| E4   | 播客内容浏览       | 4      | E3     | §7.1（Episode Service）         |
| E5   | 音频播放           | 6      | E4     | §7.1（Playback Service）        |
| E6   | 离线下载           | 7      | E4     | §7.4（下载队列子系统）          |
| E7   | 本地数据可迁移     | 3      | E3-E6  | §9.4                            |
| E8   | 桌面基础与错误恢复 | 6      | E1-E6  | §7.1（Window/Tray/Menu）, §12.6 |
| E9   | 安全基线与发布验收 | 4      | 全部   | §8.1, §15                       |

**合计 51 个任务**。每个任务遵循"一个任务 = 一个可独立提交、可独立验收的垂直切片"（UI + 状态 + IPC + 数据 + 对应测试），符合 Arch.md §17 的 PR 粒度约定。

---

## 3. 任务顺序与依赖图

```
E0 工程基础设施
 └─▶ E1 数据层基座
      └─▶ E2 IPC 契约与安全基线
           ├─▶ E3 订阅管理
           │    └─▶ E4 播客内容浏览
           │         ├─▶ E5 音频播放
           │         └─▶ E6 离线下载 ──▶ E5（下载完成后可离线播放，二者收尾期互相验证）
           │
           ├─▶ E8 桌面基础与错误恢复（窗口/菜单可与 E3 并行；错误恢复子任务依赖 E5/E6）
           │
           └─▶ E7 本地数据可迁移（依赖 E3/E4/E5/E6 的数据模型全部落地）
                                                              └─▶ E9 安全基线与发布验收（收尾）
```

**关键路径**：E0 → E1 → E2 → E3 → E4 → E5/E6 → E7 → E9。桌面基础（E8）中"单实例锁定/窗口状态记忆/原生菜单"三项可在 E0 之后立即并行开始，不阻塞主链路；"错误恢复"相关子任务需等 E5/E6 完成后才能验收。

---

## 4. 任务详情

> 每个任务包含：ID、所属 Epic、依赖、描述、验收标准（Given/When/Then，可直接转测试用例）、测试要求（对应 Arch.md §12 三层测试）、交付物路径。规模标注为相对粒度 **S**（≤1 天）/ **M**（1~~3 天）/ **L**（3~~5 天），供排期参考，不代表绝对工时承诺。

### Epic E0：工程基础设施

#### T0.1 引入 Tailwind CSS + shadcn/ui 基础设施

- **依赖**：无　**规模**：M
- **描述**：接入 `@tailwindcss/vite` 插件与 `tailwindcss` v4；执行 `shadcn init` 生成 `components.json`；建立 `src/renderer/src/lib/utils.ts`（`cn()` 辅助函数）；替换现有 `App.tsx` 脚手架样式为基础设计令牌（颜色/圆角/间距的 CSS 变量）。
- **验收标准**：
  - Given 项目已安装依赖，When 运行 `pnpm dev`，Then 渲染进程加载的页面能正确应用 Tailwind 工具类样式，无 CSS 报错。
  - Given `shadcn add button` 执行成功，When 在任意页面引用 `Button` 组件，Then 组件正常渲染且保留 shadcn 默认样式与暗色变量集合。
- **测试要求**：无需业务测试，但需新增一个组件冒烟测试（渲染 `Button` 不抛错），纳入 `src/renderer/src/components/ui/button.test.tsx`。
- **交付物**：`electron.vite.config.ts`（插入 Tailwind 插件）、`components.json`、`src/renderer/src/assets/main.css`（`@import 'tailwindcss'` + `@theme`）、`src/renderer/src/lib/utils.ts`。

#### T0.2 搭建 Vitest 双 workspace（renderer / main）

- **依赖**：无　**规模**：M
- **描述**：新增 `vitest.workspace.ts`，分别为渲染进程（`jsdom` 环境）与主进程（`node` 环境）配置独立 project；接入 `@testing-library/react`、`@testing-library/jest-dom`、`@testing-library/user-event`；配置 `@vitest/coverage-v8`。
- **验收标准**：
  - Given 一个示例渲染进程组件测试与一个示例主进程纯函数测试，When 运行 `pnpm test`，Then 两个 project 均被识别并执行通过。
  - Given 运行 `pnpm test:coverage`，Then 产出覆盖率报告且不报配置错误。
- **测试要求**：本任务本身即"测试基础设施搭建"，验收标准即为其测试。
- **交付物**：`vitest.workspace.ts`、`src/renderer/src/test/setup.ts`、`package.json` 新增 `test`/`test:coverage` scripts。

#### T0.3 接入网络请求 mock（MSW 或等效方案）

- **依赖**：T0.2　**规模**：S
- **描述**：确保主进程测试不发起真实网络请求。本仓库采用 `vi.stubGlobal('fetch', ...)`（Vitest 原生）而非 MSW 实现：`feed-parser.test.ts` 与 `download.service.test.ts` 用 stub fetch 覆盖标准/缺字段/404/超时/网络失败等全部路径；E2E 另用本地 HTTP 测试服务器提供 hermetic RSS/音频源。两者共同满足"测试不碰真实网络"的目标，未引入 MSW 依赖。
- **验收标准**：
  - Given 一个指向 mock RSS URL 的请求，When 测试中调用该 URL，Then 返回预置的固定响应，不发起真实网络请求（由 `vi.stubGlobal('fetch')` 保证）。
- **测试要求**：现有 `fetchAndParseFeed` 测试已覆盖标准/缺字段/格式错误/超时/网络失败五类路径，无任何用例触发真实网络。
- **交付物**：等效方案（`vi.stubGlobal`）+ `tests/e2e/helpers/test-server.ts`（本地测试服务器）。

#### T0.4 接入 Playwright E2E 基础设施

- **依赖**：T0.2　**规模**：M
- **描述**：安装 `@playwright/test`，配置 `playwright.config.ts` 使用 `_electron.launch()` 驱动方式；封装 `tests/e2e/helpers/launch-app.ts`（每次启动前生成临时 `userData` 目录，测试结束清理）；编写一个占位 E2E 冒烟用例（应用能启动并展示主窗口）。
- **验收标准**：
  - Given 已执行 `pnpm build`，When 运行 `pnpm test:e2e`，Then Playwright 成功启动打包产物、断言主窗口标题存在，之后正常退出。
  - Given 连续运行两次 E2E 套件，Then 两次运行的数据互不干扰（临时 `userData` 隔离生效）。
- **测试要求**：本任务交付即 E2E 基础设施本身，占位用例验证设施可用。
- **交付物**：`playwright.config.ts`、`tests/e2e/helpers/launch-app.ts`、`tests/e2e/smoke.spec.ts`、`package.json` 新增 `test:e2e` script。

#### T0.5 建立 Feature-first 目录骨架与依赖边界校验

- **依赖**：无　**规模**：S
- **描述**：按 Arch.md §5 建立 `src/main/{ipc,features,infra,shared}`、`src/renderer/src/{app,components/ui,features,lib}`、`src/shared/` 空目录骨架（含 `.gitkeep` 或占位 `index.ts`）；引入 `dependency-cruiser`（或等价工具）配置规则："渲染进程 `features/a` 不得 import `features/b` 内部文件"，接入 `pnpm lint` 流程。
- **验收标准**：
  - Given 故意在 `features/subscription` 中 import `features/download/store.ts`，When 运行依赖边界校验命令，Then 报错并阻止通过。
  - Given 正常的跨功能域协作（通过 `app/` 编排），When 运行校验，Then 通过。
- **测试要求**：CI 门禁测试，非运行时单元测试；新增一条故意违规的示例并确认工具能捕获（随后移除示例代码，仅保留配置与说明）。
- **交付物**：目录骨架、`.dependency-cruiser.cjs`、`package.json` 新增 `lint:boundaries` script。

#### T0.6 CI 流水线搭建（lint → typecheck → 单元/集成 → build）

- **依赖**：T0.1~T0.5　**规模**：M
- **描述**：建立 CI 配置（GitHub Actions 或等效工具），实现 Arch.md §12.7 的门禁顺序：`lint → typecheck → 单元测试 → 集成测试 → build`；本阶段暂不接入 E2E 与三平台矩阵（留给 E9）。
- **验收标准**：
  - Given 向仓库提交一个会导致 lint 失败的改动，When CI 触发，Then 在 lint 阶段即失败并阻断，不继续执行后续阶段。
  - Given 一个通过全部检查的改动，When CI 触发，Then 全部阶段依次通过并生成构建产物。
- **测试要求**：CI 配置本身的验证（通过实际触发一次成功与一次失败的运行来确认）。
- **交付物**：`.github/workflows/ci.yml`（或等效）。

---

### Epic E1：数据层基座

#### T1.1 接入 better-sqlite3 + Drizzle ORM，建立数据库连接

- **依赖**：T0.2　**规模**：M
- **描述**：安装 `better-sqlite3`、`drizzle-orm`、`drizzle-kit`；建立 `src/main/infra/db/client.ts`（数据库文件路径基于 `app.getPath('userData')`，支持通过环境变量覆盖以便测试注入临时路径）；建立 `drizzle.config.ts`。
- **验收标准**：
  - Given 应用启动，When 主进程初始化，Then 在 `userData` 目录下创建/打开 SQLite 文件，且 `PRAGMA foreign_keys = ON` 生效。
  - Given 测试环境注入 `:memory:` 路径，When 运行任意 Repository 测试，Then 使用内存数据库而不产生磁盘文件。
- **测试要求**：单元测试验证连接建立与 `foreign_keys` pragma 生效。
- **交付物**：`src/main/infra/db/client.ts`、`drizzle.config.ts`、`src/main/infra/db/client.test.ts`。

#### T1.2 定义核心数据表 Schema（Podcast / Episode / DownloadTask / AppSettings）

- **依赖**：T1.1　**规模**：M
- **描述**：按 Arch.md §9.2 落地 `src/main/infra/db/schema.ts`：`podcasts`、`episodes`、`download_tasks` 三张核心表（MVP 阶段暂不含 `playlists`/`notes`，留给 P1）；主键使用 ULID；时间字段统一 Unix 毫秒时间戳。
- **验收标准**：
  - Given schema 定义完成，When 执行 `drizzle-kit generate`，Then 生成对应的建表 SQL 迁移文件，字段类型与约束（唯一键 `feedUrl`、外键级联删除）符合设计。
- **测试要求**：集成测试——在内存 SQLite 上跑迁移建表，断言三张表及其索引/外键约束存在。
- **交付物**：`src/main/infra/db/schema.ts`、`drizzle/0000_init.sql`。

#### T1.3 实现数据库迁移执行与失败回滚机制

- **依赖**：T1.2　**规模**：M
- **描述**：`src/main/infra/db/migrate.ts`：应用启动时执行迁移前先复制当前数据库文件为 `*.bak-<timestamp>`，迁移失败时自动恢复备份文件并抛出可识别错误，供上层提示用户。
- **验收标准**：
  - Given 一个损坏/不兼容的迁移脚本导致执行异常，When 启动时触发迁移，Then 数据库文件被恢复为迁移前状态，应用不会带着半迁移 schema 继续运行，同时产生明确的错误日志。
  - Given 正常迁移场景，When 连续两次启动（第二次无新迁移），Then 第二次启动不重复执行已应用的迁移。
- **测试要求**：集成测试——模拟迁移失败（如构造一个必然报错的迁移脚本）验证回滚逻辑；正常迁移的幂等性测试。
- **交付物**：`src/main/infra/db/migrate.ts`、`src/main/infra/db/migrate.test.ts`。

#### T1.4 实现 Subscription / Episode / DownloadTask 三个 Repository

- **依赖**：T1.2　**规模**：L
- **描述**：`src/main/features/{subscription,episode,download}/*.repository.ts`，仅暴露领域动词方法（`insertPodcast`、`findPodcastByFeedUrl`、`markEpisodePlayed`、`upsertDownloadTask` 等），内部使用 Drizzle 查询构建。
- **验收标准**：
  - Given 插入一个播客后按 `feedUrl` 查询，When 调用 `findPodcastByFeedUrl`，Then 返回刚插入的记录且字段完整。
  - Given 删除一个播客，When 该播客存在关联集数与下载任务，Then 级联删除生效（外键 `onDelete: cascade`）。
- **测试要求**：集成测试——每个 Repository 方法在 `:memory:` SQLite 上做真实 CRUD 验证，覆盖率 ≥ 85%（对应 Arch.md §12.3 核心业务域门槛）。
- **交付物**：`subscription.repository.ts` / `episode.repository.ts` / `download.repository.ts` 及各自 `.test.ts`。

#### T1.5 接入 `electron-store` 落地 AppSettings

- **依赖**：T0.1　**规模**：S
- **描述**：安装 `electron-store`，建立 `src/main/infra/settings/store.ts` 封装单例配置读写（默认下载质量、续播偏好等 MVP 阶段需要的最小字段集），提供类型安全的 getter/setter。
- **验收标准**：
  - Given 首次启动无配置文件，When 读取设置，Then 返回预定义默认值且不抛错。
  - Given 写入一个设置项后重启进程（模拟：销毁并重建 store 实例），When 再次读取，Then 返回持久化后的值。
- **测试要求**：单元测试，使用临时目录注入 `electron-store` 的 `cwd` 选项验证读写与默认值。
- **交付物**：`src/main/infra/settings/store.ts`、`src/main/infra/settings/store.test.ts`。

---

### Epic E2：IPC 契约与安全基线

#### T2.1 定义共享类型与 IPC 通道常量（`src/shared/`）

- **依赖**：T1.2　**规模**：M
- **描述**：建立 `src/shared/types.ts`（Podcast/Episode/DownloadTask 等领域类型，与 Drizzle schema 字段对齐但独立维护，供渲染进程使用而不依赖主进程内部实现）与 `src/shared/ipc-contract.ts`（每个 MVP 阶段需要的 IPC 通道名 + zod 输入 schema）。
- **验收标准**：
  - Given `AddSubscriptionInput` schema，When 传入非法 URL，Then `schema.parse()` 抛出结构化校验错误。
  - Given 渲染进程与主进程分别 import `IPC_CHANNELS.subscription.add`，Then 两侧引用同一常量值，无手写字符串重复定义。
- **测试要求**：单元测试覆盖 zod schema 的合法/非法输入两种路径。
- **交付物**：`src/shared/types.ts`、`src/shared/ipc-contract.ts`、对应 `.test.ts`。

#### T2.2 修正渲染进程安全基线配置

- **依赖**：无　**规模**：S
- **描述**：修改 `src/main/index.ts` 的 `webPreferences`：`sandbox: true`（当前脚手架为 `false`，对应 Arch.md §8.1/§15 中登记的待修正项）、显式 `contextIsolation: true`、`nodeIntegration: false`；配置基础 CSP（通过 `session.defaultSession.webRequest.onHeadersReceived` 注入 `Content-Security-Policy` 响应头）。
- **验收标准**：
  - Given 应用启动，When 检查 `BrowserWindow` 的 `webPreferences`，Then `sandbox`/`contextIsolation` 为 `true`，`nodeIntegration` 为 `false`。
  - Given 渲染进程加载页面，When 尝试内联执行远程脚本（测试用例中构造一个违反 CSP 的场景），Then 被 CSP 阻止且控制台出现 CSP 违规日志而非脚本执行。
- **测试要求**：集成测试——通过 Playwright `_electron` 读取 `BrowserWindow` webPreferences 实际生效值（而非只读源码配置），防止"代码里改了但运行时未生效"的假阳性。
- **交付物**：`src/main/index.ts`（修改）、`src/main/infra/security/csp.ts`、对应 E2E/集成断言用例。

#### T2.3 实现 Preload 白名单式 API 暴露（订阅/集数/下载/设置四个领域）

- **依赖**：T2.1　**规模**：M
- **描述**：重写 `src/preload/index.ts`：移除默认脚手架的 `ping` 示例逻辑，暴露 `window.api.{subscription,episode,download,settings}` 四个领域的方法（仅覆盖 MVP 所需通道），每个方法内部仅做 `ipcRenderer.invoke`/`on` 的薄封装，不暴露 `ipcRenderer` 本身；同步更新 `src/preload/index.d.ts` 的类型声明。
- **验收标准**：
  - Given 渲染进程代码，When 尝试访问 `window.ipcRenderer`（而非 `window.api`），Then 该全局对象不存在（因 `contextIsolation` 生效且未暴露）。
  - Given 调用 `window.api.subscription.add(...)`，When 主进程尚未注册对应 handler，Then 返回明确的"未实现"错误而非静默挂起（用于验证契约先行的开发顺序）。
- **测试要求**：单元测试（在 Node 环境下 mock `contextBridge`/`ipcRenderer` 验证暴露的 API 形状与 `IPC_CHANNELS` 常量一致）。
- **交付物**：`src/preload/index.ts`、`src/preload/index.d.ts`、`src/preload/index.test.ts`。

#### T2.4 建立 IPC Handler 注册框架与统一错误映射

- **依赖**：T2.1, T2.2　**规模**：M
- **描述**：`src/main/ipc/register.ts` 提供统一的 `registerHandler(channel, schema, handler)` 封装：自动做 zod 校验、捕获 service 层抛出的领域错误并映射为 `{ code, message }` 结构，避免每个 handler 重复写 try/catch 样板；`src/main/index.ts` 中调用各领域的 `register*Handlers()`。
- **验收标准**：
  - Given 一个 handler 内部抛出未预期异常，When 渲染进程调用对应 IPC 方法，Then 收到结构化错误对象而非 Node 原始堆栈信息泄漏给渲染进程。
  - Given 输入未通过 zod 校验，When 调用，Then 在进入 service 层业务逻辑前就被拦截并返回 `INVALID_INPUT` 错误码。
- **测试要求**：集成测试——用假 handler 函数验证 `registerHandler` 的校验拦截与错误映射行为。
- **交付物**：`src/main/ipc/register.ts`、`src/main/ipc/register.test.ts`。

---

### Epic E3：订阅管理

#### T3.1 实现 RSS/Atom Feed 解析模块

- **依赖**：T0.3　**规模**：L
- **描述**：`src/main/features/subscription/feed-parser.ts`，基于 `rss-parser` 封装，提取标题/描述/封面/作者/语言及集数列表（标题/发布时间/音频 URL/时长/大小）；对缺失字段、非标准编码、格式错误做容错处理，返回结构化解析结果或结构化错误（`timeout`/`parse_error`/`invalid_xml`/`not_found`）。
- **验收标准**：
  - Given `tests/fixtures/feeds/standard.xml`（标准 Feed），When 解析，Then 返回完整的播客元数据与集数数组。
  - Given `tests/fixtures/feeds/missing-fields.xml`（缺失作者/封面等非必需字段），When 解析，Then 不抛错，缺失字段返回 `null`/兜底值。
  - Given `tests/fixtures/feeds/malformed.xml`（XML 格式错误），When 解析，Then 返回 `parse_error` 分类错误而非抛出未捕获异常。
- **测试要求**：集成测试，覆盖标准/缺字段/格式错误/超时四类样本（超时场景用 MSW 延迟响应模拟）。
- **交付物**：`feed-parser.ts`、`feed-parser.test.ts`、补充 `tests/fixtures/feeds/` 下 4+ 个样本文件。

#### T3.2 实现"添加订阅"完整链路（Service + IPC + UI）

- **依赖**：T1.4, T2.4, T3.1　**规模**：L
- **描述**：`subscription.service.ts` 编排"请求 Feed → 解析 → 查重 → 落库"；`subscription.handler.ts` 注册 `subscription:add` 通道；渲染进程 `features/subscription/{api.ts,store.ts,components/AddSubscriptionDialog.tsx}` 使用 shadcn/ui 的 `Dialog` + `Input` + `Button` 构建输入表单。
- **验收标准**（对应 PRD §6.1 验收标准）：
  - Given 用户输入一个有效 RSS URL 并提交，When 请求成功，Then 5 秒内展示解析结果预览，确认后写入数据库并关闭弹窗。
  - Given 用户输入格式错误的 URL（非 URL 字符串），When 提交，Then 前端在发起请求前即拦截并提示格式错误，不产生 IPC 调用。
  - Given 用户输入一个已订阅过的 Feed URL，When 提交，Then 提示"已订阅"，不产生重复记录。
  - Given 应用处于断网状态，When 用户尝试添加新订阅，Then 提示"当前无网络，无法添加新订阅"，且不影响查看现有订阅列表。
- **测试要求**：单元测试（表单校验、store 状态转换）+ 集成测试（service 层查重逻辑、IPC handler 端到端）+ E2E（"添加一个有效 RSS URL 成功订阅"完整用户旅程，见 Arch.md §12.5 用例表）。
- **交付物**：`src/main/features/subscription/subscription.service.ts`、`src/main/ipc/subscription.handler.ts`、`src/renderer/src/features/subscription/*`、对应三层测试文件、`tests/e2e/subscription-add.spec.ts`。

#### T3.3 实现订阅列表展示（排序 + 搜索）

- **依赖**：T3.2　**规模**：M
- **描述**：`subscription:list` IPC 通道；渲染进程 `SubscriptionListView` 组件，支持按最近更新时间排序（默认）与标题关键词本地过滤（MVP 阶段搜索为纯前端内存过滤，不需要额外 IPC 通道）。
- **验收标准**：
  - Given 已有 3 个订阅，When 打开订阅列表，Then 默认按最近更新时间倒序展示。
  - Given 在搜索框输入关键词，When 关键词匹配某订阅标题的子串，Then 列表实时过滤，仅展示匹配项。
- **测试要求**：单元测试（排序/过滤纯函数 + 组件渲染）；集成测试（`subscription:list` IPC 返回真实数据库数据）。
- **交付物**：`src/renderer/src/features/subscription/components/SubscriptionListView.tsx`、`src/renderer/src/features/subscription/lib/sort-filter.ts`（含 `.test.ts`）。

#### T3.4 实现取消订阅（保留数据选项）

- **依赖**：T3.2　**规模**：S
- **描述**：`subscription:remove` IPC 通道；UI 确认弹窗询问"是否保留已下载文件和历史数据"（默认保留，对应 PRD Local-first 原则）；`remove` 为"仅解除订阅关系"或"级联删除全部数据"两种模式，通过参数区分。
- **验收标准**：
  - Given 用户点击取消订阅并选择"保留数据"，When 确认，Then 播客从活跃订阅列表消失，但其集数/下载记录仍在数据库中可查（用于未来"重新订阅"场景，虽然 MVP 阶段暂不做重新关联 UI，但数据不应被物理删除）。
  - Given 用户选择"同时删除全部数据"，When 确认，Then 关联的集数、下载任务记录级联删除，且已下载的本地音频文件也被清理。
- **测试要求**：集成测试覆盖两种模式的数据库最终状态断言。
- **交付物**：`subscription.handler.ts`（新增通道）、`subscription.service.ts`（新增方法）、UI 确认弹窗组件。

#### T3.5 实现手动刷新单个订阅

- **依赖**：T3.1, T3.2　**规模**：M
- **描述**：`subscription:refresh` IPC 通道，复用 `feed-parser.ts` 重新拉取并 diff 出新增集数（按 `audioUrl` 或 Feed 提供的 `guid` 去重），更新播客元数据与 `lastFetchedAt`/`lastFetchStatus`；UI 提供刷新按钮与加载态。
- **验收标准**：
  - Given 一个已订阅播客发布了新集数，When 用户点击刷新，Then 新集数出现在集数列表中，已存在集数不产生重复记录。
  - Given 刷新时网络请求失败，When 失败，Then 保留上次成功的数据不清空列表，仅提示"刷新失败"，`lastFetchStatus` 更新为失败原因分类（对应 PRD §11.2/§11.3）。
- **测试要求**：集成测试覆盖"新增集数 diff 逻辑"与"失败时数据不丢失"两条路径。
- **交付物**：`subscription.service.ts`（新增 `refresh` 方法）、`subscription:refresh` handler、UI 刷新按钮组件。

#### T3.6 实现订阅列表空状态与加载态 UI

- **依赖**：T3.3　**规模**：S
- **描述**：使用 shadcn/ui 的 `Skeleton`/自定义空状态组件，覆盖"首次无订阅""加载中""加载失败"三种视图状态，避免白屏体验（对应 PRD §11.2 静态资源本地缓存、离线打开不空白的精神在 MVP 阶段的基础落地）。
- **验收标准**：
  - Given 应用首次启动无任何订阅，When 打开订阅列表页，Then 展示引导性空状态（而非空白页面），提示用户添加第一个订阅。
- **测试要求**：组件测试覆盖三种状态的渲染分支。
- **交付物**：`src/renderer/src/features/subscription/components/{EmptyState,ListSkeleton}.tsx` 及测试。

---

### Epic E4：播客内容浏览

#### T4.1 实现播客详情页

- **依赖**：T3.2　**规模**：M
- **描述**：`episode:listByPodcast` IPC 通道；渲染进程 `PodcastDetailPage` 展示简介/封面/作者信息 + 未听集数计数 + 集数列表入口。
- **验收标准**：
  - Given 进入某播客详情页，When 页面加载完成，Then 展示该播客的简介、封面、作者，且未听集数计数与数据库中 `isPlayed = false` 的记录数一致。
- **测试要求**：单元测试（未听计数计算函数）+ 集成测试（IPC 返回数据与数据库状态一致）。
- **交付物**：`src/main/ipc/episode.handler.ts`、`src/renderer/src/features/episode/pages/PodcastDetailPage.tsx`。

#### T4.2 实现集数列表（状态标识 + 排序）

- **依赖**：T4.1　**规模**：M
- **描述**：集数列表按发布时间倒序展示标题/日期/时长/大小，并标识已听/未听、已下载/未下载两组独立状态徽标。
- **验收标准**：
  - Given 一集已下载但未播放完成，When 查看列表，Then 同时显示"已下载"与"未听"两个独立徽标（二者互不影响，对应 Feature.md 2.2 节的独立状态设计）。
- **测试要求**：组件测试覆盖四种状态组合（已听+已下载/已听+未下载/未听+已下载/未听+未下载）的徽标渲染。
- **交付物**：`src/renderer/src/features/episode/components/EpisodeListItem.tsx` 及测试。

#### T4.3 实现"标记全部为已读"

- **依赖**：T4.2　**规模**：S
- **描述**：`episode:markAllPlayed` IPC 通道，按 `podcastId` 批量更新。
- **验收标准**：
  - Given 播客下有 5 集未听，When 点击"标记全部为已读"，Then 5 集状态全部更新为已听，未听计数归零，操作在单一事务内完成（避免部分成功部分失败）。
- **测试要求**：集成测试验证批量更新的事务性与计数联动。
- **交付物**：`episode.service.ts`（新增方法）、对应 handler 与 UI 按钮。

#### T4.4 实现集数详情（HTML 富文本安全渲染）

- **依赖**：T4.2　**规模**：M
- **描述**：主进程使用 `sanitize-html` 对 Feed 返回的集数描述做净化后再通过 IPC 传出（对应 Arch.md §8.3 安全要求）；渲染进程使用净化后字符串渲染，覆盖基础排版（段落/链接/列表）。
- **验收标准**：
  - Given 一条集数描述中含 `<script>alert(1)</script>`，When 展示详情页，Then 该脚本被净化移除，不会被执行，同时保留其余正常 HTML 排版标签。
- **测试要求**：单元测试对净化函数做恶意输入用例（`<script>`、内联 `onerror` 等）断言均被剥离。
- **交付物**：`src/main/infra/sanitize/html.ts`、对应测试、渲染进程详情组件。

---

### Epic E5：音频播放

#### T5.1 实现播放器核心状态机（Zustand `usePlaybackStore`）

- **依赖**：T4.2　**规模**：L
- **描述**：全局 `usePlaybackStore` 管理当前播放集数、播放/暂停状态、当前进度、总时长；基于 HTML5 `<audio>` 元素封装播放控制逻辑（`src/renderer/src/features/playback/lib/audio-controller.ts`），暴露 `play/pause/seek/next/previous` 动作。
- **验收标准**：
  - Given 调用 `play(episodeId)`，When 音频加载完成，Then store 中 `isPlaying` 变为 `true` 且 `currentEpisodeId` 更新。
  - Given 调用 `seek(120)`，When 音频当前时长足够，Then 播放进度跳转到第 120 秒，且过程中不产生重复播放或音频卡顿（可通过检测 `<audio>` 元素的 `currentTime` 断言）。
- **测试要求**：单元测试覆盖状态机的所有转换路径（play→pause→seek→ended），使用 `jsdom` 环境 mock `HTMLMediaElement` 的播放行为（jsdom 默认不支持真实音频解码，需 mock `play()`/`pause()` 方法）。
- **交付物**：`usePlaybackStore.ts`、`audio-controller.ts` 及测试。

#### T5.2 实现迷你播放器组件

- **依赖**：T5.1　**规模**：M
- **描述**：常驻底部的迷你播放器（shadcn/ui `Slider` 做进度条 + 播放/暂停/上下集按钮 + 当前时间/总时长文本）。
- **验收标准**：
  - Given 正在播放某集数，When 查看迷你播放器，Then 实时展示当前播放时间与总时长，进度条位置与播放进度同步（误差 < 1 秒）。
  - Given 用户拖拽进度条，When 释放，Then 播放跳转到拖拽位置，过程中音频不产生杂音或重复触发 `play`。
- **测试要求**：组件测试（`user-event` 模拟拖拽进度条与点击播放/暂停按钮）。
- **交付物**：`src/renderer/src/features/playback/components/MiniPlayer.tsx` 及测试。

#### T5.3 实现全屏播放器页面

- **依赖**：T5.1　**规模**：M
- **描述**：全屏播放器视图，展示封面大图、标题、进度条、播放控制，与迷你播放器共享同一个 `usePlaybackStore`，切换视图时状态无缝衔接不中断播放。
- **验收标准**：
  - Given 迷你播放器正在播放，When 切换到全屏播放器，Then 播放不中断，进度与状态完全同步（同一份 store，非独立拷贝）。
- **测试要求**：组件测试验证两个视图共享 store 引用后的状态一致性。
- **交付物**：`src/renderer/src/features/playback/pages/FullScreenPlayer.tsx` 及测试。

#### T5.4 实现上一集/下一集切换逻辑

- **依赖**：T5.1　**规模**：S
- **描述**：基于当前播客的集数列表（按发布时间排序）计算上一集/下一集，边界情况（第一集无上一集、最后一集无下一集）按钮禁用而非报错。
- **验收标准**：
  - Given 当前播放的是某播客最新一集，When 查看"下一集"按钮，Then 按钮为禁用状态（因为没有更新的集数）。
  - Given 点击"下一集"（存在下一集时），When 切换，Then 自动开始播放下一集且更新播放进度记录起点为 0。
- **测试要求**：单元测试覆盖边界条件（首集/末集/中间集）三种场景。
- **交付物**：`src/renderer/src/features/playback/lib/adjacent-episode.ts` 及测试。

#### T5.5 实现播放进度持久化（写库 + 节流）

- **依赖**：T5.1, T1.4　**规模**：M
- **描述**：`playback:updateProgress` IPC 通道；渲染进程每隔固定间隔（如 5 秒）或暂停/切集时机把当前进度同步写入 `episodes.playbackPositionSec`，避免每秒写库造成 I/O 压力（对应 Arch.md §7.2 断电丢失范围 ≤ 5 秒的约束）。
- **验收标准**：
  - Given 播放进行到第 63 秒时模拟进程被强制终止（不走正常关闭流程），When 重启应用后打开该集数，Then 恢复的播放位置与终止时刻的差值 ≤ 5 秒。
- **测试要求**：集成测试模拟"写入节流后立即读取"验证持久化间隔与读取一致性。
- **交付物**：`playback.service.ts`、`playback.handler.ts`、渲染进程节流写入逻辑及测试。

#### T5.6 实现 App 重启恢复播放进度（不自动出声）

- **依赖**：T5.5　**规模**：M
- **描述**：应用启动时读取上次播放的集数与进度，恢复到播放器 UI（进度条、当前集数信息），但**不自动开始播放**，需用户手动点击播放（对应 PRD §11.3 已勾选项的产品要求，MVP 阶段需补齐自动化测试覆盖）。
- **验收标准**：
  - Given 上次退出前播放到某集数第 45 秒且处于播放中，When 重新启动应用，Then 播放器 UI 显示该集数与第 45 秒位置，但音频处于暂停状态，不自动发声。
- **测试要求**：E2E 测试——"播放某集数到中途 → 强制关闭应用 → 重启 → 断言播放器显示正确进度且未自动播放"（对应 Arch.md §12.5 关键 E2E 用例表）。
- **交付物**：应用启动时的恢复逻辑（`src/renderer/src/features/playback/lib/restore-on-launch.ts`）、`tests/e2e/playback-restore.spec.ts`。

---

### Epic E6：离线下载

#### T6.1 实现下载队列核心调度器

- **依赖**：T1.4　**规模**：L
- **描述**：`src/main/features/download/download-queue.ts`：维护并发数可配置的任务队列（MVP 阶段并发数可先写死为 2，暴露配置接口供 P1 接入用户可调），状态机 `queued → downloading → paused/completed/failed`。
- **验收标准**：
  - Given 连续入队 5 个下载任务且并发数为 2，When 队列运行，Then 任意时刻同时处于 `downloading` 状态的任务数不超过 2，其余保持 `queued`。
  - Given 一个 `downloading` 任务被暂停，When 暂停生效，Then 队列自动调度下一个 `queued` 任务开始下载，维持并发数满载。
- **测试要求**：单元测试覆盖调度算法（不涉及真实网络，用假下载器验证状态转换与并发控制）。
- **交付物**：`download-queue.ts`、`download-queue.test.ts`。

#### T6.2 实现单集下载（HTTP 请求 + 临时文件 + 原子转正）

- **依赖**：T6.1　**规模**：L
- **描述**：`download.service.ts` 对接真实 HTTP 下载（使用 Node 内置 `fetch` 流式写入临时文件 `<episodeId>.part`），完成后原子 `rename` 为最终文件并更新数据库 `isDownloaded`/`localFilePath`/`downloadedAt`。
- **验收标准**：
  - Given 触发单集下载，When 下载完成，Then 最终文件存在于配置的下载目录，`isDownloaded` 为 `true`，且下载过程中不存在"文件已存在但仍在写入"的中间态被误判为完成（通过临时文件+原子重命名机制保证）。
- **测试要求**：集成测试使用 MSW 模拟的本地 HTTP 服务器验证完整下载流程与最终文件状态。
- **交付物**：`download.service.ts`（下载执行部分）、集成测试。

#### T6.3 实现下载队列管理 UI（暂停/继续/取消）

- **依赖**：T6.1, T6.2　**规模**：M
- **描述**：`download:{enqueue,pause,resume,cancel}` IPC 通道 + 高频 `download:progress` 广播；渲染进程下载队列面板展示每个任务的进度条与操作按钮。
- **验收标准**：
  - Given 一个正在下载的任务，When 点击暂停，Then 任务状态变为 `paused`，进度条停止增长且不丢失已下载字节数（供后续续传使用）。
  - Given 点击取消，When 确认，Then 任务从队列移除，已写入的临时文件被清理，不留孤儿文件。
- **测试要求**：组件测试（按钮交互触发对应 IPC 调用）+ 集成测试（暂停后 `progressBytes` 持久化正确）。
- **交付物**：`src/renderer/src/features/download/components/DownloadQueuePanel.tsx`、对应 handler、测试。

#### T6.4 实现下载断点续传

- **依赖**：T6.2　**规模**：L
- **描述**：暂停/中断的任务恢复下载时，基于已记录的 `progressBytes` 发起 `Range: bytes=<progressBytes>-` 请求；若响应非 `206 Partial Content`（服务端不支持 Range），清空临时文件从零重新下载并提示用户。
- **验收标准**：
  - Given 一个已下载 30% 的暂停任务，When 恢复下载且服务端支持 Range，Then 后续请求携带正确的 `Range` 头，且最终文件字节数与完整文件一致（不重复下载已有部分）。
  - Given 服务端对 Range 请求返回 `200`（不支持）而非 `206`，When 检测到该情况，Then 自动降级为从零重新下载，并向用户提示"该源不支持断点续传，已重新下载"。
- **测试要求**：集成测试用 MSW 分别模拟"支持 Range"与"不支持 Range"两种服务端行为，断言两条路径的最终文件完整性与提示逻辑。
- **交付物**：`download.service.ts`（续传逻辑）、`download-queue.test.ts` 补充用例。

#### T6.5 实现 App 重启后下载任务自动恢复

- **依赖**：T6.4　**规模**：M
- **描述**：应用启动时扫描数据库中状态为 `downloading`（异常中断，未被正常暂停）的任务，自动转为 `queued` 并重新入队续传。
- **验收标准**：
  - Given 一个任务在下载中途被强制终止应用进程（未走正常暂停流程），When 重启应用，Then 该任务被自动识别并恢复下载（走断点续传路径），而非停滞在"下载中"却无实际进度。
- **测试要求**：E2E 测试——"下载中途强制关闭应用 → 重启 → 验证任务自动续传而非从零开始"（对应 Arch.md §12.5 关键用例表）。
- **交付物**：启动恢复逻辑（`src/main/features/download/resume-on-launch.ts`）、`tests/e2e/download-resume.spec.ts`。

#### T6.6 实现下载完整性校验

- **依赖**：T6.2　**规模**：S
- **描述**：下载完成后比对实际文件大小与 Feed 提供的 `Content-Length`/`enclosure length` 字段，不一致则标记为 `failed` 而非 `completed`，避免损坏文件被误判为可用。
- **验收标准**：
  - Given 下载过程中连接异常中断导致文件不完整，When 检测到实际字节数小于预期，Then 该任务状态标记为 `failed`，不进入"已下载可离线播放"状态，避免用户点开播放遇到损坏文件。
- **测试要求**：集成测试模拟"响应提前截断"场景，断言最终状态为 `failed` 而非 `completed`。
- **交付物**：`download.service.ts`（校验逻辑）及对应测试。

#### T6.7 实现已下载内容离线播放

- **依赖**：T6.2, T5.1　**规模**：M
- **描述**：播放器逻辑优先判断集数 `isDownloaded`：若已下载，`<audio src>` 指向本地文件路径（经 `file://` 协议或主进程提供的本地静态资源服务）；否则指向远程 `audioUrl`。断网时未下载集数应明确提示"仅元数据，需联网播放或先下载"而非直接播放失败报错。
- **验收标准**：
  - Given 已下载某集数且应用处于断网状态，When 播放该集数，Then 正常播放，不因断网产生任何错误提示。
  - Given 未下载某集数且应用处于断网状态，When 用户尝试播放，Then 明确提示"当前无网络且未下载，请先下载或联网播放"，而不是展示通用的播放失败错误。
- **测试要求**：E2E 测试——"下载一集 → 断网 → 播放该集验证可正常播放，未下载集数显示提示"（对应 PRD §12.2 场景 + Arch.md §12.5 用例表，Offline-first 核心验收项）。
- **交付物**：播放源选择逻辑（`audio-controller.ts` 补充）、`tests/e2e/offline-playback.spec.ts`。

---

### Epic E7：本地数据可迁移

#### T7.1 实现完整本地数据导出

- **依赖**：E3~E6 数据模型全部落地　**规模**：M
- **描述**：`data-portability:export` IPC 通道，产出 Arch.md §9.4 定义的 `.biubackup`（zip 容器：`manifest.json` + `data.json`），覆盖订阅、集数元数据、播放进度、已听状态、下载记录（不含音频二进制文件本身）、应用设置；用户通过系统文件保存对话框选择导出路径。
- **验收标准**：
  - Given 应用中存在若干订阅、播放进度、下载记录，When 执行导出，Then 生成的 `.biubackup` 文件解压后 `data.json` 包含全部上述数据域，字段与数据库当前状态一致。
- **测试要求**：集成测试——构造已知数据集，执行导出后解压校验 `data.json` 内容与数据库查询结果逐字段一致。
- **交付物**：`src/main/features/data-portability/export.service.ts`、handler、对应测试。

#### T7.2 实现完整本地数据导入（含冲突预览）

- **依赖**：T7.1　**规模**：L
- **描述**：`data-portability:{previewImport,import}` 两个 IPC 通道：先解析待导入文件与本地现状做 diff，返回"新增 N 项/冲突 M 项"预览供用户确认；确认后在单一事务中执行导入（冲突项默认"跳过"，MVP 阶段暂不做逐项合并 UI，"整体覆盖"作为备选简单策略，供用户在预览阶段二选一）。
- **验收标准**：
  - Given 一个全新环境（无历史数据）导入之前导出的 `.biubackup`，When 执行导入，Then 预览阶段显示全部为"新增"，确认后全部数据正确写入。
  - Given 导入过程中途发生异常（如构造一个损坏的 `data.json`），When 导入失败，Then 事务回滚，数据库保持导入前状态，不产生部分写入的脏数据。
- **测试要求**：集成测试覆盖"全新导入""异常回滚"两条路径。
- **交付物**：`import.service.ts`、`import-preview.service.ts`、handler、测试。

#### T7.3 实现"导出→清空→导入"数据完整性 E2E 验证

- **依赖**：T7.1, T7.2　**规模**：M
- **描述**：编写覆盖 PRD §12.2 核心用户旅程的 E2E 测试："订阅若干播客、下载并播放部分集数产生播放进度 → 导出数据 → 清空 `userData` 模拟全新环境 → 导入 → 逐项断言订阅/进度/下载记录完整还原"。
- **验收标准**：
  - Given 完整走完上述流程，Then 导入后的订阅数量、每集播放进度、已听/已下载状态与导出前完全一致（逐字段 diff 为空）。
- **测试要求**：本任务即 E2E 测试本身，属于 Arch.md §12.6 "Local-first 专项测试"的落地。
- **交付物**：`tests/e2e/data-portability-roundtrip.spec.ts`。

---

### Epic E8：桌面基础与错误恢复

#### T8.1 实现单实例锁定

- **依赖**：T0.6　**规模**：S
- **描述**：`app.requestSingleInstanceLock()`，重复启动时聚焦已有窗口而非新开实例。
- **验收标准**：
  - Given 应用已运行，When 用户再次双击启动图标（或执行启动命令），Then 不产生第二个进程/窗口，已有窗口被聚焦并置于前台。
- **测试要求**：E2E 测试——连续两次 `_electron.launch()` 模拟重复启动，断言第二次未产生独立新窗口（或验证进程数）。
- **交付物**：`src/main/index.ts` 修改、`src/main/infra/window/single-instance.ts`。

#### T8.2 实现窗口状态记忆

- **依赖**：T1.5　**规模**：M
- **描述**：窗口尺寸/位置/最大化状态变更时节流写入 `electron-store`；启动时读取并还原，若记录的位置超出当前显示器可视范围（如上次在外接显示器，现已拔出），回退到主屏居中显示。
- **验收标准**：
  - Given 用户调整窗口大小并移动位置后关闭应用，When 重新启动，Then 窗口以关闭前的尺寸与位置打开。
  - Given 记录的位置模拟已不在任何当前显示器可视范围内，When 启动，Then 窗口回退到主屏可见区域，而非渲染到屏幕之外不可见的位置。
- **测试要求**：单元测试覆盖"越界检测与回退"纯函数逻辑；E2E 测试验证一次真实的"调整→关闭→重启→还原"流程。
- **交付物**：`src/main/infra/window/window-state.ts` 及测试。

#### T8.3 实现原生应用菜单（File/Edit/View/Window/Help）

- **依赖**：T0.6　**规模**：S
- **描述**：`src/main/infra/menu/index.ts` 构建跨平台原生菜单，macOS 补充应用名称菜单（含 Quit/Hide 等系统级约定项）。
- **验收标准**：
  - Given 应用在 macOS 上启动，When 查看菜单栏，Then 存在标准的应用菜单（含 Quit）与 Edit 菜单（复制/粘贴等系统级快捷键可用）。
  - Given 应用在 Windows/Linux 上启动，When 查看窗口菜单栏，Then 至少包含 File/Edit/View/Help 结构。
- **测试要求**：单元测试验证菜单模板结构（角色/标签），跨平台差异分支覆盖。
- **交付物**：`src/main/infra/menu/index.ts` 及测试。

#### T8.4 实现 Feed 拉取失败分类提示

- **依赖**：T3.1, T3.5　**规模**：S
- **描述**：将 `feed-parser.ts` 已产出的错误分类（`timeout`/`parse_error`/`invalid_xml`/`not_found`/网络证书错误）映射为渲染进程可读的具体提示文案，而非统一展示"刷新失败"。
- **验收标准**：
  - Given 刷新一个已失效（404）的 Feed URL，When 失败，Then 提示"该订阅源已失效（404），请检查地址是否正确"而非通用错误文案；不同失败原因展示不同文案。
- **测试要求**：单元测试覆盖错误分类到文案的映射表完整性（每个已定义的错误分类都有对应文案，不遗漏）。
- **交付物**：`src/renderer/src/features/subscription/lib/error-messages.ts` 及测试。

#### T8.5 实现下载失败自动重试

- **依赖**：T6.2　**规模**：M
- **描述**：下载任务失败（网络中断类，非完整性校验失败）时按配置的次数与退避间隔（如 3 次，间隔 5s/15s/45s）自动重试，超过次数后转为 `failed` 并允许用户手动重试。
- **验收标准**：
  - Given 一个下载请求连续失败 2 次后第 3 次成功，When 队列处理该任务，Then 最终状态为 `completed`，且重试次数、间隔符合配置。
  - Given 连续失败次数达到上限，When 达到上限后，Then 任务状态为 `failed` 且不再自动重试，UI 提供"手动重试"按钮。
- **测试要求**：单元测试模拟"连续失败 N 次后成功/持续失败"两种序列，验证重试次数与最终状态。
- **交付物**：`download-queue.ts`（重试逻辑）及测试。

#### T8.6 实现已下载文件丢失检测

- **依赖**：T6.7　**规模**：S
- **描述**：播放前检查 `localFilePath` 指向的文件是否实际存在（用户可能手动删除了文件），不存在则将该集数 `isDownloaded` 状态修正为 `false` 并提示"文件已丢失，请重新下载"。
- **验收标准**：
  - Given 数据库记录某集数已下载，但对应本地文件已被外部删除，When 用户尝试播放该集数，Then 检测到文件缺失，自动修正状态并提示重新下载，而非播放报错或静默失败。
- **测试要求**：集成测试——手动删除测试环境下的临时文件后触发播放前检查，断言状态修正逻辑生效。
- **交付物**：`download.service.ts`（文件存在性检查方法）及测试。

---

### Epic E9：安全基线与发布验收

> **本轮落地策略（方案 B）**：以 Vitest 安全回归 + GitHub Actions 三平台构建产物为主；Playwright E2E（T9.1 冒烟 / T9.2 进程级安全断言 / T9.4 黄金路径）延后，见 `mdocs/Mvp-Acceptance-Report.md`。

#### T9.1 三平台构建产物基础验收（Windows/macOS/Linux）

- **依赖**：E0~E8 全部完成　**规模**：M
- **描述**：接入 `electron-builder` 三平台构建到 CI 矩阵（`windows-latest`/`macos-latest`/`ubuntu-latest`），执行平台打包并验证产物生成。Playwright 三平台 E2E 冒烟延后。
- **验收标准**：
  - Given CI 三平台矩阵触发，When 构建完成，Then 每个平台均产出对应安装包格式（NSIS / DMG / AppImage 或 deb）。
- **测试要求**：CI `package` job 在产物缺失时失败（`if-no-files-found: error`）。
- **交付物**：`.github/workflows/ci.yml`；E2E 冒烟路径待补 `tests/e2e/smoke/`。

#### T9.2 安全基线回归验证（对应 Arch.md §15 清单前 4 项）

- **依赖**：T2.2　**规模**：S
- **描述**：编写自动化回归测试固化 T2.2 的安全配置，防止未来重构时被无意改回不安全默认值；覆盖：`sandbox`/`contextIsolation`/`nodeIntegration`、CSP 生产策略、集数描述 HTML 净化。本轮以 Vitest 固化（配置单一真源 + 源码接线断言）；Playwright 运行时断言延后。
- **验收标准**：
  - Given CI 每次运行，When 执行本回归测试，Then 上述安全配置均被验证；任一项被意外改动都会导致该测试失败。
- **测试要求**：纳入 CI 必跑项（`pnpm test`）。
- **交付物**：`src/main/infra/security/security-baseline.test.ts`（替代本阶段的 `tests/e2e/security-baseline.spec.ts`）。

#### T9.3 代码签名配置占位（可选增强，不阻断发布）

- **依赖**：无　**规模**：S
- **描述**：代码签名属**可选增强项**（未签名也可正式发布，仅影响 Windows SmartScreen / macOS Gatekeeper 的"未知发布者"提示，用户手动允许一次即可）。在 `electron-builder.yml` 中预留签名配置位（`win` CSC 环境变量说明 / `mac.notarize` 等），并在 README 中记录各平台签名启用方式（开源项目可走 SignPath Foundation 免费方案；macOS 无免费通道）。
- **验收标准**：
  - Given 评审本任务交付物，When 检查 `electron-builder.yml`，Then 签名相关配置字段/注释已预留（即使当前值为占位/未启用），且有明确的文档说明签名是可选项及其启用方式。
- **测试要求**：无自动化测试，人工评审配置位是否完整。
- **交付物**：`electron-builder.yml` 补充注释、`README.md` 发布签名说明。

#### T9.4 MVP 整体验收：核心用户旅程完整走查

- **依赖**：E0~E8 全部完成　**规模**：M
- **描述**：对照 PRD §2.2 用户旅程 1/3/4（首次使用、断网通勤、数据搬家）与 §12.1 三大原则专项测试表，执行一次完整的手动走查，产出验收报告。自动化黄金路径 E2E 延后。
- **验收标准**：
  - Given MVP 功能任务完成，When 依次执行"添加订阅→浏览→播放→下载→断网播放已下载内容→导出数据→清空→导入验证完整"全链路，Then 每一步均符合 PRD 对应验收标准，无阻断性缺陷。
- **测试要求**：本阶段以验收报告清单人工勾选；后续接入 Playwright 后再作为 CI 门禁。
- **交付物**：`mdocs/Mvp-Acceptance-Report.md`（`tests/e2e/golden-path.spec.ts` 待补）。

---

## 5. MVP 完成的定义（Definition of Done）

### 5.1 严格 DoD（原文）

MVP 视为**正式对外可交付**，需同时满足：

1. 本文档全部 51 个任务状态为已完成，且每个任务的验收标准均可通过对应的自动化测试复现（非仅人工口头确认）；
2. CI 流水线（lint → typecheck → 单元 → 集成 → build → E2E 冒烟）在三平台矩阵上全部通过；
3. T9.4 黄金路径 E2E 套件稳定通过（允许的 flaky 重试次数需在 CI 配置中明确，不允许"重跑到通过为止"掩盖真实缺陷）；
4. 覆盖率达到 Arch.md §12.3 门槛：核心业务域（订阅/下载/播放进度/数据导入导出）语句覆盖率 ≥ 85%；
5. 第 15 章安全清单（引用 Arch.md §15）中标记为"MVP 阶段必须完成"的条目（`sandbox`/`contextIsolation`/CSP/HTML 净化四项）已通过 T9.2 自动化验证；签名属可选增强项（T9.3 配置占位完成），不构成发布前置条件；
6. `Feature.md` 中对应 P0 条目的勾选框已全部更新为 `[x]`，保持三份文档（Feature/Prd/Arch/Mvp）与实际实现状态一致。

### 5.2 方案 B 工程闭环（2026-07-29 已达成）

代码签名作为**可选增强项**（不阻塞发布），以下视为 **MVP 工程闭环**：

| #   | 条件                                                                                    | 状态                                                        |
| --- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1   | 主链路功能（E1–E8）已实现，关键路径有 Vitest 覆盖                                       | ✅                                                          |
| 2   | CI：lint → typecheck → test → coverage 门禁 → build，且 Win/mac/Linux 安装包产物产出    | ✅                                                          |
| 3   | T9.2 安全四项 Vitest 回归                                                               | ✅                                                          |
| 4   | T9.3 签名配置占位 + README 说明                                                         | ✅                                                          |
| 5   | `Feature.md` MVP 相关条目已按实现勾选；验收报告已更新                                   | ✅                                                          |
| 6   | 覆盖率门禁（全局 statements ≥85%）                                                      | ✅（`12c1581` 起接入 CI）                                   |
| 7   | Playwright 黄金路径 + 专项 E2E（T5.6/T6.5/T6.7/T7.3/T9.4）                              | ✅                                                          |
| 8   | 依赖边界校验（T0.5 dependency-cruiser）+ 网络 mock（T0.3，以 `vi.stubGlobal` 等效落地） | ✅                                                          |
| 9   | 代码签名（可选）                                                                        | ⏳ 未启用（不影响发布；有预算或接免费方案时按 README 启用） |

逐项任务完成度见验收报告 §4；**51/51 任务完成**（T0.3 以等效方案满足，非 MSW 实现）。代码签名是可选项，不构成任何发布前置条件。

---

## 6. 追溯矩阵（任务 ↔ PRD/Feature.md 对照，节选关键映射）

| 本文档任务       | PRD 章节               | Feature.md 章节   |
| ---------------- | ---------------------- | ----------------- |
| T3.1~T3.6        | §6.1 订阅管理          | 1.1 / 1.2 / 1.3   |
| T4.1~T4.4        | §6.2 播客内容浏览      | 2.1 / 2.2 / 2.3   |
| T5.1~T5.6        | §6.3 音频播放          | 3.1（部分）       |
| T6.1~T6.7        | §6.4 离线下载          | 4.1 / 4.2（部分） |
| T7.1~T7.3        | §6.5 本地数据 / §11.1  | 5.1 / 11.1        |
| T8.1~T8.3        | §6.8 跨平台支持        | 8.3               |
| T8.4~T8.6        | §11.3 错误恢复与可靠性 | 11.3              |
| T2.2, T9.2, T9.3 | §7.3 安全与隐私        | 11.4              |

> 完整逐条对照请交叉核对三份文档；本表仅列出 Epic 级映射，避免重复维护一份完整的行级映射表造成后续同步负担。

---

## 附录：后续（P1）任务拆解占位

P1 阶段任务拆解（OPML、播放列表、变速播放、系统托盘/媒体控件集成、全局快捷键、深链接、自动更新、多语言、笔记等）将在 MVP 交付后另起 `mdocs/P1.md` 文档，沿用本文档相同的任务拆解格式（依赖、验收标准、测试要求三段式），届时需回顾 MVP 阶段沉淀的 Repository/IPC 契约模式是否需要调整以支撑播放列表等新增数据模型。

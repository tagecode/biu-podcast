# P2 验收记录

| 字段     | 内容 |
| -------- | ---- |
| 应用     | 博播 BiuPodcast |
| 对照文档 | `mdocs/P2.md`、`mdocs/P2-Implementation-Plan.md`、`mdocs/P2-6-NowPlaying-Spike.md`、`mdocs/Feature.md` |
| 验收策略 | 自动化（Vitest）先过门禁；三平台人工签收见 §3（与 P1 相同：发布后补签，不阻断 v2.2.0） |
| 报告日期 | 2026-09-15 |
| 代码基线 | `main`（v2.2.0） |

---

## 1. 任务完成状态

| 任务 | 内容 | 状态 | 自动化依据 |
| ---- | ---- | ---- | ---------- |
| P2-1 | 开机自启 | ✅ | `auto-launch` Linux desktop 单测 + Win/mac login-items 路由/payload 单测；设置页开关失败回滚 |
| P2-2 | 拖拽 OPML 导入 | ✅ | `importOpmlFromPath` 拒非 OPML；AppShell 成功 drop + 非法文件提示。**偏差**：直接导入，不经过设置页 OPML 预览对话框 |
| P2-3 | 复制链接 / 分享降级 | ✅ | `share-link` 纯函数；详情页/集数复制成功「已复制」 |
| P2-4 | 右键上下文菜单 | ✅ | 主进程模板；输入框（含 portal）；订阅 / 集数 / 播放列表组件测试 |
| P2-5 | macOS Dock 菜单 | ✅ 代码 | 模板随播放态变化（含暂停→「播放」）。**待 macOS 真机签收** |
| P2-6 | Now Playing Spike | ✅ | `mdocs/P2-6-NowPlaying-Spike.md` 结论 `defer-with-noop`；darwin 保持 `noopMediaSession` |

非目标（目录搜索、云同步、隐身模式、跳过静音等）未纳入本期。

---

## 2. 自动化门禁

本地关闭前应全绿：`pnpm test`、`pnpm run lint`、`pnpm run typecheck`。CI（lint / typecheck / test / build）随 `main` 与 Release tag 跑。

---

## 3. 人工签收清单（发布后补签）

Windows / macOS / Linux 各勾一次。不支持的能力验收「降级提示/隐藏」，不要当成缺陷。

| 项 | Win | macOS | Linux |
| -- | --- | ----- | ----- |
| 设置「登录时自动启动」开/关后，注销再登录行为符合预期 | ☐ | ☐ | ☐ |
| 拖入 `.opml` 导入成功；拖入 `.txt` 提示非法且不写库 | ☐ | ☐ | ☐ |
| 播客/集数「复制链接」后出现「已复制」 | ☐ | ☐ | ☐ |
| 输入框（含添加订阅对话框）右键：剪切/复制/粘贴 | ☐ | ☐ | ☐ |
| 订阅卡片右键：打开详情 / 刷新 / 取消订阅 | ☐ | ☐ | ☐ |
| 集数行右键：播放 / 下载 / 加入队列 | ☐ | ☐ | ☐ |
| 播放列表右键：重命名 / 删除 | ☐ | ☐ | ☐ |
| 断网：已订阅列表、已下载播放、播放列表、导入导出仍可用 | ☐ | ☐ | ☐ |
| Dock 右键：空闲仅显示窗口；播放中可暂停/上下集（仅 macOS） | — | ☐ | — |

Now Playing / 控制中心元数据：**不在本期验收**（Spike 后仍降级）。

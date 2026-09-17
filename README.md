# 博播 BiuPodcast

[![CI](https://img.shields.io/github/actions/workflow/status/tagecode/biu-podcast/ci.yml?branch=main&label=CI)](https://github.com/tagecode/biu-podcast/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/tagecode/biu-podcast)](https://github.com/tagecode/biu-podcast/releases/latest)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue.svg)

**博播（BiuPodcast）** 是一款本地优先（Local-first）、离线优先（Offline-first）的桌面播客客户端。所有订阅、播放进度与下载内容都保存在本机，无需账号，数据完全由你掌控。

> 暖琥珀色的设计语言，聚焦"数据在本机、离线可用"的踏实感。数据可完整导出/导入，永不锁死。

## 🖼️ 界面预览

![订阅列表](assets/screenshots/list.png)

![播客详情](assets/screenshots/detail.png)

## ✨ 功能特性

- **订阅管理** — RSS 添加与重复检测，手动/自动刷新，暂停订阅，本机分类文件夹，OPML 预览后再导入/导出
- **播客浏览** — 详情页简介/封面/作者，未听与已听计数，已下载标识，集数详情与章节，复制分享链接
- **音频播放** — 迷你 + 全屏播放器，进度持久化（重启不自动出声），播放队列/循环/随机，变速，睡眠定时
- **离线下载** — 单集与「下载全部」、并发队列、暂停/继续/取消、断点续传、重启恢复、完整性校验
- **本地数据** — SQLite 存储订阅与进度，播放列表与时间戳笔记，`.biubackup` 导出/导入（含冲突预览）
- **桌面体验** — 单实例与窗口记忆，原生菜单与右键菜单，系统托盘与媒体键，开机自启，中/英界面
- **隐私安全** — 渲染进程沙箱/隔离、CSP、HTML 净化，数据不出本机

## 📦 安装

从 [Releases](https://github.com/tagecode/biu-podcast/releases) 下载对应平台的安装包：

| 平台    | 架构  | 格式                             |
| ------- | ----- | -------------------------------- |
| Windows | x64   | `.exe`（NSIS 安装包，可自选目录） |
| macOS   | arm64 | `.dmg` / `.zip`（Apple Silicon） |
| macOS   | x64   | `.dmg` / `.zip`（Intel）         |
| Linux   | x64   | `.AppImage` / `.deb`             |

> 安装包目前未签名：macOS 首次打开需在「系统设置 → 隐私与安全性」中允许；Windows 若有 SmartScreen 提示，选择「更多信息 → 仍要运行」。

## 🔨 从源码构建

环境要求：[Node.js](https://nodejs.org/) ≥ 20、[pnpm](https://pnpm.io/) ≥ 10。

```bash
# 安装依赖
pnpm install

# 开发模式（热重载）
pnpm dev

# 运行测试（单元 + 集成）
pnpm test
pnpm test:coverage   # 覆盖率门禁

# 端到端测试（Playwright，驱动打包产物）
pnpm test:e2e

# 构建当前平台安装包
pnpm build:win    # Windows
pnpm build:mac    # macOS
pnpm build:linux  # Linux（AppImage + deb）
```

## 🧪 质量保障

- **三层测试**：单元测试（Vitest + Testing Library）+ 主进程集成测试 + Playwright E2E（冒烟 / 黄金路径 / 续播 / 续传 / 离线播放）
- **覆盖率门禁**：核心业务域语句覆盖率 ≥ 85%（当前 90%+）
- **依赖边界校验**：dependency-cruiser 防止 feature 间越权引用
- **CI 门禁**：每次推送跑 `lint → 依赖边界 → typecheck → 单元测试 → 覆盖率 → 构建 → E2E`；三平台安装包在打 `v*` tag 时由 Release workflow 产出

## 🤝 贡献

欢迎参与贡献！请先阅读 [CONTRIBUTING.md](./CONTRIBUTING.md) 与 [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)。

版本记录见 [CHANGELOG.md](./CHANGELOG.md)。开发架构文档见 `mdocs/`：产品需求（[Prd.md](./mdocs/Prd.md)）、技术方案（[Arch.md](./mdocs/Arch.md)）、功能清单（[Feature.md](./mdocs/Feature.md)）、MVP 任务拆解（[Mvp.md](./mdocs/Mvp.md)）、品牌规范（[brand-spec.md](./mdocs/brand-spec.md)）。

## 📄 许可证

[MIT](./LICENSE) © 2026 tagecode

# Changelog

本项目的所有显著变更都会记录在此文件。格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 新增
- 开源基础设施：MIT 许可证、社区文档（贡献指南 / 行为准则 / 安全策略）、README 重写、GitHub 仓库元数据

### 工程
- 依赖边界校验（dependency-cruiser）接入 `pnpm lint`
- download 域覆盖率提升至 88.84%（所有核心域 ≥85%）

## [1.0.0] - 2026-08-04

### 新增
- MVP 完整功能主链路：
  - 订阅管理：RSS 添加 / 解析 / 去重 / 刷新 / 取消订阅
  - 播客浏览：详情页、集数列表（已听 / 已下载状态）、富文本安全渲染、标记全部已听
  - 音频播放：迷你 + 全屏播放器、上下集、进度拖拽、进度持久化、重启恢复（不自动出声）
  - 离线下载：单集下载、并发队列、暂停 / 继续 / 取消、断点续传、重启自动恢复、完整性校验
  - 本地数据：SQLite 存储、`.biubackup` 导出 / 导入（含冲突预览）
  - 桌面基础：单实例锁定、窗口状态记忆、原生菜单
- 三层测试体系：Vitest（100 用例）+ Playwright E2E（冒烟 / 黄金路径 / 续播 / 续传 / 离线播放，5 用例）
- CI 流水线：lint → 依赖边界 → typecheck → 单元 → 覆盖率 → 构建 → E2E；三平台（Win / macOS arm64+x64 / Linux）安装包自动产出
- 安全基线：`sandbox` / `contextIsolation` / CSP / HTML 净化四项，Vitest 回归

[Unreleased]: https://github.com/tagecode/biu-podcast/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/tagecode/biu-podcast/releases/tag/v1.0.0

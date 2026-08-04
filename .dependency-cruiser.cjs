/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'renderer-feature-boundary',
      comment:
        '渲染进程 features/<a> 不得 import features/<b>（a ≠ b）的内部模块。' +
        '同 feature 内部引用天然放行（$1 引用 from 捕获组）。' +
        'PodcastDetailPage（跨 store 消费）与 SettingsPage（刷新订阅）是已知的有意跨 feature 引用，在 from.pathNot 中豁免。',
      from: {
        path: '^src/renderer/src/features/([^/]+)',
        pathNot:
          '^src/renderer/src/features/episode/pages/PodcastDetailPage\\.tsx$|' +
          '^src/renderer/src/features/settings/pages/SettingsPage\\.tsx$'
      },
      to: {
        path: '^src/renderer/src/features/',
        pathNot: '^src/renderer/src/features/$1/'
      }
    },
    {
      name: 'renderer-no-main-import',
      comment: '渲染进程不得直接 import 主进程代码（主进程通过 preload/IPC 暴露能力）。',
      from: { path: '^src/renderer/' },
      to: { path: '^src/main/' }
    },
    {
      name: 'no-circular',
      severity: 'error',
      comment: '禁止循环依赖。',
      from: {},
      to: { circular: true }
    }
  ],
  options: {
    doNotFollow: {
      path: 'node_modules'
    },
    exclude: {
      path: '(\\.test\\.|\\.spec\\.|test-utils|out|dist|coverage)'
    },
    tsConfig: {
      fileName: 'tsconfig.web.json'
    },
    tsPreCompilationDeps: true
  }
}

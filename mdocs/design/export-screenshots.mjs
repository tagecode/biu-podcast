/**
 * Export HTML mockups to PNG screenshots.
 *
 * Prerequisites (one-time):
 *   npx playwright install chromium
 *
 * Usage:
 *   node mdocs/design/export-screenshots.mjs
 */
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import http from 'node:http'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const mockupsDir = path.join(__dirname, 'mockups')
const screenshotsDir = path.join(__dirname, 'screenshots')
const PORT = 8765

const pages = [
  { html: '01-subscription-list.html', png: '01-subscription-list.png' },
  { html: '02-empty-state.html', png: '02-empty-state.png' },
  { html: '03-add-subscription.html', png: '03-add-subscription.png' },
  { html: '04-podcast-detail.html', png: '04-podcast-detail.png' },
  { html: '05-fullscreen-player.html', png: '05-fullscreen-player.png' },
  { html: '06-download-queue.html', png: '06-download-queue.png' },
  { html: '07-offline-state.html', png: '07-offline-state.png' },
  { html: '08-settings-data.html', png: '08-settings-data.png' },
  { html: '09-dark-theme.html', png: '09-dark-theme.png' },
]

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url?.split('?')[0] ?? '/')
      const filePath = path.join(mockupsDir, urlPath === '/' ? '01-subscription-list.html' : urlPath.slice(1))
      if (!filePath.startsWith(mockupsDir)) {
        res.writeHead(403)
        res.end()
        return
      }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404)
          res.end()
          return
        }
        const ext = path.extname(filePath)
        const types = { '.html': 'text/html', '.css': 'text/css' }
        res.writeHead(200, { 'Content-Type': types[ext] ?? 'application/octet-stream' })
        res.end(data)
      })
    })
    server.listen(PORT, () => resolve(server))
    server.on('error', reject)
  })
}

fs.mkdirSync(screenshotsDir, { recursive: true })

const server = await startServer()
const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1400, height: 900 },
  deviceScaleFactor: 2,
})

for (const page of pages) {
  const tab = await context.newPage()
  await tab.goto(`http://127.0.0.1:${PORT}/${page.html}`, { waitUntil: 'networkidle' })
  await tab.locator('.window').screenshot({ path: path.join(screenshotsDir, page.png) })
  console.log(`✓ ${page.png}`)
  await tab.close()
}

await browser.close()
server.close()
console.log(`\nDone. ${pages.length} screenshots → mdocs/design/screenshots/`)

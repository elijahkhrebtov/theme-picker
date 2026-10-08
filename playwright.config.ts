import { defineConfig } from '@playwright/test'
const port = Number(process.env.PLAYWRIGHT_PORT || 5173)
const baseURL = `http://127.0.0.1:${port}`
export default defineConfig({
  testDir: './tests',
  use: {
    baseURL,
    viewport: { width: 1720, height: 1080 },
    launchOptions: { args: ['--no-sandbox', '--enable-unsafe-swiftshader'] },
  },
  reporter: 'list',
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
})

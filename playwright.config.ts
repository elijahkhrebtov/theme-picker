import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1720, height: 1080 },
    launchOptions: { args: ['--no-sandbox', '--enable-unsafe-swiftshader'] },
  },
  reporter: 'list',
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
})

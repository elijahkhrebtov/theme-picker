import { expect, test } from '@playwright/test'

const storageKey = 'theme-studio:v1'
const savedThemes = async (page: import('@playwright/test').Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), storageKey)

test('renders four columns, GPU graphs, and synchronized scrolling', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    const draw = WebGL2RenderingContext.prototype.drawArrays
    WebGL2RenderingContext.prototype.drawArrays = function (...args) {
      draw.apply(this, args)
      const pixels = new Uint8Array(4 * this.drawingBufferWidth * this.drawingBufferHeight)
      this.readPixels(0, 0, this.drawingBufferWidth, this.drawingBufferHeight, this.RGBA, this.UNSIGNED_BYTE, pixels)
      if (pixels.some(value => value > 0)) (this.canvas as HTMLCanvasElement).dataset.gpuPainted = 'true'
    }
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Theme studio.' })).toBeVisible()
  await expect(page.locator('.token-row')).toHaveCount(23)
  const columns = await page.locator('.showcase-dark, .showcase-light, .editor-pane, .variables-pane').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().x))
  expect(columns).toEqual([...columns].sort((a, b) => a - b))
  await expect(page.locator('.gpu-chart')).toHaveCount(3)
  await page.waitForTimeout(400)
  for (const canvas of await page.locator('.gpu-chart').all()) await expect(canvas).toHaveAttribute('data-gpu-painted', 'true')
  const start = await page.locator('.showcase-dark, .showcase-light').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().top))
  await page.mouse.move(300, 550)
  await page.mouse.wheel(0, 650)
  await page.waitForTimeout(200)
  const end = await page.locator('.showcase-dark, .showcase-light').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().top))
  expect(start[0] - end[0]).toBeGreaterThan(300)
  expect(start[0] - end[0]).toEqual(start[1] - end[1])
  await expect(page.locator('.editor-pane')).toHaveJSProperty('scrollTop', 0)
  const fixedTops = await page.locator('.fixed-pane').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().top))
  expect(fixedTops).toEqual([65, 65])
  expect(errors).toEqual([])
})

test('changes only selected lightness/chroma, shares hue across every token, persists on reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('spinbutton', { name: 'Lightness', exact: true }).fill('0.61')
  await page.getByRole('spinbutton', { name: 'Lightness', exact: true }).press('Enter')
  await page.getByRole('spinbutton', { name: 'Chroma', exact: true }).fill('0.14')
  await page.getByRole('spinbutton', { name: 'Chroma', exact: true }).press('Enter')
  let themes = await savedThemes(page)
  expect(themes.light.accent.l).toBe(.61)
  expect(themes.light.accent.c).toBe(.14)
  expect(themes.dark.accent.l).toBe(.69)
  await page.getByRole('spinbutton', { name: 'Hue', exact: true }).fill('145')
  await page.getByRole('spinbutton', { name: 'Hue', exact: true }).press('Enter')
  themes = await savedThemes(page)
  for (const theme of Object.values(themes) as Record<string, { h: number }>[]) expect(Object.values(theme).every(c => c.h === 145)).toBe(true)
  const liveColor = await page.locator('.showcase-light').evaluate(node => (node as HTMLElement).style.getPropertyValue('--accent'))
  expect(liveColor).toBe('oklch(61% 0.14 145)')
  await page.getByRole('tab', { name: 'Dark', exact: true }).click()
  await expect(page.getByRole('spinbutton', { name: 'Lightness', exact: true })).toHaveValue('0.69')
  await page.reload()
  await expect(page.getByRole('spinbutton', { name: 'Hue', exact: true })).toHaveValue('145')
  await expect(page.getByRole('spinbutton', { name: 'Lightness', exact: true })).toHaveValue('0.61')
})

test('supports chart dragging, numeric expressions, precision stepping and CSS color input', async ({ page }) => {
  await page.goto('/')
  const graph = page.locator('.gamut-chart').first()
  const box = (await graph.boundingBox())!
  await page.mouse.move(box.x + box.width * .5, box.y + box.height * .5)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * .7, box.y + box.height * .75)
  await page.mouse.up()
  let themes = await savedThemes(page)
  expect(themes.light.accent.l).toBeCloseTo(.7, 2)
  expect(themes.light.accent.c).toBeCloseTo(.1175, 2)
  const input = page.getByRole('spinbutton', { name: 'Lightness', exact: true })
  await input.fill('0.5 + 0.1')
  await input.press('Enter')
  await expect(input).toHaveValue('0.6')
  await input.press('Shift+ArrowUp')
  await expect(input).toHaveValue('0.601')
  await page.getByRole('textbox', { name: 'OKLCH color', exact: true }).fill('oklch(65% 0.12 280)')
  await page.getByRole('textbox', { name: 'OKLCH color', exact: true }).press('Enter')
  themes = await savedThemes(page)
  expect(themes.light.accent).toEqual({ l: .65, c: .12, h: 280 })
  await page.getByRole('combobox', { name: 'Color format' }).selectOption('hsl')
  await expect(page.getByRole('textbox', { name: 'Traditional color' })).toHaveValue(/^hsl\(/)
  await page.getByRole('textbox', { name: 'Traditional color' }).fill('#ff0000')
  await page.getByRole('textbox', { name: 'Traditional color' }).press('Enter')
  themes = await savedThemes(page)
  expect(themes.light.accent.h).toBeCloseTo(29.23, 1)
  expect(themes.dark['surface-1'].h).toEqual(themes.light.accent.h)
})

test('shows out-of-gamut warning and usable sRGB fallback', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('textbox', { name: 'OKLCH color', exact: true }).fill('oklch(50% 0.47 265)')
  await page.getByRole('textbox', { name: 'OKLCH color', exact: true }).press('Enter')
  await expect(page.getByText('Unavailable on any device')).toBeVisible()
  await expect(page.locator('.fallback-color')).toBeVisible()
  await page.getByRole('button', { name: 'Use sRGB fallback' }).click()
  await expect(page.locator('.color-space-label')).toHaveText('sRGB')
  const themes = await savedThemes(page)
  expect(themes.dark.accent.h).toBe(themes.light.accent.h)
  expect(themes.light.accent.c).toBeLessThan(.47)
})

test('exports valid custom properties for both themes and copies them', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/')
  await page.getByRole('button', { name: /^Copy CSS/ }).click()
  await expect(page.getByRole('button', { name: /^Copied both themes/ })).toBeVisible()
  const css = await page.evaluate(() => navigator.clipboard.readText())
  expect(css).toMatch(/^:root \{/)
  expect(css).toContain('\n.dark {')
  expect(css.match(/--[\w-]+: oklch\(/g)).toHaveLength(46)
  expect(await page.evaluate(css => { const style = document.createElement('style'); style.textContent = css; document.head.append(style); return style.sheet!.cssRules.length }, css)).toBe(2)
  await page.getByRole('button', { name: 'View CSS' }).click()
  await expect(page.getByRole('textbox', { name: 'Exported theme CSS' })).toHaveValue(css)
})

test('preview controls interact and palette can be reset', async ({ page }) => {
  await page.goto('/')
  const dark = page.getByRole('region', { name: 'dark theme preview' })
  const notifications = dark.getByRole('switch', { name: 'Notifications', exact: true })
  await notifications.click()
  await expect(notifications).toHaveAttribute('aria-checked', 'false')
  await dark.getByRole('checkbox', { name: 'Only mentions' }).check()
  await expect(dark.getByRole('checkbox', { name: 'Only mentions' })).toBeChecked()
  await expect(dark.getByRole('switch', { name: 'Disabled notification setting' })).toBeDisabled()
  await dark.getByRole('tab', { name: 'Activity' }).click()
  await expect(dark.getByText('Alex shared an update')).toBeVisible()
  await page.getByRole('spinbutton', { name: 'Hue', exact: true }).fill('100')
  await page.getByRole('spinbutton', { name: 'Hue', exact: true }).press('Enter')
  await page.getByRole('button', { name: 'Reset palette' }).click()
  await page.getByRole('button', { name: 'Reset both themes' }).click()
  await expect(page.getByRole('spinbutton', { name: 'Hue', exact: true })).toHaveValue('265')
})

test('recovers corrupted storage', async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, '{"light":{}}'), storageKey)
  await page.goto('/')
  await expect(page.getByRole('spinbutton', { name: 'Hue', exact: true })).toHaveValue('265')
  await expect(page.locator('.token-row')).toHaveCount(23)
})

test('renders gamut graphs without WebGL2', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (contextId: string, ...args: unknown[]) {
      if (contextId === 'webgl2') return null
      return getContext.call(this, contextId as '2d', ...args)
    } as typeof getContext
  })
  await page.goto('/')
  await page.waitForTimeout(500)
  const painted = await page.locator('.fallback-chart').evaluateAll(nodes => nodes.map(node => {
    const canvas = node as HTMLCanvasElement
    return canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data.some(value => value > 0)
  }))
  expect(painted).toEqual([true, true, true])
  await page.getByRole('spinbutton', { name: 'Hue', exact: true }).fill('170')
  await page.getByRole('spinbutton', { name: 'Hue', exact: true }).press('Enter')
  expect((await savedThemes(page)).dark.accent.h).toBe(170)
})

test('provides selectable CSS when clipboard permission is denied', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', { value: async () => { throw new Error('Clipboard denied') } })
  })
  await page.goto('/')
  await page.getByRole('button', { name: /^Copy CSS/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText('Clipboard access is unavailable.', { exact: false })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Exported theme CSS' })).toHaveValue(/:root[\s\S]*\.dark/)
})

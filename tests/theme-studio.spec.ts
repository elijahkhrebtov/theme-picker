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
  await expect(page.locator('.token-row')).toHaveCount(54)
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

test('changes only selected lightness/chroma, shares core hue across both themes, persists on reload', async ({ page }) => {
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
  for (const theme of Object.values(themes) as Record<string, { h: number }>[]) {
    expect(Object.entries(theme).filter(([token]) => !/success|warning|danger/.test(token)).every(([, color]) => color.h === 145)).toBe(true)
    expect(theme.warning.h).toBe(85)
    expect(theme.danger.h).toBe(25)
  }
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
  expect(css.match(/--[\w-]+: oklch\(/g)).toHaveLength(108)
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
  await expect(page.locator('.token-row')).toHaveCount(54)
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


test('variable sections collapse independently and scroll without moving previews', async ({ page }) => {
  await page.goto('/')
  const list = page.locator('.token-list')
  expect(await list.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true)
  const surfaces = page.locator('.token-group').filter({ has: page.getByRole('heading', { name: 'Surfaces', exact: true }) })
  await surfaces.locator('summary').click()
  await expect(surfaces).not.toHaveAttribute('open', '')
  await expect(surfaces.locator('.token-row').first()).not.toBeVisible()
  await surfaces.locator('summary').focus()
  await page.keyboard.press('Enter')
  await expect(surfaces).toHaveAttribute('open', '')
  const before = await page.evaluate(() => window.scrollY)
  const box = (await list.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel(0, 1500)
  await expect.poll(() => list.evaluate(node => node.scrollTop)).toBeGreaterThan(100)
  expect(await page.evaluate(() => window.scrollY)).toBe(before)
  await expect(page.getByRole('button', { name: /^Copy CSS/ })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Dark', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /^Danger disabled oklch/ }).click()
  await expect(page.locator('.editor-title h2')).toHaveText('Danger disabled')
  const danger = page.locator('.token-group').filter({ has: page.getByRole('heading', { name: 'Danger', exact: true }) })
  await danger.locator('summary').click()
  await expect(danger.getByLabel('Contains selected variable')).toBeVisible()
  await expect(page.locator('.editor-title h2')).toHaveText('Danger disabled')
})

test('status families update actual foregrounds, borders, disabled, hover and active states', async ({ page }) => {
  await page.goto('/')
  const light = page.getByRole('region', { name: 'light theme preview' })
  const dark = page.getByRole('region', { name: 'dark theme preview' })
  const setColor = async (token: string, value: string) => {
    await page.locator('.token-row').filter({ has: page.locator('.token-name', { hasText: new RegExp(`^${token}$`) }) }).click()
    await page.getByRole('textbox', { name: 'OKLCH color', exact: true }).fill(value)
    await page.getByRole('textbox', { name: 'OKLCH color', exact: true }).press('Enter')
  }
  const computed = async (selector: import('@playwright/test').Locator, property: string) => selector.evaluate((node, property) => getComputedStyle(node).getPropertyValue(property), property)
  for (const family of ['Success', 'Warning', 'Danger']) {
    const card = light.getByRole('article', { name: `${family} feedback` })
    const lower = family.toLowerCase()
    await setColor(`${family} text secondary`, 'oklch(81% 0.06 265)')
    await expect.poll(() => computed(card.locator('.demo-status-alert p'), 'color')).toBe('oklch(0.81 0.06 265)')
    await setColor(`Text ${lower}`, 'oklch(41% 0.08 265)')
    await expect.poll(() => computed(card.locator('.demo-status-validation'), 'color')).toBe('oklch(0.41 0.08 265)')
    await setColor(`Border ${lower}`, 'oklch(59% 0.1 265)')
    await expect.poll(() => computed(card.locator('.demo-status-input'), 'border-top-color')).toBe('oklch(0.59 0.1 265)')
    await setColor(`${family} disabled`, 'oklch(75% 0.04 265)')
    await expect.poll(() => computed(card.locator('.demo-status-button:disabled'), 'background-color')).toBe('oklch(0.75 0.04 265)')
    await setColor(`${family} hover`, 'oklch(46% 0.12 265)')
    await setColor(`${family} active`, 'oklch(39% 0.11 265)')
    const action = card.locator('.demo-status-button:not(:disabled)')
    await action.hover()
    await expect.poll(() => computed(action, 'background-color')).toBe('oklch(0.46 0.12 265)')
    await page.mouse.down()
    await expect.poll(() => computed(action, 'background-color')).toBe('oklch(0.39 0.11 265)')
    await page.mouse.up()
    await expect(action).toHaveAttribute('aria-pressed', 'true')
    await expect(dark.getByRole('article', { name: `${family} feedback` }).locator('.demo-status-button:not(:disabled)')).toHaveAttribute('aria-pressed', 'false')
  }
  await setColor('Accent disabled', 'oklch(71% 0.03 265)')
  await expect.poll(() => computed(light.locator('.demo-disabled .demo-check'), 'background-color')).toBe('oklch(0.71 0.03 265)')
  await expect.poll(() => computed(light.getByRole('switch', { name: 'Disabled notification setting' }), 'background-color')).toBe('oklch(0.71 0.03 265)')
  await expect.poll(() => computed(light.getByRole('button', { name: 'Disabled', exact: true }), 'background-color')).toBe('oklch(0.71 0.03 265)')
  await page.reload()
  const themes = await savedThemes(page)
  expect(themes.light['danger-active'].l).toBe(.39)
  expect(themes.dark['danger-active'].l).toBe(.67)
})

test('adds new defaults to a saved legacy palette without losing edits', async ({ page }) => {
  await page.goto('/')
  const legacy = await savedThemes(page)
  for (const mode of ['light', 'dark']) {
    for (const token of Object.keys(legacy[mode])) {
      if (token === 'accent-disabled' || /^(success|warning|danger|text-(success|warning|danger)|border-(success|warning|danger))/.test(token)) delete legacy[mode][token]
      else legacy[mode][token].h = 210
    }
    expect(Object.keys(legacy[mode])).toHaveLength(23)
  }
  legacy.light.accent.l = .63
  legacy.dark['surface-1'].c = .032
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: storageKey, data: legacy })
  await page.reload()
  const migrated = await savedThemes(page)
  expect(migrated.light.accent).toEqual({ l: .63, c: .205, h: 210 })
  expect(migrated.dark['surface-1'].c).toBe(.032)
  for (const theme of Object.values(migrated) as Record<string, { h: number }>[]) {
    expect(Object.keys(theme)).toHaveLength(54)
    expect(Object.entries(theme).filter(([token]) => !/success|warning|danger/.test(token)).every(([, color]) => color.h === 210)).toBe(true)
    expect(theme.success.h).toBe(145)
    expect(theme.warning.h).toBe(85)
    expect(theme.danger.h).toBe(25)
  }
  await expect(page.locator('.token-count')).toHaveText('54 tokens')
})


test('shares status hues within each family across themes and preserves them on reload', async ({ page }) => {
  await page.goto('/')
  for (const [family, hue] of [['Success', 160], ['Warning', 95], ['Danger', 30]] as const) {
    await page.locator('.token-row').filter({ has: page.locator('.token-name', { hasText: new RegExp(`^${family}$`) }) }).click()
    await page.getByRole('spinbutton', { name: 'Hue', exact: true }).fill(String(hue))
    await page.getByRole('spinbutton', { name: 'Hue', exact: true }).press('Enter')
    await expect(page.locator('.hue-note')).toContainText(`${family}: 20 linked variables.`)
    const themes = await savedThemes(page)
    for (const theme of Object.values(themes) as Record<string, { h: number }>[]) {
      expect(Object.entries(theme).filter(([token]) => token.includes(family.toLowerCase())).every(([, color]) => color.h === hue)).toBe(true)
      expect(theme.accent.h).toBe(265)
      expect(theme['surface-1'].h).toBe(265)
    }
  }
  await page.getByRole('tab', { name: 'Dark', exact: true }).click()
  await page.getByRole('spinbutton', { name: 'Hue', exact: true }).fill('35')
  await page.getByRole('spinbutton', { name: 'Hue', exact: true }).press('Enter')
  await page.reload()
  const themes = await savedThemes(page)
  for (const theme of Object.values(themes) as Record<string, { h: number }>[]) {
    expect(theme.success.h).toBe(160)
    expect(theme.warning.h).toBe(95)
    expect(theme.danger.h).toBe(35)
    expect(theme['danger-text-secondary'].h).toBe(35)
    expect(theme['text-danger'].h).toBe(35)
  }
})

const openImport = async (page: import('@playwright/test').Page, css: string) => {
  await page.getByRole('button', { name: 'Import CSS', exact: true }).click()
  const input = page.getByRole('textbox', { name: 'CSS to import' })
  await expect(input).toBeFocused()
  await input.fill(css)
}
const exportedCSS = async (page: import('@playwright/test').Page) => {
  await page.getByRole('button', { name: 'View CSS' }).click()
  const css = await page.getByRole('textbox', { name: 'Exported theme CSS' }).inputValue()
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  return css
}

test('imports a current export exactly and preserves individual hues after reload', async ({ page }) => {
  await page.goto('/')
  const expected = await savedThemes(page)
  const css = (await exportedCSS(page))
    .replace('--accent: oklch(55% 0.205 265);', '--accent: oklch(61% 0.12 240);')
    .replace('--success: oklch(73% 0.14 145);', '--success: oklch(71% 0.13 160);')
  expected.light.accent = { l: .61, c: .12, h: 240 }
  expected.dark.success = { l: .71, c: .13, h: 160 }
  await page.getByRole('spinbutton', { name: 'Hue', exact: true }).fill('110')
  await page.getByRole('spinbutton', { name: 'Hue', exact: true }).press('Enter')
  await openImport(page, css)
  await page.getByRole('button', { name: 'Apply CSS' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  expect(await savedThemes(page)).toEqual(expected)
  await expect(page.getByRole('spinbutton', { name: 'Hue', exact: true })).toHaveValue('240')
  await expect(page.locator('.showcase-light')).toHaveCSS('background-color', 'oklch(0.975 0.006 265)')
  await page.reload()
  expect(await savedThemes(page)).toEqual(expected)
  // The picker still links its family when the user next edits hue.
  await page.getByRole('spinbutton', { name: 'Hue', exact: true }).fill('230')
  await page.getByRole('spinbutton', { name: 'Hue', exact: true }).press('Enter')
  const linked = await savedThemes(page)
  expect(linked.dark.accent.h).toBe(230)
  expect(linked.light['background-primary'].h).toBe(230)
  expect(linked.dark.success.h).toBe(160)
})

test('imports the previous 23-token export while leaving new tokens untouched', async ({ page }) => {
  await page.goto('/')
  const original = await savedThemes(page)
  const css = (await exportedCSS(page)).split('\n').filter(line => !/--(?:accent-disabled|success|warning|danger|text-(?:success|warning|danger)|border-(?:success|warning|danger))/.test(line)).join('\n')
  expect(css.match(/--[\w-]+:/g)).toHaveLength(46)
  await page.getByRole('spinbutton', { name: 'Hue', exact: true }).fill('210')
  await page.getByRole('spinbutton', { name: 'Hue', exact: true }).press('Enter')
  const before = await savedThemes(page)
  await openImport(page, css)
  await page.getByRole('button', { name: 'Apply CSS' }).click()
  const imported = await savedThemes(page)
  for (const mode of ['light', 'dark']) {
    for (const token of Object.keys(original[mode])) {
      const newToken = token === 'accent-disabled' || /success|warning|danger/.test(token)
      expect(imported[mode][token]).toEqual(newToken ? before[mode][token] : original[mode][token])
    }
  }
  await page.reload()
  expect(await savedThemes(page)).toEqual(imported)
})

test('imports only matching valid declarations and ignores extras without injecting CSS', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('tab', { name: 'Dark', exact: true }).click()
  const expected = await savedThemes(page)
  await openImport(page, `
    /* Old and current OKLCH notation, partial themes, and unrelated CSS. */
    :root {
      --surface-1: oklch(0.88 0.025 210) !important;
      --surface-2: definitely-not-a-color;
      --unknown: oklch(50% 0.1 50);
      --accent: oklch(50% 0.9 210);
    }
    .dark { --danger-disabled: oklch(45% 0.045 32); }
    .unrelated { --accent: #f00; }
    .app-header { display: none; }
    :root { --text-secondary: #ff0000; }
    .dark { --danger-disabled: oklch(47% 0.04 35); }
  `)
  await page.getByRole('button', { name: 'Apply CSS' }).click()
  const imported = await savedThemes(page)
  expected.light['surface-1'] = { l: .88, c: .025, h: 210 }
  expected.dark['danger-disabled'] = { l: .47, c: .04, h: 35 }
  expect(imported.light['text-secondary'].h).toBeCloseTo(29.23, 1)
  expected.light['text-secondary'] = imported.light['text-secondary']
  expect(imported).toEqual(expected)
  await expect(page.getByRole('heading', { name: 'Theme studio.' })).toBeVisible()
  const surface = page.locator('.showcase-light .demo-surface-1')
  await expect(surface).toHaveCSS('background-color', 'oklch(0.88 0.025 210)')
  await page.reload()
  expect(await savedThemes(page)).toEqual(expected)
})

test('invalid imports show an error without changing the palette and can be corrected', async ({ page }) => {
  await page.goto('/')
  const before = await savedThemes(page)
  await openImport(page, '')
  const input = page.getByRole('textbox', { name: 'CSS to import' })
  for (const css of ['', 'not css', ':root { --unknown: #abc; }', ':root { --accent: broken; }', '.other { --accent: #abc; }', ':root { --accent: oklch(50% 0.9 265); }']) {
    await input.fill(css)
    await page.getByRole('button', { name: 'Apply CSS' }).click()
    await expect(page.getByRole('alert')).toContainText('No valid matching colors found')
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(await savedThemes(page)).toEqual(before)
  }
  await input.fill(':root { --accent: oklch(60% 0.15 220); }')
  await expect(page.getByRole('alert')).not.toBeVisible()
  await page.getByRole('button', { name: 'Apply CSS' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  const expected = { ...before, light: { ...before.light, accent: { l: .6, c: .15, h: 220 } } }
  expect(await savedThemes(page)).toEqual(expected)
})

test('closing the import modal does not apply pasted CSS', async ({ page }) => {
  await page.goto('/')
  const before = await savedThemes(page)
  for (const close of ['button', 'escape', 'backdrop']) {
    await openImport(page, ':root { --accent: oklch(60% 0.15 220); }')
    if (close === 'button') await page.getByRole('button', { name: 'Close', exact: true }).click()
    else if (close === 'escape') await page.keyboard.press('Escape')
    else await page.locator('.dialog-backdrop').click({ position: { x: 5, y: 5 } })
    await expect(page.getByRole('dialog')).not.toBeVisible()
    expect(await savedThemes(page)).toEqual(before)
  }
})

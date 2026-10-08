import type { ThemeMode, ThemeValues } from './theme'
import { tokens } from './theme'
import { parseColor } from './picker/colors'

export function readThemeCSS(input: string): Record<ThemeMode, ThemeValues> {
  const updates: Record<ThemeMode, ThemeValues> = { light: {}, dark: {} }
  // Parse in a detached stylesheet: pasted rules never affect the app itself.
  try {
    const sheet = new CSSStyleSheet()
    sheet.replaceSync(input)
    for (const rule of sheet.cssRules) {
      if (!(rule instanceof CSSStyleRule)) continue
      const selectors = rule.selectorText.split(',').map(selector => selector.trim())
      const modes = (['light', 'dark'] as const).filter(mode => selectors.includes(mode === 'light' ? ':root' : '.dark'))
      if (!modes.length) continue
      for (const token of tokens) {
        const value = rule.style.getPropertyValue(`--${token}`).trim()
        if (!value || !CSS.supports('color', value)) continue
        const color = parseColor(value)
        if (!color || !Object.values(color).every(Number.isFinite) || color.l < 0 || color.l > 1 || color.c < 0 || color.c > .47 || color.h < 0 || color.h > 360) continue
        for (const mode of modes) updates[mode][token] = color
      }
    }
  } catch { /* Unsupported or unparseable CSS contains no usable updates. */ }
  return updates
}

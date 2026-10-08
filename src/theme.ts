export type Color = { l: number; c: number; h: number }
export type ThemeMode = 'light' | 'dark'
export const statusFamilies = ['success', 'warning', 'danger'] as const
export type StatusFamily = typeof statusFamilies[number]
const familyTokens = (family: string) => [family, `${family}-hover`, `${family}-active`, `${family}-disabled`, `${family}-text-primary`, `${family}-text-secondary`, `${family}-text-tertiary`, `${family}-border`, `text-${family}`, `border-${family}`]
export const tokenGroups = [
  { name: 'Foundations', tokens: ['background-primary'] },
  { name: 'Surfaces', tokens: ['surface-1', 'surface-1-hover', 'surface-1-active', 'surface-2', 'surface-2-hover', 'surface-2-active', 'surface-3', 'surface-3-hover', 'surface-3-active'] },
  { name: 'Text & borders', tokens: ['text-primary', 'text-secondary', 'text-tertiary', 'border'] },
  { name: 'Accent', tokens: ['accent', 'accent-hover', 'accent-active', 'accent-disabled', 'accent-text-primary', 'accent-text-secondary', 'accent-text-tertiary', 'accent-border'] },
  { name: 'Accented details', tokens: ['text-accented', 'border-accented'] },
  ...statusFamilies.map(family => ({ name: family.charAt(0).toUpperCase() + family.slice(1), tokens: familyTokens(family) })),
]
export const tokens = tokenGroups.flatMap(group => group.tokens)
export const hueFamily = (token: string) => statusFamilies.find(family => familyTokens(family).includes(token))
export const sharedHueTokens = (token: string) => {
  const family = hueFamily(token)
  return family ? familyTokens(family) : tokens.filter(value => !hueFamily(value))
}
export type ThemeValues = Record<string, Color>
export type Themes = Record<ThemeMode, ThemeValues>
export const displayName = (token: string) => token.charAt(0).toUpperCase() + token.slice(1).replaceAll('-', ' ')
export const number = (value: number, precision = 4) => String(Number(value.toFixed(precision)))
export const cssColor = ({ l, c, h }: Color) => `oklch(${number(l * 100)}% ${number(c)} ${number(h)})`
const light: [number, number][] = [
  [.975, .006], [1, .002], [.965, .009], [.94, .014], [.953, .009], [.925, .014], [.899, .021], [.917, .013], [.887, .020], [.855, .026],
  [.235, .028], [.47, .026], [.58, .022], [.862, .015],
  [.55, .205], [.505, .205], [.455, .185], [.76, .055], [.995, .002], [.93, .025], [.83, .052], [.46, .16], [.49, .19], [.57, .18],
]
const dark: [number, number][] = [
  [.155, .012], [.205, .014], [.24, .020], [.27, .024], [.25, .018], [.285, .024], [.32, .028], [.30, .022], [.335, .027], [.37, .03],
  [.948, .008], [.725, .021], [.565, .023], [.335, .023],
  [.69, .17], [.74, .155], [.64, .185], [.42, .055], [.17, .040], [.30, .055], [.39, .065], [.78, .12], [.765, .135], [.635, .14],
]
export function defaultThemes(): Themes {
  const baseTokens = tokenGroups.slice(0, 5).flatMap(group => group.tokens)
  const themes = Object.fromEntries(([['light', light], ['dark', dark]] as const).map(([mode, values]) => [mode, Object.fromEntries(baseTokens.map((token, i) => [token, { l: values[i][0], c: values[i][1], h: 265 }]))])) as Themes
  // Status backgrounds use their own foreground roles, while colored details
  // are intended for neutral surfaces, just like text-accented/border-accented.
  for (const family of statusFamilies) {
    for (const mode of ['light', 'dark'] as const) {
      const values: [number, number][] = mode === 'light'
        ? [[.53, .14], [.48, .14], [.43, .13], [.76, .045], [.99, .005], [.92, .025], [.84, .04], [.44, .115], [.44, .13], [.58, .12]]
        : [[.73, .14], [.78, .13], [.67, .15], [.43, .045], [.18, .025], [.29, .04], [.38, .045], [.82, .10], [.78, .12], [.64, .12]]
      const hue = { success: 145, warning: 85, danger: 25 }[family]
      familyTokens(family).forEach((token, i) => { themes[mode][token] = { l: values[i][0], c: values[i][1], h: hue } })
    }
  }
  return themes
}
export const STORAGE_KEY = 'theme-studio:v1'
export function loadThemes(): Themes {
  const defaults = defaultThemes()
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (!saved) return defaults
    const hue = saved.light?.accent?.h
    if (typeof hue !== 'number' || !Number.isFinite(hue) || hue < 0 || hue > 360) return defaults
    const restored = defaultThemes()
    const hues: Record<string, number> = { core: hue }
    for (const family of statusFamilies) {
      const familyHue = saved.light?.[family]?.h ?? defaults.light[family].h
      if (typeof familyHue !== 'number' || !Number.isFinite(familyHue) || familyHue < 0 || familyHue > 360) return defaults
      hues[family] = familyHue
    }
    for (const mode of ['light', 'dark'] as const) {
      if (!saved[mode] || typeof saved[mode] !== 'object') return defaults
      for (const token of tokens) {
        const value = saved[mode]?.[token]
        const tokenHue = hues[hueFamily(token) ?? 'core']
        // New tokens receive defaults without losing an existing saved palette.
        if (value === undefined) { restored[mode][token].h = tokenHue; continue }
        if (!value || !Number.isFinite(value.l) || !Number.isFinite(value.c) || value.l < 0 || value.l > 1 || value.c < 0 || value.c > .47) return defaults
        // Imports may contain individual hues. Only picker hue edits link tokens.
        const savedHue = value.h === undefined ? tokenHue : value.h
        if (!Number.isFinite(savedHue) || savedHue < 0 || savedHue > 360) return defaults
        restored[mode][token] = { l: value.l, c: value.c, h: savedHue }
      }
    }
    return restored
  } catch { /* Missing or corrupted storage falls back to the starter palette. */ }
  return defaults
}
export function exportCSS(themes: Themes): string {
  return (['light', 'dark'] as const).map(mode => `${mode === 'light' ? ':root' : '.dark'} {\n${tokens.map(token => `  --${token}: ${cssColor(themes[mode][token])};`).join('\n')}\n}`).join('\n\n')
}

export type Color = { l: number; c: number; h: number }
export type ThemeMode = 'light' | 'dark'
export const tokenGroups = [
  { name: 'Foundations', tokens: ['background-primary'] },
  { name: 'Surfaces', tokens: ['surface-1', 'surface-1-hover', 'surface-1-active', 'surface-2', 'surface-2-hover', 'surface-2-active', 'surface-3', 'surface-3-hover', 'surface-3-active'] },
  { name: 'Text & borders', tokens: ['text-primary', 'text-secondary', 'text-tertiary', 'border'] },
  { name: 'Accent', tokens: ['accent', 'accent-hover', 'accent-active', 'accent-text-primary', 'accent-text-secondary', 'accent-text-tertiary', 'accent-border'] },
  { name: 'Accented details', tokens: ['text-accented', 'border-accented'] },
]
export const tokens = tokenGroups.flatMap(group => group.tokens)
export type ThemeValues = Record<string, Color>
export type Themes = Record<ThemeMode, ThemeValues>
export const displayName = (token: string) => token.charAt(0).toUpperCase() + token.slice(1).replaceAll('-', ' ')
export const number = (value: number, precision = 4) => String(Number(value.toFixed(precision)))
export const cssColor = ({ l, c, h }: Color) => `oklch(${number(l * 100)}% ${number(c)} ${number(h)})`
const light: [number, number][] = [
  [.975, .006], [1, .002], [.965, .009], [.94, .014], [.953, .009], [.925, .014], [.899, .021], [.917, .013], [.887, .020], [.855, .026],
  [.235, .028], [.47, .026], [.58, .022], [.862, .015],
  [.55, .205], [.505, .205], [.455, .185], [.995, .002], [.93, .025], [.83, .052], [.46, .16], [.49, .19], [.57, .18],
]
const dark: [number, number][] = [
  [.155, .012], [.205, .014], [.24, .020], [.27, .024], [.25, .018], [.285, .024], [.32, .028], [.30, .022], [.335, .027], [.37, .03],
  [.948, .008], [.725, .021], [.565, .023], [.335, .023],
  [.69, .17], [.74, .155], [.64, .185], [.17, .040], [.30, .055], [.39, .065], [.78, .12], [.765, .135], [.635, .14],
]
export function defaultThemes(): Themes {
  return Object.fromEntries(([['light', light], ['dark', dark]] as const).map(([mode, values]) => [mode, Object.fromEntries(tokens.map((token, i) => [token, { l: values[i][0], c: values[i][1], h: 265 }]))])) as Themes
}
export const STORAGE_KEY = 'theme-studio:v1'
export function loadThemes(): Themes {
  const defaults = defaultThemes()
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (!saved) return defaults
    const hue = saved.light?.accent?.h
    if (typeof hue !== 'number' || !Number.isFinite(hue) || hue < 0 || hue > 360) return defaults
    for (const mode of ['light', 'dark'] as const) {
      for (const token of tokens) {
        const value = saved[mode]?.[token]
        if (!value || !Number.isFinite(value.l) || !Number.isFinite(value.c) || value.l < 0 || value.l > 1 || value.c < 0 || value.c > .47) return defaults
        defaults[mode][token] = { l: value.l, c: value.c, h: hue }
      }
    }
  } catch { /* Missing or corrupted storage falls back to the starter palette. */ }
  return defaults
}
export function exportCSS(themes: Themes): string {
  return (['light', 'dark'] as const).map(mode => `${mode === 'light' ? ':root' : '.dark'} {\n${tokens.map(token => `  --${token}: ${cssColor(themes[mode][token])};`).join('\n')}\n}`).join('\n\n')
}

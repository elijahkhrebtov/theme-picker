// Adapted from oklch-picker/lib/colors.ts. See LICENSE in this directory.
import { Colordx, colordx, extend } from '@colordx/core'
import p3Plugin, { inGamutP3 } from '@colordx/core/plugins/p3'
import rec2020Plugin, { inGamutRec2020 } from '@colordx/core/plugins/rec2020'
import type { Color } from '../theme'
import { cssColor } from '../theme'
extend([p3Plugin, rec2020Plugin])
export const Space = { Out: 0, sRGB: 1, P3: 2, Rec2020: 3 } as const
export function getSpace(color: Color): number {
  const raw = colordx(color)._rawRgb()
  const gap = .0001
  if ([raw.r, raw.g, raw.b].every(v => v / 255 >= -gap && v / 255 <= 1 + gap)) return Space.sRGB
  if (inGamutP3(color)) return Space.P3
  if (inGamutRec2020(color)) return Space.Rec2020
  return Space.Out
}
export const srgb = (color: Color) => Colordx.toGamutSrgb(color)
export const rgbString = (color: Color) => srgb(color).toRgbString({ legacy: true })
export const clippedString = (color: Color) => {
  const { r, g, b } = colordx(color)._rawRgb()
  return `rgb(${[r, g, b].map(v => Math.round(Math.min(255, Math.max(0, v)))).join(', ')})`
}
export const canvasFormat = (color: Color, p3: boolean) => p3 ? colordx(color).toP3String() : rgbString(color)
export function parseColor(input: string): Color | undefined {
  let value = input.trim().replace(/;$/, '').replace(/^[\w-]+:\s*/, '')
  if (/^[\da-f]{3}([\da-f]{3})?$/i.test(value)) value = `#${value}`
  if (/^[\d.]+%?\s+[\d.]+\s+[\d.]+$/.test(value)) value = `oklch(${value})`
  // Preserve user-entered OKLCH coordinates (including achromatic hue).
  const match = value.match(/^oklch\(\s*([\d.]+)(%)?\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*\)$/i)
  if (match) {
    const result = { l: Number(match[1]) / (match[2] ? 100 : 1), c: Number(match[3]), h: Number(match[4]) }
    return result.l <= 1 && result.c <= .47 && result.h <= 360 ? result : undefined
  }
  const dx = colordx(value)
  if (!dx.isValid()) return undefined
  const result = dx.toOklch(6)
  return { l: Math.max(0, Math.min(1, result.l)), c: Math.max(0, Math.min(.47, result.c)), h: result.h }
}
export function visibleColor(color: Color, p3: boolean, rec2020: boolean) {
  const space = getSpace(color)
  const supported = space === Space.sRGB || (space === Space.P3 && p3) || (space === Space.Rec2020 && rec2020)
  return { space, supported, real: supported ? cssColor(color) : undefined, fallback: rgbString(color), browserFallback: clippedString(color) }
}

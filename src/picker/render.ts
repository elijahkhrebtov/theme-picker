// Chart planes, pointer mapping, and gamut strip painting adapted from
// oklch-picker/view/{chart,range}/index.ts. See LICENSE.
import { createChartRenderer } from '@colordx/gpu'
import type { ChartRenderer } from '@colordx/gpu'
import type { Color } from '../theme'
import { canvasFormat, getSpace, rgbString, Space } from './colors'
export type Axis = 'l' | 'c' | 'h'
export const MAX_C = .47
export const chartAxes: Record<Axis, { x: Axis; y: Axis; fixed: Axis; plane: 'cl' | 'ch' | 'lh'; xMax: number; yMax: number }> = {
  l: { x: 'l', y: 'c', fixed: 'h', plane: 'cl', xMax: 1, yMax: MAX_C },
  c: { x: 'h', y: 'c', fixed: 'l', plane: 'ch', xMax: 360, yMax: MAX_C },
  h: { x: 'h', y: 'l', fixed: 'c', plane: 'lh', xMax: 360, yMax: 1 },
}
export function initChart(canvas: HTMLCanvasElement): ChartRenderer | undefined {
  try { return createChartRenderer(canvas, { model: 'oklch' }) ?? undefined } catch { return undefined }
}
export function paintChart(renderer: ChartRenderer, canvas: HTMLCanvasElement, type: Axis, color: Color, p3: boolean) {
  const rect = canvas.getBoundingClientRect()
  const ratio = window.devicePixelRatio || 1
  canvas.width = Math.round(rect.width * ratio)
  canvas.height = Math.round(rect.height * ratio)
  const config = chartAxes[type]
  renderer.paint({
    borderP3: [1, 1, 1, .9], borderRec2020: [.12, .14, .2, .85], borderWidth: 1,
    p3Output: p3, plane: config.plane, showP3: true, showRec2020: true,
    value: color[config.fixed], xMax: config.xMax, yMax: config.yMax,
  })
}
export function paintChartFallback(canvas: HTMLCanvasElement, type: Axis, color: Color, p3: boolean) {
  const ctx = canvas.getContext('2d', { colorSpace: p3 ? 'display-p3' : 'srgb' })
  if (!ctx) return
  const rect = canvas.getBoundingClientRect()
  canvas.width = Math.round(rect.width)
  canvas.height = Math.round(rect.height)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const config = chartAxes[type]
  const step = 3
  for (let y = 0; y < canvas.height; y += step) {
    let previous = Space.Out as number
    for (let x = 0; x < canvas.width; x += step) {
      const sample = { ...color, [config.x]: config.xMax * x / canvas.width, [config.y]: config.yMax * (1 - y / canvas.height) }
      const space = getSpace(sample)
      if (space !== Space.Out) {
        ctx.fillStyle = canvasFormat(sample, p3)
        ctx.fillRect(x, y, step, step)
        if (space !== previous && previous !== Space.Out) {
          ctx.fillStyle = space === Space.Rec2020 || previous === Space.Rec2020 ? '#242831' : '#ffffff'
          ctx.fillRect(x, y, 1, step)
        }
      }
      previous = space
    }
  }
}
export function paintStrip(canvas: HTMLCanvasElement, type: Axis, color: Color, p3: boolean): number[] {
  const ctx = canvas.getContext('2d', { colorSpace: p3 ? 'display-p3' : 'srgb' })
  if (!ctx) return []
  const rect = canvas.getBoundingClientRect()
  const ratio = window.devicePixelRatio || 1
  canvas.width = Math.round(rect.width * ratio)
  canvas.height = Math.round(rect.height * ratio)
  const { width, height } = canvas
  const half = Math.floor(height / 2)
  const max = type === 'l' ? 1 : type === 'c' ? MAX_C : 360
  const sliderStep = type === 'h' ? .01 : .0001
  const stops: number[] = []
  ctx.clearRect(0, 0, width, height)
  const getColor = (x: number) => ({ ...color, [type]: max * x / width })
  let prevSpace = getSpace(getColor(0))
  for (let x = 0; x <= width; x++) {
    const sample = getColor(x)
    const space = getSpace(sample)
    if (space !== Space.Out) {
      ctx.fillStyle = canvasFormat(sample, p3)
      if (space === Space.sRGB) ctx.fillRect(x, 0, 1, height)
      else {
        ctx.fillRect(x, 0, 1, half)
        ctx.fillStyle = rgbString(sample)
        ctx.fillRect(x, half, 1, half + 1)
      }
      if (prevSpace !== space) {
        const entering = prevSpace === Space.Out || (prevSpace === Space.Rec2020 && space === Space.P3) || (prevSpace === Space.P3 && space === Space.sRGB)
        const boundary = getColor(entering ? x : x - 1)[type]
        stops.push((entering ? Math.ceil : Math.floor)(boundary / sliderStep) * sliderStep)
        ctx.fillStyle = space === Space.Rec2020 || prevSpace === Space.Rec2020 ? '#242831' : '#ffffff'
        ctx.fillRect(x, 0, 1, height)
      }
    } else {
      if (prevSpace !== Space.Out) stops.push(Math.floor(getColor(x - 1)[type] / sliderStep) * sliderStep)
      if (type === 'c') return stops
    }
    prevSpace = space
  }
  return stops
}

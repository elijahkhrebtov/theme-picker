import { useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent } from 'react'
import type { ChartRenderer } from '@colordx/gpu'
import { ArrowDown, ArrowUp, Check, Copy, Globe2, Link2 } from 'lucide-react'
import type { Color } from '../theme'
import { cssColor, number } from '../theme'
import { parseColor, srgb, visibleColor } from './colors'
import { computeExpression, cycleByWheel } from './math'
import { chartAxes, initChart, MAX_C, paintChart, paintChartFallback, paintStrip } from './render'
import type { Axis } from './render'
import './ColorPicker.css'

function useDisplaySupport() {
  const [support, setSupport] = useState({ p3: false, rec2020: false })
  useEffect(() => {
    const p3 = matchMedia('(color-gamut: p3)')
    const rec = matchMedia('(color-gamut: rec2020)')
    const update = () => setSupport({ p3: CSS.supports('color', 'color(display-p3 1 1 1)') && p3.matches, rec2020: rec.matches })
    update()
    p3.addEventListener('change', update)
    rec.addEventListener('change', update)
    return () => { p3.removeEventListener('change', update); rec.removeEventListener('change', update) }
  }, [])
  return support
}
function ColorField({ value, label, onChange, children }: { value: string; label: string; onChange: (c: Color) => void; children?: React.ReactNode }) {
  const [draft, setDraft] = useState<string | null>(null)
  const [invalid, setInvalid] = useState(false)
  const [copied, setCopied] = useState(false)
  return <div className={`color-field ${invalid ? 'invalid' : ''}`}>
    <input aria-label={label} aria-invalid={invalid} value={draft ?? value} spellCheck={false}
      onFocus={e => { setDraft(value); e.target.select() }}
      onChange={e => { const text = e.target.value; setDraft(text); const parsed = parseColor(text); setInvalid(!parsed); if (parsed) onChange(parsed) }}
      onBlur={() => { setDraft(null); setInvalid(false) }}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur() }} />
    {children}
    <button className="field-copy" aria-label={`Copy ${label}`} onClick={async () => {
      try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { setInvalid(true) }
    }}>{copied ? <Check size={13} /> : <Copy size={13} />}</button>
  </div>
}
function PickerSection({ axis, color, onChange, p3 }: { axis: Axis; color: Color; onChange: (patch: Partial<Color>) => void; p3: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stripRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<ChartRenderer | undefined>(undefined)
  const fallbackRef = useRef<HTMLCanvasElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const latest = useRef(color)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [stops, setStops] = useState<number[]>([])
  const [draft, setDraft] = useState<string | null>(null)
  const [invalid, setInvalid] = useState(false)
  const id = useId()
  const max = axis === 'l' ? 1 : axis === 'c' ? MAX_C : 360
  const step = axis === 'h' ? 1 : .01
  const config = chartAxes[axis]
  const label = { l: 'Lightness', c: 'Chroma', h: 'Hue' }[axis]
  useEffect(() => { latest.current = color }, [color])
  useEffect(() => {
    rendererRef.current = initChart(canvasRef.current!)
    return () => { rendererRef.current?.destroy(); clearTimeout(timer.current) }
  }, [])
  useEffect(() => {
    const paint = () => {
      if (rendererRef.current) paintChart(rendererRef.current, canvasRef.current!, axis, color, p3)
      else paintChartFallback(fallbackRef.current!, axis, color, p3)
      setStops(paintStrip(stripRef.current!, axis, color, p3))
    }
    const frame = requestAnimationFrame(paint)
    const observer = new ResizeObserver(paint)
    observer.observe(canvasRef.current!)
    return () => { cancelAnimationFrame(frame); observer.disconnect() }
  }, [axis, color, p3])
  useEffect(() => {
    const hotkey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const target = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) && target.getAttribute('role') !== 'spinbutton') return
      if (e.key.toLowerCase() === axis) { e.preventDefault(); inputRef.current?.focus(); inputRef.current?.select() }
    }
    window.addEventListener('keydown', hotkey)
    return () => window.removeEventListener('keydown', hotkey)
  }, [axis])
  function normalize(value: number) {
    return Number(Math.max(0, Math.min(max, axis === 'h' ? cycleByWheel(value, 360) : value)).toFixed(axis === 'h' ? 2 : 4))
  }
  function spin(direction: number, slow: boolean) {
    const value = normalize(latest.current[axis] + direction * step * (slow ? .1 : 1))
    latest.current = { ...latest.current, [axis]: value }
    setDraft(null)
    setInvalid(false)
    onChange({ [axis]: value })
  }
  function startSpin(e: PointerEvent<HTMLButtonElement>, direction: number) {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    spin(direction, e.shiftKey)
    const repeat = () => { spin(direction, e.shiftKey); timer.current = setTimeout(repeat, 50) }
    timer.current = setTimeout(repeat, 400)
  }
  function select(e: PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height))
    onChange({ [config.x]: Number((x * config.xMax).toFixed(4)), [config.y]: Number((y * config.yMax).toFixed(4)) })
  }
  const commit = () => {
    const expression = draft ?? String(color[axis])
    if (!/^[\d.\s+*/-]+$/.test(expression) || !Number.isFinite(computeExpression(expression))) { setInvalid(true); return }
    onChange({ [axis]: normalize(computeExpression(expression)) })
    setDraft(null)
    setInvalid(false)
  }
  return <section className="picker-section">
    <div className="picker-section-heading">
      <h3>{label} {axis === 'h' && <Link2 size={12} aria-label="Shared across both themes" />}</h3>
      <div className={`number-field ${invalid ? 'invalid' : ''}`}>
        <kbd>{axis.toUpperCase()}</kbd>
        <input ref={inputRef} aria-label={label} role="spinbutton" aria-valuemin={0} aria-valuemax={max} aria-valuenow={color[axis]} aria-invalid={invalid} inputMode="decimal"
          value={draft ?? number(color[axis])} onFocus={e => e.target.select()} onChange={e => {
            const text = e.target.value; setDraft(text); setInvalid(false)
            if (/^\d+(\.\d+)?$/.test(text) && Number(text) <= max) onChange({ [axis]: Number(text) })
          }} onBlur={commit} onKeyDown={e => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') { setDraft(null); setInvalid(false); e.currentTarget.blur() }
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); spin(e.key === 'ArrowUp' ? 1 : -1, e.shiftKey) }
          }} />
        <div className="spin-buttons">{[1, -1].map(direction => <button key={direction} aria-label={`${direction > 0 ? 'Increase' : 'Decrease'} ${label.toLowerCase()}`}
          onPointerDown={e => startSpin(e, direction)} onPointerUp={() => clearTimeout(timer.current)} onPointerCancel={() => clearTimeout(timer.current)} onLostPointerCapture={() => clearTimeout(timer.current)} onClick={e => { if (e.detail === 0) spin(direction, e.shiftKey) }}>
          {direction > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}</button>)}</div>
      </div>
    </div>
    <div className="gamut-chart checkerboard" role="group" aria-label={`${label} color plane: horizontal ${config.x}, vertical ${config.y}`}
      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); select(e) }}
      onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) select(e) }} onPointerUp={e => { select(e); e.currentTarget.releasePointerCapture(e.pointerId) }}>
      <canvas ref={canvasRef} className="gpu-chart" />
      <canvas ref={fallbackRef} className="fallback-chart" />
      <div className="chart-crosshair" style={{ left: `${color[config.x] / config.xMax * 100}%`, bottom: `${color[config.y] / config.yMax * 100}%` }}><span /></div>
      <span className="chart-axis y">{config.y.toUpperCase()}</span><span className="chart-axis x">{config.x.toUpperCase()}</span>
    </div>
    <div className="gamut-range checkerboard" style={{ '--thumb-color': cssColor(color) } as CSSProperties}>
      <canvas ref={stripRef} />
      <input type="range" aria-label={`${label} slider`} min={0} max={max} step={axis === 'h' ? .01 : .0001} value={color[axis]} list={id} onChange={e => onChange({ [axis]: Number(e.target.value) })} />
      <datalist id={id}>{stops.map((stop, i) => <option key={i} value={stop} />)}</datalist>
    </div>
    <div className="range-labels"><span>0</span><span>{axis === 'h' ? '360°' : max}</span></div>
  </section>
}
export default function ColorPicker({ color, onChange, hueScope, hueCount }: { color: Color; onChange: (patch: Partial<Color>) => void; hueScope: string; hueCount: number }) {
  const support = useDisplaySupport()
  const [format, setFormat] = useState('hex')
  const visible = visibleColor(color, support.p3, support.rec2020)
  const spaceName = ['Out of gamut', 'sRGB', 'Display P3', 'Rec2020'][visible.space]
  const traditional = format === 'hex' ? srgb(color).toHex() : format === 'rgb' ? srgb(color).toRgbString({ legacy: true }) : srgb(color).toHslString()
  return <div className="color-picker">
    <div className={`color-display ${visible.supported ? '' : 'unavailable'} checkerboard`}>
      {visible.supported ? <div className="real-color" style={{ background: visible.real }} /> : <div className="unavailable-note">{visible.space === 0 ? 'Unavailable on any device' : `${spaceName} is unavailable on this monitor`}</div>}
      {visible.space !== 1 && <div className="fallback-color" style={{ background: `linear-gradient(to right, ${visible.browserFallback} 50%, ${visible.fallback} 50%)` }}>
        <button title="Use the gamut-mapped sRGB fallback" onClick={() => { const fallback = parseColor(visible.fallback); if (fallback) onChange(fallback) }}>Use sRGB fallback</button>
      </div>}
      <span className="color-space-label">{spaceName}</span>
    </div>
    <div className="color-code-fields">
      <ColorField value={cssColor(color)} label="OKLCH color" onChange={onChange} />
      <ColorField value={traditional} label="Traditional color" onChange={onChange}>
        <select aria-label="Color format" value={format} onChange={e => setFormat(e.target.value)}><option value="hex">HEX</option><option value="rgb">RGB</option><option value="hsl">HSL</option></select>
      </ColorField>
      {visible.space !== 1 && <p className="fallback-note">Traditional formats show the sRGB fallback.</p>}
    </div>
    <div className="gamut-legend"><span><i className="srgb-line" />sRGB</span><span><i className="p3-line" />P3</span><span><i className="rec-line" />Rec2020</span><Globe2 size={12} /></div>
    {(['l', 'c', 'h'] as const).map(axis => <PickerSection key={axis} axis={axis} color={color} onChange={onChange} p3={support.p3} />)}
    <div className="hue-note"><Link2 size={13} /><span>One hue, both themes.<br /><strong>{hueScope}: {hueCount} linked variables.</strong></span></div>
    <p className="picker-shortcuts">L / C / H to focus · ↑ ↓ to adjust · Shift for precision</p>
  </div>
}

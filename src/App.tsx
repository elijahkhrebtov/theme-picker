import { useEffect, useState } from 'react'
import { Check, ChevronRight, Copy, Download, Layers2, Moon, RotateCcw, SlidersHorizontal, Sun } from 'lucide-react'
import type { Color, ThemeMode } from './theme'
import { cssColor, defaultThemes, displayName, exportCSS, hueFamily, loadThemes, sharedHueTokens, STORAGE_KEY, tokenGroups, tokens } from './theme'
import Showcase from './Showcase'
import ColorPicker from './picker/ColorPicker'
import ImportDialog from './ImportDialog'
import './App.css'

function App() {
  const [themes, setThemes] = useState(loadThemes)
  const [mode, setMode] = useState<ThemeMode>('light')
  const [selected, setSelected] = useState('accent')
  const [copied, setCopied] = useState(false)
  const [storageError, setStorageError] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  useEffect(() => {
    let unavailable = false
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(themes)) } catch { unavailable = true }
    queueMicrotask(() => setStorageError(unavailable))
  }, [themes])
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setExportOpen(false); setResetOpen(false); setImportOpen(false) } }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [])
  function updateColor(patch: Partial<Color>) {
    setThemes(previous => {
      const next = { light: { ...previous.light }, dark: { ...previous.dark } }
      next[mode][selected] = { ...next[mode][selected], ...patch }
      if (patch.h !== undefined) {
        for (const variant of ['light', 'dark'] as const) {
          for (const token of sharedHueTokens(selected)) next[variant][token] = { ...next[variant][token], h: patch.h }
        }
      }
      return next
    })
  }
  async function copyCSS() {
    try {
      await navigator.clipboard.writeText(exportCSS(themes))
      setCopied(true); setCopyError(false)
      setTimeout(() => setCopied(false), 2000)
    } catch { setCopyError(true); setExportOpen(true) }
  }
  return <>
    <header className="app-header">
      <div className="brand"><span className="brand-symbol"><Layers2 size={19} strokeWidth={1.7} /></span><h1>Theme studio<span className="brand-dot">.</span></h1><span className="brand-divider" /><span className="brand-description">A palette. Two perspectives.</span></div>
      <div className="header-actions"><span className={`save-status ${storageError ? 'save-error' : ''}`}><i />{storageError ? 'Storage unavailable' : 'Saved locally'}</span><button className="header-button" onClick={() => setResetOpen(true)}><RotateCcw size={13} />Reset palette</button><button className="header-button export-button" onClick={() => setImportOpen(true)}><Download size={13} />Import CSS</button><button className="header-button export-button" onClick={() => setExportOpen(true)}>View CSS<ChevronRight size={13} /></button></div>
    </header>
    <main className="workspace">
      <div className="showcase-pair"><Showcase theme="dark" variables={themes.dark} /><Showcase theme="light" variables={themes.light} /></div>
      <aside className="editor-pane fixed-pane">
        <div className="pane-heading"><div className="eyebrow"><SlidersHorizontal size={12} />COLOR EDITOR</div><div className="editor-title"><h2>{displayName(selected)}</h2><span className="mode-pill">{mode === 'light' ? <Sun size={10} /> : <Moon size={10} />}{mode}</span></div><p>Fine-tune your selected color.</p></div>
        <ColorPicker key={`${mode}:${selected}`} color={themes[mode][selected]} onChange={updateColor} hueScope={displayName(hueFamily(selected) ?? 'core & accent')} hueCount={sharedHueTokens(selected).length * 2} />
      </aside>
      <aside className="variables-pane fixed-pane">
        <div className="variables-header"><div className="variable-heading"><div className="eyebrow">THEME VARIABLES</div><span className="token-count">{tokens.length} tokens</span></div>
          <div className="theme-tabs" role="tablist" aria-label="Theme to edit">{(['light', 'dark'] as const).map(variant => <button key={variant} role="tab" aria-selected={mode === variant} onClick={() => setMode(variant)}>{variant === 'light' ? <Sun size={13} /> : <Moon size={13} />}{displayName(variant)}</button>)}</div>
          <button className="copy-css" onClick={copyCSS}>{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? 'Copied both themes' : 'Copy CSS'}<span>:root + .dark</span></button>
        </div>
        <div className="token-list">{tokenGroups.map(group => <details className="token-group" key={group.name} open><summary><ChevronRight size={12} /><h3>{group.name}</h3><span className="group-count">{group.tokens.length}</span>{group.tokens.includes(selected) && <span className="group-selected" aria-label="Contains selected variable" />}</summary>{group.tokens.map(token => <button key={token} className={`token-row ${selected === token ? 'selected' : ''}`} aria-pressed={selected === token} onClick={() => setSelected(token)}>
          <i className="token-swatch" style={{ background: cssColor(themes[mode][token]) }} /><span className="token-name">{displayName(token)}</span><code>{cssColor(themes[mode][token])}</code>
        </button>)}</details>)}</div>
        <footer className="variables-footer"><span className="live-dot" />Changes appear in both previews instantly.</footer>
      </aside>
    </main>
    {exportOpen && <div className="dialog-backdrop" onClick={e => { if (e.target === e.currentTarget) setExportOpen(false) }}><section className="css-dialog" role="dialog" aria-modal="true" aria-labelledby="export-title"><div className="dialog-heading"><div><div className="eyebrow">READY FOR YOUR STYLESHEET</div><h2 id="export-title">Your theme, in CSS.</h2></div><button autoFocus className="header-button" onClick={() => setExportOpen(false)}>Close</button></div><p>Use <code>:root</code> for light mode and add the <code>dark</code> class for dark mode.</p>{copyError && <p className="copy-error">Clipboard access is unavailable. Select and copy the CSS below.</p>}<textarea aria-label="Exported theme CSS" value={exportCSS(themes)} readOnly onFocus={e => e.currentTarget.select()} /><button className="copy-css" onClick={copyCSS}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied!' : 'Copy both themes'}</button></section></div>}
    {importOpen && <ImportDialog onClose={() => setImportOpen(false)} onApply={updates => setThemes(previous => ({ light: { ...previous.light, ...updates.light }, dark: { ...previous.dark, ...updates.dark } }))} />}
    {resetOpen && <div className="dialog-backdrop" onClick={e => { if (e.target === e.currentTarget) setResetOpen(false) }}><section className="reset-dialog" role="dialog" aria-modal="true" aria-labelledby="reset-title"><h2 id="reset-title">Reset the palette?</h2><p>This replaces both themes with the original palette.</p><div><button autoFocus className="header-button" onClick={() => setResetOpen(false)}>Keep editing</button><button className="reset-confirm" onClick={() => { setThemes(defaultThemes()); setResetOpen(false) }}>Reset both themes</button></div></section></div>}
  </>
}
export default App

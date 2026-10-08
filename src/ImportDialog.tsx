import { useState } from 'react'
import { Download } from 'lucide-react'
import type { ThemeMode, ThemeValues } from './theme'
import { readThemeCSS } from './importCSS'

export default function ImportDialog({ onClose, onApply }: { onClose: () => void; onApply: (updates: Record<ThemeMode, ThemeValues>) => void }) {
  const [css, setCSS] = useState('')
  const [error, setError] = useState(false)
  return <div className="dialog-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <form className="css-dialog import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title" onSubmit={event => {
      event.preventDefault()
      const updates = readThemeCSS(css)
      if (!Object.keys(updates.light).length && !Object.keys(updates.dark).length) { setError(true); return }
      onApply(updates)
      onClose()
    }}>
      <div className="dialog-heading"><div><div className="eyebrow">BRING YOUR PALETTE BACK</div><h2 id="import-title">Import theme CSS.</h2></div><button type="button" className="header-button" onClick={onClose}>Close</button></div>
      <p id="import-help">Paste current or previous exports with <code>:root</code> for light and <code>.dark</code> for dark. Matching colors are applied; missing variables stay unchanged and extra variables are ignored.</p>
      <textarea autoFocus aria-label="CSS to import" aria-describedby={`import-help${error ? ' import-error' : ''}`} aria-invalid={error} value={css} spellCheck={false} placeholder={':root {\n  --accent: oklch(55% 0.205 265);\n}\n\n.dark {\n  --accent: oklch(69% 0.17 265);\n}'} onChange={event => { setCSS(event.target.value); setError(false) }} />
      {error && <p className="import-error" id="import-error" role="alert">No valid matching colors found. Paste theme variables with valid color values inside :root or .dark rules.</p>}
      <button type="submit" className="copy-css"><Download size={14} />Apply CSS</button>
    </form>
  </div>
}

import { useId, useState, type CSSProperties, type ReactNode } from 'react'
import './Showcase.css'

type ShowcaseProps = {
  theme: 'light' | 'dark'
  variables: Record<string, { l: number; c: number; h: number }>
}

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    moon: <path d="M20.5 13A8.7 8.7 0 0 1 11 3.5 8.8 8.8 0 1 0 20.5 13Z" />,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    layers: <><path d="m12 3 10 6-10 6L2 9l10-6Zm-9 11 9 5 9-5M3 18l9 5 9-5" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    file: <><path d="M14 2H5v20h14V7l-5-5Zm0 0v5h5M8 12h8M8 16h5" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.layers}</svg>
}

function SectionLabel({ number, children }: { number: string; children: ReactNode }) {
  return <div className="demo-section-label"><span>{number}</span>{children}</div>
}

export default function Showcase({ theme, variables }: ShowcaseProps) {
  const id = useId()
  const [tab, setTab] = useState('Overview')
  const [notifications, setNotifications] = useState(true)
  const [updates, setUpdates] = useState(true)
  const [mentions, setMentions] = useState(false)
  const [selectedSurface, setSelectedSurface] = useState(1)
  const [saved, setSaved] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [invite, setInvite] = useState('')
  const [inviteSent, setInviteSent] = useState(false)
  const styles = Object.fromEntries(Object.entries(variables).map(([name, color]) => [
    `--${name}`, `oklch(${color.l * 100}% ${color.c} ${color.h})`,
  ])) as CSSProperties

  return (
    <section className={`showcase showcase-${theme}`} style={styles} aria-label={`${theme} theme preview`}>
      <header className="demo-header">
        <div className="demo-heading"><Icon name={theme === 'dark' ? 'moon' : 'sun'} size={19} /><h2>{theme === 'dark' ? 'Dark' : 'Light'} theme</h2></div>
        <span className="demo-live"><i />Live preview</span>
      </header>

      <div className="demo-intro">
        <span className="demo-eyebrow">A SPACE TO CREATE</span>
        <h3>Good things start<br />with a little clarity.</h3>
        <p>A thoughtful workspace for your next idea.<br />See your palette come to life, one detail at a time.</p>
      </div>

      <SectionLabel number="01">Surfaces & typography</SectionLabel>
      <div className="demo-surface-stack">
        {[1, 2, 3].map((surface) => <button key={surface} type="button" className={`demo-surface demo-surface-${surface} ${selectedSurface === surface ? 'is-selected' : ''}`} onClick={() => setSelectedSurface(surface)} aria-pressed={selectedSurface === surface}>
          <span className="demo-surface-title"><span>Surface {surface}</span><span className="demo-mono">0{surface}</span></span>
          <span className="demo-primary-text">A place for your content.</span>
          <span className="demo-secondary-text">Supporting details with a softer voice.</span>
          <span className="demo-tertiary-text">A little context, quietly in the background.</span>
        </button>)}
      </div>

      <SectionLabel number="02">Actions & emphasis</SectionLabel>
      <div className="demo-button-row">
        <button type="button" className="demo-button demo-button-primary" onClick={() => setSaved((value) => !value)}><Icon name={saved ? 'check' : 'plus'} size={15} />{saved ? 'Created' : 'Create new'}</button>
        <button type="button" className="demo-button demo-button-secondary" onClick={() => setSaved(false)}>Secondary</button>
        <button type="button" className="demo-button demo-button-ghost" onClick={() => setSaved((value) => !value)}>Ghost<Icon name="arrow" size={14} /></button>
      </div>
      <div className="demo-inline-elements">
        <button type="button" className="demo-text-link" onClick={() => setTab('Activity')}>Explore the details <Icon name="arrow" size={14} /></button>
        <span className="demo-badge demo-badge-outline">In progress</span>
        <span className="demo-badge demo-badge-accent">New</span>
      </div>

      {!bannerDismissed && <div className="demo-accent-card">
        <div className="demo-accent-mark"><Icon name="layers" size={21} /></div>
        <span className="demo-accent-eyebrow">A LITTLE MORE POSSIBILITY</span>
        <h4>Make room for your best work.</h4>
        <p>Bring your team, ideas, and everyday tasks together in one beautiful place.</p>
        <div className="demo-accent-footer"><button type="button" onClick={() => setBannerDismissed(true)}>Let’s get started <Icon name="arrow" size={16} /></button><span>Made for your team</span></div>
      </div>}
      {bannerDismissed && <button type="button" className="demo-button demo-button-secondary demo-restore" onClick={() => setBannerDismissed(false)}>Show accent card</button>}

      <SectionLabel number="03">Inputs & controls</SectionLabel>
      <div className="demo-controls-card">
        <div className="demo-card-heading"><h4>Workspace preferences</h4><Icon name="bell" size={18} /></div>
        <p className="demo-secondary-text">Make this space feel a little more like you.</p>
        <label className="demo-field-label" htmlFor={`${id}-workspace`}>Workspace name</label>
        <input className="demo-input" id={`${id}-workspace`} defaultValue="Studio North" />
        <label className="demo-field-label" htmlFor={`${id}-search`}>Quick search</label>
        <div className="demo-input-wrap"><Icon name="search" size={16} /><input className="demo-input" id={`${id}-search`} placeholder="Find anything…" /><kbd>⌘ K</kbd></div>
        <div className="demo-settings-row"><div><span>Notifications</span><small>Keep up with what matters.</small></div><button type="button" role="switch" aria-checked={notifications} aria-label="Notifications" className={`demo-switch ${notifications ? 'is-on' : ''}`} onClick={() => setNotifications((value) => !value)}><span /></button></div>
        <div className="demo-checkboxes">
          <label><input type="checkbox" checked={updates} onChange={(event) => setUpdates(event.target.checked)} /><span className="demo-check"><Icon name="check" size={12} /></span>Product updates</label>
          <label><input type="checkbox" checked={mentions} onChange={(event) => setMentions(event.target.checked)} /><span className="demo-check"><Icon name="check" size={12} /></span>Only mentions</label>
        </div>
        <div className="demo-disabled-row"><label className="demo-disabled"><input type="checkbox" checked disabled /><span className="demo-check"><Icon name="check" size={12} /></span>Unavailable</label><button type="button" className="demo-switch is-on" role="switch" aria-checked="true" aria-label="Disabled notification setting" disabled><span /></button><button type="button" className="demo-button demo-button-secondary" disabled>Disabled</button></div>
      </div>

      <SectionLabel number="04">Navigation & content</SectionLabel>
      <div className="demo-project-card">
        <div className="demo-card-heading"><div className="demo-project-title"><div className="demo-project-icon"><Icon name="layers" size={18} /></div><div><h4>Website refresh</h4><span className="demo-tertiary-text">Updated just now</span></div></div><button type="button" className="demo-icon-button" aria-label="Toggle project details" onClick={() => setTab(tab === 'Activity' ? 'Overview' : 'Activity')}><Icon name="more" /></button></div>
        <div className="demo-tabs" role="tablist" aria-label="Project sections">{['Overview', 'Activity', 'Files'].map((name) => <button type="button" role="tab" aria-selected={tab === name} key={name} className={tab === name ? 'is-selected' : ''} onClick={() => setTab(name)}>{name}</button>)}</div>
        <div className="demo-tab-content" role="tabpanel">
          {tab === 'Overview' && <><div className="demo-task-heading"><h5>A fresh perspective</h5><span className="demo-badge demo-badge-outline">Design</span></div><p className="demo-secondary-text">Small details. Clear intentions. A better experience for everyone.</p><div className="demo-progress-caption"><span>Project progress</span><strong>68%</strong></div><div className="demo-progress"><span /></div><div className="demo-project-footer"><div className="demo-avatars"><span>AL</span><span>SK</span><span>JM</span></div><span className="demo-tertiary-text">3 teammates</span></div></>}
          {tab === 'Activity' && <div className="demo-activity"><div className="demo-avatar">AL</div><div><strong>Alex shared an update</strong><p className="demo-secondary-text">The first round of concepts is ready.</p><span className="demo-tertiary-text">A moment ago</span></div></div>}
          {tab === 'Files' && <button type="button" className="demo-file" onClick={() => setSaved((value) => !value)}><Icon name="file" size={24} /><span><strong>Project brief</strong><small className="demo-tertiary-text">Document · Updated today</small></span><Icon name={saved ? 'check' : 'arrow'} size={16} /></button>}
        </div>
      </div>

      <SectionLabel number="05">Lists & small details</SectionLabel>
      <div className="demo-members-card">
        <div className="demo-card-heading"><h4>Your team</h4><span className="demo-tertiary-text">3 members</span></div>
        <div className="demo-member-list">{[['AL', 'Alex Lane', 'Product designer', 'Owner'], ['SK', 'Sam Kim', 'Frontend developer', 'Member'], ['JM', 'Jordan Miles', 'Creative director', 'Member']].map(([initials, name, role, membership]) => <button type="button" className="demo-member" key={initials} onClick={() => setInvite(name)}><span className="demo-avatar">{initials}</span><span className="demo-member-info"><strong>{name}</strong><small>{role}</small></span><span className="demo-member-role">{membership}</span></button>)}</div>
        <form className="demo-invite" onSubmit={(event) => { event.preventDefault(); if (invite.trim()) setInviteSent(true) }}><input className="demo-input" aria-label="Invite teammate email" type="text" placeholder="Invite a teammate…" value={invite} onChange={(event) => { setInvite(event.target.value); setInviteSent(false) }} /><button type="submit" className="demo-button demo-button-primary">{inviteSent ? <Icon name="check" size={15} /> : <Icon name="plus" size={15} />}{inviteSent ? 'Sent' : 'Invite'}</button></form>
      </div>
      <footer className="demo-footer"><span>Every detail, in your colors.</span><span className="demo-footer-mark">◈</span></footer>
    </section>
  )
}

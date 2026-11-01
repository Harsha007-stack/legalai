import { X } from 'lucide-react'

export function Button({ children, variant = 'primary', className = '', ...props }) {
  return <button className={`button button-${variant} ${className}`} {...props}>{children}</button>
}

export function Card({ children, className = '', ...props }) {
  return <section className={`card ${className}`} {...props}>{children}</section>
}

const statusClass = {
  pending: 'badge-amber',
  accepted: 'badge-green',
  confirmed: 'badge-green',
  declined: 'badge-red',
  cancelled: 'badge-neutral',
  counter_proposed: 'badge-gold',
  demo_only: 'badge-neutral',
  Private: 'badge-neutral',
}

export function Badge({ children, className = '' }) {
  const key = String(children).toLowerCase().replaceAll(' ', '_')
  return <span className={`badge ${statusClass[key] || 'badge-neutral'} ${className}`}>{children}</span>
}

export function PageHeader({ eyebrow, title, description, action }) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="page-header-action">{action}</div>}
    </div>
  )
}

export function Modal({ title, children, onClose, wide = false }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-heading"><h2 id="modal-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={19} /></button></div>
        {children}
      </section>
    </div>
  )
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return <div className="empty-state">{Icon && <span className="empty-icon"><Icon size={22} /></span>}<h3>{title}</h3><p>{children}</p>{action}</div>
}

export function Field({ label, id, error, children, hint }) {
  return <div className="field"><label htmlFor={id}>{label}</label>{children}{hint && <small className="field-hint">{hint}</small>}{error && <small className="field-error" role="alert">{error}</small>}</div>
}

export function DemoNotice({ children = 'Demo mode · Sample data only' }) {
  return <div className="demo-notice"><span className="demo-dot" />{children}</div>
}

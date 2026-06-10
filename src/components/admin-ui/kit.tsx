'use client'

import React from 'react'

/**
 * Shared admin UI kit (Phase 1 — Agent 2).
 *
 * A small internal component library so every custom admin screen speaks the
 * same visual language. Styling lives in src/app/(payload)/custom.scss under
 * the `admin-kit-*` classes.
 */

// ---- AdminPageShell ------------------------------------------------------

export function AdminPageShell({ children }: { children: React.ReactNode }) {
  return <div className="admin-kit-shell">{children}</div>
}

// ---- AdminPageHeader -----------------------------------------------------

export function AdminPageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    <header className="admin-kit-header">
      <div className="admin-kit-header__title">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="admin-kit-header__actions">{actions}</div> : null}
    </header>
  )
}

// ---- PrimaryActionBar ----------------------------------------------------

export function PrimaryActionBar({ children }: { children: React.ReactNode }) {
  return <div className="admin-kit-actionbar">{children}</div>
}

export function ActionButton({
  children,
  onClick,
  href,
  variant = 'secondary',
  disabled,
  type = 'button',
}: {
  children: React.ReactNode
  onClick?: () => void
  href?: string
  variant?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  const className = `admin-kit-btn admin-kit-btn--${variant}`
  if (href) {
    return (
      <a className={className} href={href}>
        {children}
      </a>
    )
  }
  return (
    <button className={className} disabled={disabled} onClick={onClick} type={type}>
      {children}
    </button>
  )
}

// ---- StatusBadge ---------------------------------------------------------

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

export function StatusBadge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: BadgeTone }) {
  return <span className={`admin-kit-badge admin-kit-badge--${tone}`}>{children}</span>
}

// ---- StepWizard ----------------------------------------------------------

export function StepWizard({
  steps,
  current,
}: {
  steps: string[]
  current: number
}) {
  return (
    <ol className="admin-kit-wizard">
      {steps.map((step, index) => {
        const state = index === current ? 'active' : index < current ? 'done' : 'pending'
        return (
          <li key={step} className={`admin-kit-wizard__step admin-kit-wizard__step--${state}`}>
            <span>{index + 1}</span>
            {step}
          </li>
        )
      })}
    </ol>
  )
}

// ---- CompletionChecklist -------------------------------------------------

export type ChecklistItem = { label: string; status: 'ok' | 'warn' | 'bad' }

export function CompletionChecklist({ items }: { items: ChecklistItem[] }) {
  const icon = { ok: '✓', warn: '!', bad: '✕' }
  return (
    <ul className="admin-kit-checklist">
      {items.map((item) => (
        <li key={item.label}>
          <span className={`admin-kit-checklist__icon admin-kit-checklist__icon--${item.status}`}>
            {icon[item.status]}
          </span>
          {item.label}
        </li>
      ))}
    </ul>
  )
}

// ---- SectionLibraryCard --------------------------------------------------

export function SectionLibraryCard({
  name,
  description,
  onSelect,
}: {
  name: string
  description: string
  onSelect?: () => void
}) {
  return (
    <button className="admin-kit-section-card" onClick={onSelect} type="button">
      <strong>{name}</strong>
      <small>{description}</small>
    </button>
  )
}

// ---- InspectorPanel ------------------------------------------------------

export function InspectorPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <aside className="admin-kit-inspector">
      <h3>{title}</h3>
      {children}
    </aside>
  )
}

// ---- PreviewFrame --------------------------------------------------------

export function PreviewFrame({
  url,
  device = 'desktop',
  toolbar,
  height = 620,
}: {
  url: string
  device?: 'desktop' | 'mobile'
  toolbar?: React.ReactNode
  height?: number
}) {
  const width = device === 'mobile' ? 390 : '100%'
  return (
    <div className="admin-kit-preview">
      {toolbar ? <div className="admin-kit-preview__bar">{toolbar}</div> : null}
      <iframe src={url} style={{ height, width, margin: device === 'mobile' ? '0 auto' : undefined }} title="Vista previa" />
    </div>
  )
}

// ---- VehicleSummaryCard --------------------------------------------------

export function VehicleSummaryCard({
  imageUrl,
  title,
  subtitle,
  badge,
}: {
  imageUrl?: string
  title: string
  subtitle?: string
  badge?: React.ReactNode
}) {
  return (
    <div className="admin-kit-summary-card">
      {imageUrl ? <img alt={title} src={imageUrl} /> : null}
      <div className="admin-kit-summary-card__info">
        <strong>{title}</strong>
        {subtitle ? <small>{subtitle}</small> : null}
        {badge}
      </div>
    </div>
  )
}

// ---- EmptyState ----------------------------------------------------------

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string
  message?: string
  action?: React.ReactNode
}) {
  return (
    <div className="admin-kit-empty">
      <h3>{title}</h3>
      {message ? <p>{message}</p> : null}
      {action}
    </div>
  )
}

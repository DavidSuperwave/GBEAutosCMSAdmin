'use client'

import React from 'react'

/**
 * Shared admin UI kit.
 *
 * Small, boring primitives for custom Payload admin screens. Styling lives in
 * src/app/(payload)/custom.scss under the `admin-kit-*` classes.
 */

function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type ButtonSize = 'sm' | 'md'

// ---- Page shell ----------------------------------------------------------

export function AdminPageShell({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cx('admin-kit-shell', className)}>{children}</div>
}

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

// ---- Surfaces ------------------------------------------------------------

export function AdminCard({
  children,
  className,
  density = 'normal',
}: {
  children: React.ReactNode
  className?: string
  density?: 'compact' | 'normal' | 'spacious'
}) {
  return <section className={cx('admin-kit-card', `admin-kit-card--${density}`, className)}>{children}</section>
}

export function AdminCardHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="admin-kit-card__header">
      <div>
        <h3>{title}</h3>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="admin-kit-card__actions">{actions}</div> : null}
    </div>
  )
}

export function PrimaryActionBar({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cx('admin-kit-actionbar', className)}>{children}</div>
}

// ---- Actions -------------------------------------------------------------

type ActionButtonProps = {
  children: React.ReactNode
  className?: string
  disabled?: boolean
  href?: string
  rel?: string
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  size?: ButtonSize
  target?: React.HTMLAttributeAnchorTarget
  type?: 'button' | 'submit'
  variant?: ButtonVariant
}

export function ActionButton({
  children,
  className,
  disabled,
  href,
  rel,
  onClick,
  size = 'md',
  target,
  type = 'button',
  variant = 'secondary',
}: ActionButtonProps) {
  const buttonClassName = cx('admin-kit-btn', `admin-kit-btn--${variant}`, `admin-kit-btn--${size}`, className)
  if (href) {
    return (
      <a
        aria-disabled={disabled || undefined}
        className={buttonClassName}
        href={disabled ? undefined : href}
        rel={rel}
        target={target}
      >
        {children}
      </a>
    )
  }
  return (
    <button className={buttonClassName} disabled={disabled} onClick={onClick} type={type}>
      {children}
    </button>
  )
}

// ---- Badges / status -----------------------------------------------------

export function StatusBadge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: Tone
}) {
  return <span className={`admin-kit-badge admin-kit-badge--${tone}`}>{children}</span>
}

// ---- Tabs / segmented controls -----------------------------------------

export type AdminTabItem<T extends string = string> = {
  key: T
  label: string
  badge?: React.ReactNode
  badgeTone?: Tone
}

export function AdminTabs<T extends string>({
  active,
  ariaLabel,
  className,
  items,
  onChange,
}: {
  active: T
  ariaLabel?: string
  className?: string
  items: Array<AdminTabItem<T>>
  onChange: (key: T) => void
}) {
  return (
    <div aria-label={ariaLabel} className={cx('admin-kit-tabs', className)} role="tablist">
      {items.map((item) => (
        <button
          aria-selected={active === item.key}
          className={cx('admin-kit-tabs__tab', active === item.key && 'admin-kit-tabs__tab--active')}
          key={item.key}
          onClick={() => onChange(item.key)}
          role="tab"
          type="button"
        >
          {item.label}
          {item.badge !== undefined && item.badge !== null ? (
            <span className={cx('admin-kit-tabs__count', item.badgeTone && `admin-kit-tabs__count--${item.badgeTone}`)}>
              {item.badge}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  )
}

export function AdminSegmentedControl<T extends string>({
  active,
  className,
  items,
  onChange,
}: {
  active: T
  className?: string
  items: Array<{ key: T; label: string }>
  onChange: (key: T) => void
}) {
  return (
    <div className={cx('admin-kit-segmented', className)}>
      {items.map((item) => (
        <button
          className={cx('admin-kit-segmented__item', active === item.key && 'admin-kit-segmented__item--active')}
          key={item.key}
          onClick={() => onChange(item.key)}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

// ---- Tables --------------------------------------------------------------

export function AdminTable({
  children,
  className,
  tableClassName,
}: {
  children: React.ReactNode
  className?: string
  tableClassName?: string
}) {
  return (
    <div className={cx('admin-kit-table-wrap', className)}>
      <table className={cx('admin-kit-table', tableClassName)}>{children}</table>
    </div>
  )
}

// ---- Forms ---------------------------------------------------------------

export function AdminField({
  children,
  error,
  hint,
  label,
}: {
  children: React.ReactNode
  error?: string
  hint?: string
  label: string
}) {
  return (
    <label className={cx('admin-kit-field', error && 'admin-kit-field--error')}>
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
      {error ? <small className="admin-kit-field__error">{error}</small> : null}
    </label>
  )
}

// ---- Modal chrome --------------------------------------------------------

export function AdminModalFrame({
  actions,
  children,
  eyebrow,
  onClose,
  title,
}: {
  actions?: React.ReactNode
  children: React.ReactNode
  eyebrow?: string
  onClose: () => void
  title: string
}) {
  return (
    <div className="admin-kit-modal" role="dialog" aria-modal="true" aria-label={title}>
      <button className="admin-kit-modal__backdrop" onClick={onClose} type="button" />
      <section className="admin-kit-modal__panel">
        <header className="admin-kit-modal__header">
          <div>
            {eyebrow ? <p>{eyebrow}</p> : null}
            <h2>{title}</h2>
          </div>
          <button aria-label="Cerrar" className="admin-kit-modal__close" onClick={onClose} type="button">
            x
          </button>
        </header>
        <div className="admin-kit-modal__body">{children}</div>
        {actions ? <footer className="admin-kit-modal__footer">{actions}</footer> : null}
      </section>
    </div>
  )
}

// ---- Wizard / checklist --------------------------------------------------

export function StepWizard({ steps, current }: { steps: string[]; current: number }) {
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

export type ChecklistItem = { label: string; status: 'ok' | 'warn' | 'bad' }

export function CompletionChecklist({ items }: { items: ChecklistItem[] }) {
  const icon = { ok: 'OK', warn: '!', bad: 'x' }
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

// ---- Builder / preview helpers ------------------------------------------

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

export function InspectorPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <aside className="admin-kit-inspector">
      <h3>{title}</h3>
      {children}
    </aside>
  )
}

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
    <div className={`admin-kit-preview admin-kit-preview--${device}`}>
      {toolbar ? <div className="admin-kit-preview__bar">{toolbar}</div> : null}
      <div className="admin-kit-preview__viewport">
        <iframe
          src={url}
          style={{ height, width, margin: device === 'mobile' ? '0 auto' : undefined }}
          title="Vista previa"
        />
      </div>
    </div>
  )
}

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
      {imageUrl ? <img alt={title} src={imageUrl} /> : <div className="admin-kit-summary-card__media" />}
      <div className="admin-kit-summary-card__info">
        <strong>{title}</strong>
        {subtitle ? <small>{subtitle}</small> : null}
        {badge}
      </div>
    </div>
  )
}

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
      {action ? <div className="admin-kit-empty__action">{action}</div> : null}
    </div>
  )
}

'use client'

import React from 'react'
import { useTheme } from '@payloadcms/ui'

/**
 * Top-bar Light/Dark/Auto theme toggle (registered via admin.components.actions).
 *
 * Payload follows the OS/system theme by default (auto). This control lets the
 * user override to Light or Dark and back to Auto. The choice is persisted by
 * Payload's theme provider, and all custom screens use --theme-* variables so
 * they follow it automatically.
 */
export default function ThemeToggle() {
  const themeApi = useTheme() as {
    autoMode?: boolean
    theme?: 'light' | 'dark'
    setTheme: (theme: 'auto' | 'light' | 'dark') => void
  }

  const mode: 'auto' | 'light' | 'dark' = themeApi.autoMode ? 'auto' : themeApi.theme || 'light'
  const next: 'auto' | 'light' | 'dark' = mode === 'auto' ? 'light' : mode === 'light' ? 'dark' : 'auto'
  const label = mode === 'auto' ? 'Auto' : mode === 'light' ? 'Claro' : 'Oscuro'
  const icon = mode === 'auto' ? '◐' : mode === 'light' ? '☀' : '☾'

  return (
    <button
      type="button"
      className="theme-toggle"
      title={`Tema: ${label}. Clic para cambiar.`}
      onClick={() => themeApi.setTheme(next)}
    >
      <span aria-hidden="true" className="theme-toggle__icon">
        {icon}
      </span>
      <span className="theme-toggle__label">{label}</span>
    </button>
  )
}

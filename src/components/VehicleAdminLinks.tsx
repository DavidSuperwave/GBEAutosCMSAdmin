'use client'

import React from 'react'
import { useField } from '@payloadcms/ui'

import { ActionButton } from './admin-ui/kit'

const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000'

export default function VehicleAdminLinks() {
  const slug = useField<string>({ path: 'slug' })
  const href = slug.value ? `${FRONTEND_URL}/cars/${slug.value}` : ''

  async function copyLink() {
    if (!href) return
    await navigator.clipboard.writeText(href)
  }

  return (
    <div className="vehicle-admin-links">
      {href ? (
        <>
          <ActionButton href={href} rel="noreferrer" size="sm" target="_blank" variant="secondary">
            Abrir pagina publica
          </ActionButton>
          <ActionButton onClick={copyLink} size="sm" type="button" variant="secondary">
            Copiar enlace
          </ActionButton>
          <code className="vehicle-admin-links__url">{href}</code>
        </>
      ) : (
        <p className="vehicle-admin-links__empty">
          Guarda el vehículo para generar su enlace público.
        </p>
      )}
    </div>
  )
}

'use client'

import React, { useEffect } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'

/**
 * Existing vehicle edits belong in the custom workspace. This keeps old
 * bookmarks and Payload's built-in "Editar" tab from reopening the legacy form.
 */
export default function VehicleWorkspaceRedirect() {
  const { id } = useDocumentInfo()

  useEffect(() => {
    if (!id) {
      if (window.location.pathname.endsWith('/create')) {
        window.location.replace('/admin/inventory/new')
      }
      return
    }
    window.location.replace(`/admin/collections/vehicles/${id}/workspace`)
  }, [id])

  return <p>Abriendo espacio de trabajo...</p>
}

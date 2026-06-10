import type { AdminViewServerProps } from 'payload'

import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import React from 'react'

import InventoryManager from './InventoryManager'

/**
 * Server wrapper for the custom root view at /admin/inventory.
 *
 * Custom root views in Payload 3 render WITHOUT the admin chrome unless they
 * opt into DefaultTemplate themselves (RootPage leaves templateType unset).
 * We wrap the client UI in DefaultTemplate + Gutter so the left nav/sidebar
 * and header stay visible.
 */
export default function InventoryView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  return (
    <DefaultTemplate
      i18n={initPageResult.req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={initPageResult.req.payload}
      permissions={initPageResult.permissions}
      searchParams={searchParams}
      user={initPageResult.req.user ?? undefined}
      visibleEntities={initPageResult.visibleEntities}
    >
      <Gutter>
        <InventoryManager />
      </Gutter>
    </DefaultTemplate>
  )
}

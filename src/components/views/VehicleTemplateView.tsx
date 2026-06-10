import type { AdminViewServerProps } from 'payload'

import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import React from 'react'

import VehicleTemplateBuilder from './VehicleTemplateBuilder'

/**
 * Server wrapper for /admin/builder/vehicle-template. Wraps the client builder
 * in DefaultTemplate + Gutter so the admin sidebar/header stay visible.
 */
export default function VehicleTemplateView({ initPageResult, params, searchParams }: AdminViewServerProps) {
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
        <VehicleTemplateBuilder />
      </Gutter>
    </DefaultTemplate>
  )
}

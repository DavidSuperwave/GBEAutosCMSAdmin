import { NextResponse } from 'next/server'

import { requireCmsRole } from '../../../../../../services/cmsRequestAuth'
import { normalizeImportRow } from '../../../../../../services/importNormalize'

/**
 * Bulk Import Center — server-side import runner (Phase 3).
 *
 * Accepts parsed rows + a column mapping, normalizes each row, detects
 * duplicates by source id / stock id, creates vehicles as drafts and records an
 * import-job for review and rollback.
 */

type ImportOptions = {
  createAsDrafts?: boolean
  updateExisting?: boolean
}

type RunBody = {
  fileName?: string
  fileType?: 'csv' | 'xlsx'
  mapping?: Record<string, string>
  rows?: Record<string, unknown>[]
  options?: ImportOptions
}

export async function POST(request: Request) {
  let body: RunBody
  try {
    body = (await request.json()) as RunBody
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }

  const { fileName = 'inventario', fileType = 'csv', mapping = {}, rows = [], options = {} } = body

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No hay filas para importar.' }, { status: 400 })
  }

  const auth = await requireCmsRole(request, ['inventory_manager'], 'Sin permisos para importar inventario.')
  if (auth.response) return auth.response
  const { payload, user } = auth

  const reqContext = { headers: request.headers, user }

  // Dealership matching is best-effort. Imports stay as drafts when no
  // dealership matches; operators assign the correct agency during review.
  const dealershipsResult = await payload.find({ collection: 'dealerships', depth: 0, limit: 200 })
  const dealerships = dealershipsResult.docs as Array<{
    id: number | string
    brandName?: string
    displayName?: string
    city?: string
  }>

  const alnum = (v?: string) =>
    String(v ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')

  function matchDealership(brand?: string, dealerName?: string) {
    const dealerKey = alnum(dealerName)
    const byName = dealerKey
      ? dealerships.find((d) => alnum(d.displayName).includes(dealerKey))
      : undefined
    if (byName) return byName.id
    const brandKey = alnum(brand)
    const byBrand = brandKey ? dealerships.find((d) => alnum(d.brandName) === brandKey) : undefined
    return byBrand?.id
  }

  // Create the import job first so created vehicles can reference it.
  const job = await payload.create({
    collection: 'import-jobs',
    data: {
      fileName,
      fileType,
      status: 'importing',
      rowCount: rows.length,
      mapping,
    },
    overrideAccess: true,
    req: reqContext,
  })

  let createdCount = 0
  let updatedCount = 0
  let skippedCount = 0
  let reviewCount = 0
  const errors: Array<{ row: number; message: string }> = []
  const warnings: Array<{ row: number; message: string }> = []
  const createdVehicleIds: Array<number | string> = []

  for (let i = 0; i < rows.length; i += 1) {
    const rowNumber = i + 1
    const { draft, issues } = normalizeImportRow(rows[i], mapping)
    const blocking = issues.filter((issue) => issue.severity === 'error')
    const rowWarnings = issues.filter((issue) => issue.severity === 'warning').map((issue) => issue.message)

    if (blocking.length > 0) {
      errors.push({ row: rowNumber, message: blocking.map((b) => b.message).join(', ') })
      continue
    }

    try {
      // Duplicate detection by sourceId / stockId.
      let existing: { id: number | string } | undefined
      if (draft.sourceId) {
        const found = await payload.find({
          collection: 'vehicles',
          depth: 0,
          limit: 1,
          where: {
            or: [{ sourceId: { equals: draft.sourceId } }, { stockId: { equals: draft.sourceId } }],
          },
        })
        existing = found.docs[0] as { id: number | string } | undefined
      }

      const dealership = matchDealership(draft.brand, draft.sourceDealerName)
      if (!dealership) rowWarnings.push('No se encontro una agencia coincidente; asignar antes de publicar')
      if (!(draft as Record<string, unknown>).price) rowWarnings.push('Falta precio; revisar antes de publicar')

      if (rowWarnings.length > 0) {
        warnings.push({ row: rowNumber, message: rowWarnings.join(', ') })
      }

      const data: Record<string, unknown> = {
        ...draft,
        sourceImportId: String(job.id),
        dealership,
        inventoryStatus: 'available',
        publishStatus: 'draft',
      }

      if (existing && options.updateExisting) {
        await payload.update({
          collection: 'vehicles',
          id: existing.id,
          data: data as never,
          overrideAccess: true,
          req: reqContext,
        })
        updatedCount += 1
        createdVehicleIds.push(existing.id)
      } else if (existing) {
        skippedCount += 1
      } else {
        const created = await payload.create({
          collection: 'vehicles',
          data: data as never,
          overrideAccess: true,
          req: reqContext,
        })
        createdCount += 1
        createdVehicleIds.push(created.id)
        if (rowWarnings.length > 0) reviewCount += 1
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al crear vehículo'
      errors.push({ row: rowNumber, message })
    }
  }

  const summary = [
    `${rows.length} filas procesadas`,
    `${createdCount} creados`,
    `${updatedCount} actualizados`,
    `${skippedCount} duplicados omitidos`,
    `${reviewCount} requieren revisión`,
    `${warnings.length} con advertencias`,
    `${errors.length} con error`,
  ].join('\n')

  await payload.update({
    collection: 'import-jobs',
    id: job.id,
    data: {
      status: 'completed',
      createdCount,
      updatedCount,
      skippedCount,
      reviewCount,
      errorCount: errors.length,
      errors: errors.slice(0, 200),
      summary,
      createdVehicleIds,
    },
    overrideAccess: true,
    req: reqContext,
  })

  return NextResponse.json({
    ok: true,
    jobId: job.id,
    createdCount,
    updatedCount,
    skippedCount,
    reviewCount,
    warningCount: warnings.length,
    errorCount: errors.length,
    warnings,
    errors,
    summary,
  })
}

import { NextResponse } from 'next/server'

import type { Role } from '../../../../../../access/roles'
import { requireCmsRole } from '../../../../../../services/cmsRequestAuth'
import { assignApprovedVehicleMediaAsset } from '../../../../../../services/vehicleMediaPolicy'

const ASSIGN_ROLES: Role[] = ['general']

type AssignBody = {
  vehicleId?: number | string
  assetId?: number | string
  target?: 'hero' | 'gallery'
}

export async function POST(request: Request) {
  let body: AssignBody
  try {
    body = (await request.json()) as AssignBody
  } catch {
    return NextResponse.json({ error: 'Solicitud invalida.' }, { status: 400 })
  }

  const vehicleId = body.vehicleId
  const assetId = body.assetId
  const target = body.target
  if (!vehicleId || !assetId || (target !== 'hero' && target !== 'gallery')) {
    return NextResponse.json({ error: 'vehicleId, assetId y target son requeridos.' }, { status: 400 })
  }

  const auth = await requireCmsRole(request, ASSIGN_ROLES, 'Sin permisos para asignar imagenes.')
  if (auth.response) return auth.response
  const { payload, user } = auth

  const reqContext = { user }
  try {
    const assigned = await assignApprovedVehicleMediaAsset({
      payload,
      vehicleId,
      assetId,
      target,
      req: reqContext,
    })
    return NextResponse.json({ ok: true, vehicleId, ...assigned })
  } catch (error) {
    const status = Number((error as Error & { status?: number }).status) || 500
    const message = error instanceof Error ? error.message : 'No se pudo asignar la imagen aprobada.'
    return NextResponse.json({ error: message }, { status })
  }
}

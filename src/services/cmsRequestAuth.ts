import { NextResponse } from 'next/server'
import { getPayload, type Payload } from 'payload'

import config from '@payload-config'
import { hasRole, type Role } from '../access/roles'

type AuthedUser = NonNullable<Awaited<ReturnType<Payload['auth']>>['user']>

type CmsAuthSuccess = {
  payload: Payload
  user: AuthedUser
  response?: undefined
}

type CmsAuthFailure = {
  payload?: undefined
  user?: undefined
  response: NextResponse
}

/**
 * Shared session + role guard for the custom CMS API routes. Admins always
 * pass. On failure, `response` holds the ready 401/403 JSON to return.
 *
 * Usage:
 *   const auth = await requireCmsRole(request, ['inventory_manager'], 'Sin permisos…')
 *   if (auth.response) return auth.response
 *   const { payload, user } = auth
 */
export async function requireCmsRole(
  request: Request,
  roles: Role[],
  forbiddenMessage = 'Sin permisos para esta operación.',
): Promise<CmsAuthSuccess | CmsAuthFailure> {
  const payload = await getPayload({ config })
  const authResult = await payload.auth({ canSetHeaders: false, headers: request.headers })
  if (!authResult.user) {
    return { response: NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 }) }
  }
  if (!hasRole(authResult.user, 'admin', ...roles)) {
    return { response: NextResponse.json({ error: forbiddenMessage }, { status: 403 }) }
  }
  return { payload, user: authResult.user }
}

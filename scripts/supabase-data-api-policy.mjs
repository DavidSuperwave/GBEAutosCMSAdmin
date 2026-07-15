function normalizedBooleanExpression(value) {
  if (value === null || value === undefined) return ''

  let normalized = String(value).toLowerCase().replace(/\s+/g, '')
  let previous

  do {
    previous = normalized
    normalized = normalized.replace(/::(?:pg_catalog\.)?(?:bool|boolean)$/, '')

    if (normalized.startsWith('(') && normalized.endsWith(')')) {
      normalized = normalized.slice(1, -1)
    }
  } while (normalized !== previous)

  return normalized
}

export function isDenyAllExpression(value) {
  return normalizedBooleanExpression(value) === 'false'
}

/**
 * A policy is safe for the raw Data API only when its command cannot expose
 * or mutate any row. Literal deny-all expressions are intentionally accepted
 * so the existing public_api_deny_all policies remain valid.
 */
export function isUnsafePublicPolicy(policy) {
  const command = String(policy.cmd || '').toUpperCase()
  const deniesExistingRows = isDenyAllExpression(policy.qual)
  const deniesNewRows = isDenyAllExpression(policy.with_check)

  if (command === 'SELECT' || command === 'DELETE') return !deniesExistingRows
  if (command === 'INSERT') return !deniesNewRows
  if (command === 'UPDATE') return !(deniesExistingRows || deniesNewRows)
  if (command === 'ALL') {
    const checkDefaultsToUsing = policy.with_check === null || policy.with_check === undefined
    return !(deniesExistingRows && (deniesNewRows || checkDefaultsToUsing))
  }

  // Fail closed for an unexpected future policy command.
  return true
}

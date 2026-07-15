import { ROLES, type Role } from '../access/roles'

export const DEFAULT_INVITE_ROLE: Role = 'sales'

type InviteRoleResult = { ok: true; role: Role } | { ok: false }

const INVITE_ROLE_VALUES: ReadonlySet<string> = new Set(ROLES.map(({ value }) => value))

type SmtpEnvironment = Record<string, string | undefined>

type InviteUser = { role?: unknown } | null | undefined

export function canInviteUsers(user: InviteUser): boolean {
  return user?.role === 'admin'
}

export function parseInviteRole(value: unknown): InviteRoleResult {
  if (value === undefined) {
    return { ok: true, role: DEFAULT_INVITE_ROLE }
  }

  if (typeof value !== 'string' || !INVITE_ROLE_VALUES.has(value)) {
    return { ok: false }
  }

  return { ok: true, role: value as Role }
}

export function isSmtpReady(environment: SmtpEnvironment): boolean {
  const requiredSettings = [
    environment.SMTP_HOST,
    environment.SMTP_FROM_EMAIL,
    environment.SMTP_PASS,
    environment.SMTP_USER,
  ]
  const configuredPort = environment.SMTP_PORT?.trim()
  const port = configuredPort ? Number(configuredPort) : 587

  return (
    requiredSettings.every((value) => typeof value === 'string' && value.trim().length > 0) &&
    Number.isInteger(port) &&
    port >= 1 &&
    port <= 65535
  )
}

export function buildAdminResetUrl(serverUrl: string | undefined, token: string): string | null {
  const base = serverUrl?.trim().replace(/\/+$/, '')
  if (!base || !token) return null

  try {
    const parsed = new URL(base)
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      return null
    }

    return `${base}/admin/reset/${encodeURIComponent(token)}`
  } catch {
    return null
  }
}

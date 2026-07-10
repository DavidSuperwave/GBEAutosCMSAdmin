/**
 * Role-based access control for the GB Automotriz CMS.
 *
 * Three-role model (D01, approved 2026-07-10):
 * - admin:   everything, including user management and role assignment.
 * - general: day-to-day operations — inventory, content, media, imports,
 *            AI studio. No user management, no lead management.
 * - sales:   lead/WhatsApp workflows plus read-only inventory.
 *
 * Fail-closed: users with a missing or unrecognized role resolve to no roles
 * and are denied everything role-gated. The F002 live capture (2026-07-10)
 * verified every existing user holds a valid role, so no account loses access.
 */
import type { Access, FieldAccess } from 'payload'

export type Role = 'admin' | 'general' | 'sales'

export const ROLES: { label: string; value: Role }[] = [
  { label: 'Administrador', value: 'admin' },
  { label: 'Operación general', value: 'general' },
  { label: 'Ventas', value: 'sales' },
]

type UserLike = { role?: Role | null; roles?: Role[] | null } | null | undefined

const ROLE_VALUES: ReadonlySet<string> = new Set(ROLES.map((r) => r.value))

export function getRoles(user: UserLike): Role[] {
  // Supports a single `role` (current schema) and is tolerant of a legacy
  // `roles` array. Only values in the known role catalog count; a missing or
  // unrecognized role yields no roles (fail closed).
  const single = user?.role
  const many = user?.roles
  return [single, ...(many || [])].filter(
    (value): value is Role => typeof value === 'string' && ROLE_VALUES.has(value),
  )
}

export function hasRole(user: UserLike, ...roles: Role[]): boolean {
  const userRoles = getRoles(user)
  return roles.some((role) => userRoles.includes(role))
}

export function isAdmin(user: UserLike): boolean {
  return hasRole(user, 'admin')
}

// ---- Collection-level access helpers -------------------------------------

export const isAdminAccess: Access = ({ req }) => isAdmin(req.user as UserLike)

export const isAuthenticated: Access = ({ req }) => Boolean(req.user)

/** Anyone authenticated can read; the public can also read where noted. */
export const publicRead: Access = () => true

export function rolesAccess(...roles: Role[]): Access {
  return ({ req }) => hasRole(req.user as UserLike, 'admin', ...roles)
}

/** Inventory management: admin + general operators. */
export const canManageInventory: Access = ({ req }) =>
  hasRole(req.user as UserLike, 'admin', 'general')

export const canManageContent: Access = ({ req }) =>
  hasRole(req.user as UserLike, 'admin', 'general')

export const canManageMedia: Access = ({ req }) =>
  hasRole(req.user as UserLike, 'admin', 'general')

/**
 * Roles allowed to review (approve/reject) vehicle media. Single source of
 * truth shared by the review/assign API routes, collection field access, and
 * the Image Studio client UI.
 */
export const MEDIA_REVIEW_ROLES: Role[] = ['admin', 'general']

export function isMediaReviewer(user: UserLike): boolean {
  return hasRole(user, ...MEDIA_REVIEW_ROLES)
}

export const canManageLeads: Access = ({ req }) =>
  hasRole(req.user as UserLike, 'admin', 'sales')

// ---- Field-level access --------------------------------------------------

export const adminFieldAccess: FieldAccess = ({ req }) => isAdmin(req.user as UserLike)

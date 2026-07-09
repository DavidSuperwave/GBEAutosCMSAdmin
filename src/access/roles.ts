/**
 * Role-based access control for the GB Automotriz CMS.
 *
 * Roles: admin, inventory_manager, content_editor, sales_manager,
 * media_editor, viewer.
 *
 * Backwards compatibility: users created before the roles field existed have no
 * roles. They are treated as admins so existing accounts are never locked out.
 */
import type { Access, FieldAccess } from 'payload'

export type Role =
  | 'admin'
  | 'inventory_manager'
  | 'content_editor'
  | 'sales_manager'
  | 'media_editor'
  | 'viewer'

export const ROLES: { label: string; value: Role }[] = [
  { label: 'Administrador', value: 'admin' },
  { label: 'Gerente de inventario', value: 'inventory_manager' },
  { label: 'Editor de contenido', value: 'content_editor' },
  { label: 'Gerente de ventas', value: 'sales_manager' },
  { label: 'Editor de medios', value: 'media_editor' },
  { label: 'Solo lectura', value: 'viewer' },
]

type UserLike = { role?: Role | null; roles?: Role[] | null } | null | undefined

export function getRoles(user: UserLike): Role[] {
  // Supports a single `role` (current schema) and is tolerant of a legacy
  // `roles` array. Users without any role behave as admins so existing
  // accounts are never locked out.
  const single = user?.role
  const many = user?.roles
  const resolved = [single, ...(many || [])].filter(Boolean) as Role[]
  if (resolved.length === 0) return user ? ['admin'] : []
  return resolved
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

/** Inventory management: admin + inventory managers (content editors read-only elsewhere). */
export const canManageInventory: Access = ({ req }) =>
  hasRole(req.user as UserLike, 'admin', 'inventory_manager')

export const canManageContent: Access = ({ req }) =>
  hasRole(req.user as UserLike, 'admin', 'content_editor')

export const canManageMedia: Access = ({ req }) =>
  hasRole(req.user as UserLike, 'admin', 'media_editor', 'inventory_manager', 'content_editor')

/**
 * Roles allowed to review (approve/reject) vehicle media. Single source of
 * truth shared by the review/assign API routes, collection field access, and
 * the Image Studio client UI.
 */
export const MEDIA_REVIEW_ROLES: Role[] = ['admin', 'media_editor']

export function isMediaReviewer(user: UserLike): boolean {
  return hasRole(user, ...MEDIA_REVIEW_ROLES)
}

export const canManageLeads: Access = ({ req }) =>
  hasRole(req.user as UserLike, 'admin', 'sales_manager')

// ---- Field-level access --------------------------------------------------

export const adminFieldAccess: FieldAccess = ({ req }) => isAdmin(req.user as UserLike)

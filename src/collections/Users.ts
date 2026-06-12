import type { CollectionConfig } from 'payload'

import { adminFieldAccess, isAdmin, ROLES } from '../access/roles'

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    // Admins manage everyone; non-admins can read/update only themselves.
    create: ({ req }) => isAdmin(req.user),
    read: ({ req }) => {
      if (isAdmin(req.user)) return true
      return req.user ? { id: { equals: req.user.id } } : false
    },
    update: ({ req }) => {
      if (isAdmin(req.user)) return true
      return req.user ? { id: { equals: req.user.id } } : false
    },
    delete: ({ req }) => isAdmin(req.user),
  },
  admin: {
    group: false,
    useAsTitle: 'email',
    defaultColumns: ['email', 'role', 'updatedAt'],
    components: {
      beforeList: [
        {
          path: './components/UserInviteLink',
        },
      ],
    },
  },
  auth: true,
  labels: {
    singular: 'Usuario',
    plural: 'Usuarios',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Nombre',
    },
    {
      name: 'role',
      type: 'select',
      label: 'Rol',
      defaultValue: 'viewer',
      access: {
        // Only admins can change roles (prevents privilege escalation).
        create: adminFieldAccess,
        update: adminFieldAccess,
      },
      admin: {
        description: 'Define qué acciones puede realizar el usuario en el CMS.',
      },
      options: ROLES,
    },
  ],
}

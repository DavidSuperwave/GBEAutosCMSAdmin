import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'updatedAt'],
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
    // Email is added by default by Payload auth.
  ],
}

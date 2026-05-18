import type { CollectionConfig } from 'payload'

export const Leads: CollectionConfig = {
  slug: 'leads',
  access: {
    create: () => true,
  },
  admin: {
    useAsTitle: 'firstName',
    defaultColumns: ['firstName', 'lastName', 'phone', 'source', 'stage', 'createdAt'],
  },
  fields: [
    { name: 'firstName', type: 'text', required: true },
    { name: 'lastName', type: 'text' },
    { name: 'email', type: 'email' },
    { name: 'phone', type: 'text', required: true },
    {
      name: 'source',
      type: 'select',
      defaultValue: 'website_form',
      options: [
        { label: 'Website Form', value: 'website_form' },
        { label: 'WhatsApp', value: 'whatsapp' },
        { label: 'Phone', value: 'phone' },
        { label: 'Walk In', value: 'walk_in' },
      ],
    },
    { name: 'vehicle', type: 'relationship', relationTo: 'vehicles' },
    { name: 'message', type: 'textarea' },
    {
      name: 'stage',
      type: 'select',
      defaultValue: 'new',
      options: [
        { label: 'New', value: 'new' },
        { label: 'Contacted', value: 'contacted' },
        { label: 'In Progress', value: 'in_progress' },
        { label: 'Closed Won', value: 'closed_won' },
        { label: 'Closed Lost', value: 'closed_lost' },
      ],
    },
    { name: 'notes', type: 'textarea' },
  ],
}

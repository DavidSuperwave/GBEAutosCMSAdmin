import type { GlobalConfig } from 'payload'

export const SiteConfig: GlobalConfig = {
  slug: 'site-config',
  access: {
    read: () => true,
  },
  fields: [
    { name: 'siteName', type: 'text' },
    { name: 'companyName', type: 'text' },
    { name: 'slogan', type: 'text' },
    { name: 'phone', type: 'text' },
    { name: 'whatsapp', type: 'text' },
    { name: 'email', type: 'email' },
    { name: 'address', type: 'text' },
    {
      name: 'socialLinks',
      type: 'group',
      fields: [
        { name: 'facebook', type: 'text' },
        { name: 'instagram', type: 'text' },
        { name: 'whatsappUrl', type: 'text' },
      ],
    },
  ],
}

import type { GlobalConfig } from 'payload'

export const Home: GlobalConfig = {
  slug: 'home',
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'hero',
      type: 'group',
      fields: [
        { name: 'title', type: 'text' },
        { name: 'subtitle', type: 'textarea' },
        { name: 'ctaLabel', type: 'text' },
        { name: 'ctaHref', type: 'text' },
        { name: 'secondaryCtaLabel', type: 'text' },
        { name: 'secondaryCtaHref', type: 'text' },
      ],
    },
    {
      name: 'stats',
      type: 'array',
      fields: [
        { name: 'value', type: 'text' },
        { name: 'label', type: 'text' },
      ],
    },
    {
      name: 'financing',
      type: 'group',
      fields: [
        { name: 'heading', type: 'text' },
        { name: 'body', type: 'textarea' },
        { name: 'ctaLabel', type: 'text' },
        { name: 'ctaHref', type: 'text' },
      ],
    },
    {
      name: 'testimonial',
      type: 'group',
      fields: [
        { name: 'heading', type: 'text' },
        { name: 'quote', type: 'textarea' },
        { name: 'author', type: 'text' },
      ],
    },
    {
      name: 'brands',
      type: 'array',
      fields: [{ name: 'name', type: 'text' }],
    },
  ],
}

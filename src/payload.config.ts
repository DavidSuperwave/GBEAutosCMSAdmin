import { postgresAdapter } from '@payloadcms/db-postgres'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { es } from 'payload/i18n/es'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Vehicles } from './collections/Vehicles'
import { Dealerships } from './collections/Dealerships'
import { Leads } from './collections/Leads'
import { AnalyticsEvents } from './collections/AnalyticsEvents'
import { Pages } from './collections/Pages'
import { SiteConfig } from './globals/SiteConfig'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const smtpPort = Number(process.env.SMTP_PORT || 587)
const hasSMTPConfig = Boolean(
  process.env.SMTP_HOST &&
    process.env.SMTP_FROM_EMAIL &&
    process.env.SMTP_PASS &&
    process.env.SMTP_USER &&
    Number.isFinite(smtpPort),
)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      beforeNavLinks: ['./components/AdminHomeLink'],
      graphics: {
        Logo: './components/PrismaCMSLogo',
      },
    },
    dashboard: {
      widgets: [
        {
          slug: 'analytics-dashboard',
          label: 'Analitica',
          Component: './components/AnalyticsDashboard',
          minWidth: 'full',
        },
      ],
      defaultLayout: [{ widgetSlug: 'analytics-dashboard', width: 'full' }],
    },
  },
  collections: [Users, Media, Vehicles, Dealerships, Leads, Pages, AnalyticsEvents],
  globals: [SiteConfig],
  editor: lexicalEditor(),
  i18n: {
    fallbackLanguage: 'es',
    supportedLanguages: { es },
  },
  email: hasSMTPConfig
    ? nodemailerAdapter({
        defaultFromAddress: process.env.SMTP_FROM_EMAIL || '',
        defaultFromName: process.env.SMTP_FROM_NAME || 'GBE Autos CMS',
        transportOptions: {
          host: process.env.SMTP_HOST,
          port: smtpPort,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        },
      })
    : undefined,
  secret: process.env.PAYLOAD_SECRET || '',
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
    push: false,
  }),
  sharp,
  plugins: [],
})

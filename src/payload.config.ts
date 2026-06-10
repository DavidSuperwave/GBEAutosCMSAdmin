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
import { ImportJobs } from './collections/ImportJobs'
import { VehicleMediaAssets } from './collections/VehicleMediaAssets'
import { VehicleImageSearches } from './collections/VehicleImageSearches'
import { WorkshopJobs } from './collections/WorkshopJobs'
import { ImageTemplates } from './collections/ImageTemplates'
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
    theme: 'light',
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      actions: ['./components/ThemeToggle'],
      beforeNavLinks: ['./components/AdminHomeLink'],
      afterNavLinks: ['./components/AdminBuilderNavLinks'],
      graphics: {
        Logo: './components/PrismaCMSLogo',
      },
      views: {
        inventory: {
          Component: './components/views/InventoryView',
          path: '/inventory',
        },
        homeBuilder: {
          Component: './components/views/HomeBuilderView',
          path: '/builder/home',
        },
        landingBuilder: {
          Component: './components/views/LandingBuilderView',
          path: '/builder/landing',
        },
        vehicleTemplateBuilder: {
          Component: './components/views/VehicleTemplateView',
          path: '/builder/vehicle-template',
        },
        mediaWorkspace: {
          Component: './components/views/MediaWorkspaceView',
          path: '/media-workspace',
        },
      },
    },
    dashboard: {
      widgets: [
        {
          slug: 'operations-dashboard',
          label: 'Operaciones',
          Component: './components/OperationsDashboard',
          minWidth: 'full',
        },
        {
          slug: 'analytics-dashboard',
          label: 'Analitica',
          Component: './components/AnalyticsDashboard',
          minWidth: 'full',
        },
      ],
      defaultLayout: [
        { widgetSlug: 'operations-dashboard', width: 'full' },
        { widgetSlug: 'analytics-dashboard', width: 'full' },
      ],
    },
  },
  collections: [
    Vehicles,
    ImportJobs,
    VehicleMediaAssets,
    VehicleImageSearches,
    WorkshopJobs,
    ImageTemplates,
    Pages,
    Media,
    Leads,
    AnalyticsEvents,
    Dealerships,
    Users,
  ],
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

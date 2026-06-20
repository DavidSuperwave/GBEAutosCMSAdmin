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
import { VehicleTags } from './collections/VehicleTags'
import { VehicleCollections } from './collections/VehicleCollections'
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

function readPositiveInt(name: string, fallback: number) {
  const value = Number(process.env[name])
  return Number.isInteger(value) && value > 0 ? value : fallback
}

const defaultPoolMax = process.env.NODE_ENV === 'production' ? 1 : 3
const configuredPoolMax = readPositiveInt('POSTGRES_POOL_MAX', defaultPoolMax)
const poolMax = process.env.NODE_ENV === 'production' ? Math.min(configuredPoolMax, 1) : configuredPoolMax

export default buildConfig({
  admin: {
    user: Users.slug,
    theme: 'light',
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      beforeNavLinks: ['./components/AdminHomeLink'],
      afterNavLinks: ['./components/AdminBuilderNavLinks'],
      views: {
        vehicleCreate: {
          Component: './components/views/VehicleCreateView',
          path: '/inventory/new',
        },
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
        pagesBuilder: {
          Component: './components/views/LandingBuilderView',
          path: '/pages-builder',
        },
        vehicleTemplateBuilder: {
          Component: './components/views/VehicleTemplateView',
          path: '/builder/vehicle-template',
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
    VehicleTags,
    VehicleCollections,
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
      allowExitOnIdle: true,
      connectionTimeoutMillis: readPositiveInt('POSTGRES_CONNECTION_TIMEOUT_MS', 5000),
      idleTimeoutMillis: readPositiveInt(
        'POSTGRES_IDLE_TIMEOUT_MS',
        process.env.NODE_ENV === 'production' ? 30000 : 10000,
      ),
      max: poolMax,
      maxLifetimeSeconds: readPositiveInt('POSTGRES_MAX_LIFETIME_SECONDS', 300),
      min: 0,
      application_name:
        process.env.POSTGRES_APPLICATION_NAME || `gbe-autos-cms-${process.env.NODE_ENV || 'dev'}`,
    },
    push: false,
  }),
  sharp,
  plugins: [],
})

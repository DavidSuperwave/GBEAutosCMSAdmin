import { postgresAdapter } from '@payloadcms/db-postgres'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import path from 'path'
import { buildConfig } from 'payload'
import { es } from 'payload/i18n/es'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import type { UserLike } from './access/roles'
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
import {
  buildSupabasePublicMediaUrl,
  canUseSupabaseMediaClientUploads,
  readSupabaseS3StorageConfig,
} from './services/supabaseS3Storage'
import { resolvePostgresPoolMax } from './services/postgresPoolConfig'
import { isSmtpReady } from './services/userInvite'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const smtpPort = Number(process.env.SMTP_PORT || 587)
const hasSMTPConfig = isSmtpReady(process.env)

function readPositiveInt(name: string, fallback: number) {
  const value = Number(process.env[name])
  return Number.isInteger(value) && value > 0 ? value : fallback
}

const poolMax = resolvePostgresPoolMax(process.env)
const supabaseS3 = readSupabaseS3StorageConfig(process.env)
const supabaseS3Required = process.env.SUPABASE_S3_REQUIRED === 'true'

if (supabaseS3Required && !supabaseS3.configured) {
  const details = [...supabaseS3.missing, ...supabaseS3.errors].join('; ')
  throw new Error(`Supabase S3 storage is required but unavailable: ${details}`)
}

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
      graphics: {
        Logo: './components/PrismaCMSLogo',
      },
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
  plugins: supabaseS3.configured
    ? [
        s3Storage({
          bucket: supabaseS3.config.bucket,
          clientUploads: {
            access: ({ collectionSlug, req }) =>
              canUseSupabaseMediaClientUploads(collectionSlug, req.user as UserLike),
          },
          collections: {
            media: {
              generateFileURL: ({ filename, prefix }) =>
                buildSupabasePublicMediaUrl(supabaseS3.config, filename, prefix),
              prefix: supabaseS3.config.prefix,
            },
          },
          config: {
            credentials: {
              accessKeyId: supabaseS3.config.accessKeyId,
              secretAccessKey: supabaseS3.config.secretAccessKey,
            },
            endpoint: supabaseS3.config.endpoint,
            forcePathStyle: true,
            region: supabaseS3.config.region,
          },
          useCompositePrefixes: true,
        }),
      ]
    : [],
})

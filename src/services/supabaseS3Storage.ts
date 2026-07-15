import { hasRole, type UserLike } from '../access/roles'

export const REQUIRED_SUPABASE_S3_ENV = [
  'SUPABASE_S3_ENDPOINT',
  'SUPABASE_S3_REGION',
  'SUPABASE_S3_ACCESS_KEY_ID',
  'SUPABASE_S3_SECRET_ACCESS_KEY',
  'SUPABASE_S3_BUCKET',
  'SUPABASE_S3_PREFIX',
  'SUPABASE_S3_PUBLIC_URL_BASE',
] as const

export type SupabaseS3StorageConfig = {
  accessKeyId: string
  bucket: string
  endpoint: string
  prefix: string
  publicUrlBase: string
  region: string
  secretAccessKey: string
}

export type SupabaseS3StorageConfigResult =
  | { configured: true; config: SupabaseS3StorageConfig; missing: [] }
  | { configured: false; errors: string[]; missing: string[] }

export function canUseSupabaseMediaClientUploads(
  collectionSlug: string,
  user: UserLike,
): boolean {
  return collectionSlug === 'media' && hasRole(user, 'admin', 'general')
}

export function readSupabaseS3StorageConfig(
  env: Record<string, string | undefined>,
): SupabaseS3StorageConfigResult {
  const missing = REQUIRED_SUPABASE_S3_ENV.filter((name) => !env[name]?.trim())
  if (missing.length > 0) return { configured: false, errors: [], missing: [...missing] }

  const config = {
    accessKeyId: env.SUPABASE_S3_ACCESS_KEY_ID!.trim(),
    bucket: env.SUPABASE_S3_BUCKET!.trim(),
    endpoint: env.SUPABASE_S3_ENDPOINT!.trim().replace(/\/+$/, ''),
    prefix: env.SUPABASE_S3_PREFIX!.trim().replace(/^\/+|\/+$/g, ''),
    publicUrlBase: env.SUPABASE_S3_PUBLIC_URL_BASE!.trim().replace(/\/+$/, ''),
    region: env.SUPABASE_S3_REGION!.trim(),
    secretAccessKey: env.SUPABASE_S3_SECRET_ACCESS_KEY!.trim(),
  }
  const errors = validateSupabaseS3StorageConfig(config)
  if (errors.length > 0) return { configured: false, errors, missing: [] }

  return { configured: true, config, missing: [] }
}

export function validateSupabaseS3StorageConfig(config: SupabaseS3StorageConfig) {
  const errors: string[] = []
  let projectRef = ''
  try {
    const endpoint = new URL(config.endpoint)
    if (endpoint.protocol !== 'https:') errors.push('SUPABASE_S3_ENDPOINT must use HTTPS')
    const endpointHost = /^([a-z0-9-]+)\.storage\.supabase\.co$/.exec(endpoint.hostname)
    if (!endpointHost) {
      errors.push('SUPABASE_S3_ENDPOINT must use a Supabase Storage hostname')
    } else projectRef = endpointHost[1]
    if (endpoint.pathname.replace(/\/+$/, '') !== '/storage/v1/s3') {
      errors.push('SUPABASE_S3_ENDPOINT must end with /storage/v1/s3')
    }
    if (endpoint.search || endpoint.hash || endpoint.username || endpoint.password) {
      errors.push('SUPABASE_S3_ENDPOINT must not contain credentials, query parameters, or fragments')
    }
  } catch {
    errors.push('SUPABASE_S3_ENDPOINT must be a valid URL')
  }

  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(config.bucket)) {
    errors.push('SUPABASE_S3_BUCKET is not a valid S3 bucket name')
  }
  if (!/^[a-z0-9][a-z0-9_/-]{0,126}[a-z0-9_]$/.test(config.prefix) || config.prefix.includes('..')) {
    errors.push('SUPABASE_S3_PREFIX must be a safe, non-empty object-key prefix')
  }

  try {
    const publicBase = new URL(config.publicUrlBase)
    if (publicBase.protocol !== 'https:') {
      errors.push('SUPABASE_S3_PUBLIC_URL_BASE must use HTTPS')
    }
    if (!projectRef || publicBase.hostname !== `${projectRef}.supabase.co`) {
      errors.push('SUPABASE_S3_PUBLIC_URL_BASE must use the same project ref as SUPABASE_S3_ENDPOINT')
    }
    if (publicBase.pathname.replace(/\/+$/, '') !== `/storage/v1/object/public/${config.bucket}`) {
      errors.push('SUPABASE_S3_PUBLIC_URL_BASE must end with /storage/v1/object/public/<bucket>')
    }
    if (publicBase.search || publicBase.hash || publicBase.username || publicBase.password) {
      errors.push(
        'SUPABASE_S3_PUBLIC_URL_BASE must not contain credentials, query parameters, or fragments',
      )
    }
  } catch {
    errors.push('SUPABASE_S3_PUBLIC_URL_BASE must be a valid URL')
  }
  return errors
}

function safePathSegments(value: string, label: string) {
  const normalized = value.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '')
  const segments = normalized.split('/').filter(Boolean)
  if (
    segments.length === 0 ||
    segments.some(
      (segment) => segment === '.' || segment === '..' || /[\u0000-\u001f\u007f]/.test(segment),
    )
  ) {
    throw new Error(`${label} contains an unsafe path segment`)
  }
  return segments
}

export function buildSupabasePublicMediaUrl(
  config: Pick<SupabaseS3StorageConfig, 'prefix' | 'publicUrlBase'>,
  filename: string,
  documentPrefix?: string | null,
) {
  const objectKey = buildSupabaseMediaObjectKey(config.prefix, filename, documentPrefix)
  return `${config.publicUrlBase}/${objectKey
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`
}

export function buildSupabaseMediaObjectKey(
  collectionPrefix: string,
  filename: string,
  documentPrefix?: string | null,
) {
  if (
    !filename ||
    filename === '.' ||
    filename === '..' ||
    filename.includes('/') ||
    filename.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(filename)
  ) {
    throw new Error('Media filename must be a basename')
  }
  const segments = [
    ...safePathSegments(collectionPrefix, 'SUPABASE_S3_PREFIX'),
    ...(documentPrefix ? safePathSegments(documentPrefix, 'media prefix') : []),
    filename,
  ]
  return segments.join('/')
}

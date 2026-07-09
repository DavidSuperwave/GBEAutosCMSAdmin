/**
 * Vehicle workflow services.
 *
 * Pure helpers (no Payload/IO dependencies) shared between Payload hooks, the
 * custom inventory screens and the vehicle workspace. They derive completeness,
 * image/spec status and publish validation from a vehicle-like object so the
 * same business rules apply whether a vehicle is created manually or imported.
 */
import { galleryMediaIds, landingMediaIds, relationId } from './relations'

export type PublishStatus = 'draft' | 'needs_review' | 'published' | 'archived'
export type ImageStatus =
  | 'missing'
  | 'candidate_found'
  | 'uploaded'
  | 'generated'
  | 'approved'
  | 'rejected'
export type SpecStatus = 'missing' | 'partial' | 'matched' | 'manual' | 'verified'

export type VehicleLike = {
  brand?: string | null
  model?: string | null
  year?: number | null
  condition?: string | null
  dealership?: unknown
  city?: string | null
  price?: string | null
  mileage?: number | null
  image?: unknown
  imageUrl?: string | null
  imagePath?: string | null
  imageFilename?: string | null
  gallery?: unknown[] | null
  landing?: unknown[] | null
  description?: string | null
  features?: unknown[] | null
  specs?: Record<string, unknown> | null
  slug?: string | null
  inventoryStatus?: string | null
  publishStatus?: string | null
  imageStatus?: string | null
  specStatus?: string | null
  exteriorColor?: string | null
  allowFallbackRouting?: boolean | null
  sourceMeta?: { specSource?: string | null } | null
}

export const SPEC_KEYS = [
  'tipo',
  'motor',
  'potencia',
  'transmision',
  'combustible',
  'traccion',
  'cylinders',
  'seats',
  'doors',
  'lengthMm',
  'widthMm',
  'heightMm',
  'wheelbaseMm',
  'maxTrunkCapacityL',
  'torqueNm',
  'fuelTankCapacityL',
] as const

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value as object).length > 0
  return Boolean(value)
}

function hasVehicleImage(vehicle: VehicleLike): boolean {
  return hasValue(vehicle.image)
}

export function countFilledSpecs(vehicle: VehicleLike): number {
  const specs = vehicle.specs || {}
  return SPEC_KEYS.reduce((count, key) => (hasValue(specs[key]) ? count + 1 : count), 0)
}

/**
 * Weighted completeness checklist. Returns an integer 0-100.
 */
export function calculateVehicleCompleteness(vehicle: VehicleLike): number {
  const checks: Array<{ done: boolean; weight: number }> = [
    { done: hasValue(vehicle.brand), weight: 12 },
    { done: hasValue(vehicle.model), weight: 12 },
    { done: hasValue(vehicle.year), weight: 8 },
    { done: hasValue(vehicle.condition), weight: 6 },
    { done: hasValue(vehicle.dealership), weight: 12 },
    { done: hasValue(vehicle.price), weight: 10 },
    { done: hasVehicleImage(vehicle), weight: 14 },
    { done: (vehicle.gallery?.length ?? 0) > 0, weight: 6 },
    { done: hasValue(vehicle.description), weight: 8 },
    { done: (vehicle.features?.length ?? 0) > 0, weight: 4 },
    { done: countFilledSpecs(vehicle) >= 4, weight: 8 },
  ]

  const total = checks.reduce((sum, check) => sum + check.weight, 0)
  const earned = checks.reduce((sum, check) => sum + (check.done ? check.weight : 0), 0)
  return Math.round((earned / total) * 100)
}

/**
 * Derive image status without clobbering explicit lifecycle states set by the
 * media workshop or reviewers (approved / generated / rejected / candidate).
 */
export function deriveImageStatus(vehicle: VehicleLike): ImageStatus {
  const explicit = vehicle.imageStatus
  const hasImage = hasVehicleImage(vehicle)
  if (
    explicit === 'rejected' ||
    explicit === 'candidate_found' ||
    (hasImage && (explicit === 'approved' || explicit === 'generated'))
  ) {
    return explicit
  }
  return hasImage ? 'uploaded' : 'missing'
}

/**
 * Derive spec status. Verified / manual choices are preserved.
 */
export function deriveSpecStatus(vehicle: VehicleLike): SpecStatus {
  const explicit = vehicle.specStatus
  const filled = countFilledSpecs(vehicle)
  if (filled === 0) return 'missing'
  if (explicit === 'verified') return filled >= 4 ? 'verified' : 'partial'
  if (explicit === 'manual') return 'manual'

  const source = vehicle.sourceMeta?.specSource

  if ((source === 'rapidapi' || source === 'catalog') && filled >= 5) return 'matched'
  return 'partial'
}

export type PublishIssueArea =
  | 'routing'
  | 'identity'
  | 'inventory'
  | 'media'
  | 'pricing'
  | 'content'
  | 'specs'

export type PublishIssue = {
  message: string
  severity: 'critical' | 'warning'
  area: PublishIssueArea
}

export type PublishIssues = {
  critical: string[]
  warnings: string[]
  issues: PublishIssue[]
}

export type PublishIssueOptions = {
  /**
   * Media ids (as strings) with approved review status and clear rights for
   * this vehicle — see approvedVehicleMediaMap in vehicleMediaPolicy. When
   * provided, unapproved hero/gallery/landing media become critical issues,
   * so callers that can query the approval set (the Vehicles hook) and
   * callers that cannot (client preflight) share one rule set.
   */
  approvedMediaIds?: Set<string>
}

/**
 * Validate whether a vehicle can be safely published. Critical issues block
 * publishing; warnings can be acknowledged.
 */
export function getVehiclePublishIssues(
  vehicle: VehicleLike,
  options: PublishIssueOptions = {},
): PublishIssues {
  const issues: PublishIssue[] = []
  const critical = (message: string, area: PublishIssueArea) =>
    issues.push({ message, severity: 'critical', area })
  const warning = (message: string, area: PublishIssueArea) =>
    issues.push({ message, severity: 'warning', area })

  const hasRoutingPath = hasValue(vehicle.dealership) || hasValue(vehicle.city) || vehicle.allowFallbackRouting
  if (!hasRoutingPath) critical('Falta asignar una agencia, ciudad o fallback WhatsApp.', 'routing')
  if (!hasValue(vehicle.brand)) critical('Falta la marca.', 'identity')
  if (!hasValue(vehicle.model)) critical('Falta el modelo.', 'identity')
  if (!hasValue(vehicle.year)) critical('Falta el año.', 'identity')
  if (!hasValue(vehicle.condition)) critical('Falta la condición (nuevo / seminuevo).', 'identity')
  if (!hasValue(vehicle.inventoryStatus)) critical('Falta el estatus de inventario.', 'inventory')
  if (!hasValue(vehicle.slug)) critical('Falta el slug de la página.', 'identity')

  const approved = options.approvedMediaIds
  if (!hasVehicleImage(vehicle)) {
    critical('Falta la imagen principal aprobada.', 'media')
  } else {
    const heroId = relationId(vehicle.image)
    const heroUnapproved = approved ? heroId === undefined || !approved.has(String(heroId)) : false
    if (heroUnapproved) {
      critical('La imagen principal debe estar aprobada y con derechos claros antes de publicarse.', 'media')
    } else if (vehicle.imageStatus !== 'approved') {
      warning('La imagen principal aún no está aprobada.', 'media')
    }
  }
  if (approved) {
    if (galleryMediaIds(vehicle.gallery).some((id) => !approved.has(String(id)))) {
      critical('Todas las imágenes de galería públicas deben estar aprobadas y con derechos claros.', 'media')
    }
    if (landingMediaIds(vehicle.landing).some((id) => !approved.has(String(id)))) {
      critical('Todas las imágenes de landing públicas deben estar aprobadas y con derechos claros.', 'media')
    }
  }

  if (!hasValue(vehicle.price)) warning('Falta el precio (se publicará "Precio a consultar").', 'pricing')
  if (vehicle.condition === 'used' && !hasValue(vehicle.mileage)) {
    warning('Un seminuevo sin kilometraje puede generar dudas.', 'content')
  }
  if (vehicle.imageStatus === 'generated') warning('Se está usando una imagen generada con IA.', 'media')
  if ((vehicle.gallery?.length ?? 0) === 0) warning('No hay imágenes en la galería.', 'media')
  if (countFilledSpecs(vehicle) < 4) warning('Las especificaciones están incompletas.', 'specs')
  if (hasValue(vehicle.description) && String(vehicle.description).trim().length < 40) {
    warning('La descripción es muy corta o genérica.', 'content')
  } else if (!hasValue(vehicle.description)) {
    warning('Falta una descripción.', 'content')
  }

  return {
    critical: issues.filter((issue) => issue.severity === 'critical').map((issue) => issue.message),
    warnings: issues.filter((issue) => issue.severity === 'warning').map((issue) => issue.message),
    issues,
  }
}

export function canPublish(vehicle: VehicleLike): boolean {
  return getVehiclePublishIssues(vehicle).critical.length === 0
}

export const PUBLISH_STATUS_LABELS: Record<PublishStatus, string> = {
  draft: 'Borrador',
  needs_review: 'En revisión',
  published: 'Publicado',
  archived: 'Archivado',
}

export const IMAGE_STATUS_LABELS: Record<ImageStatus, string> = {
  missing: 'Sin imagen',
  candidate_found: 'Candidata',
  uploaded: 'En revisión',
  generated: 'IA en revisión',
  approved: 'Aprobada',
  rejected: 'Rechazada',
}

/** Longer explanations for tooltips; badges stay short. */
export const IMAGE_STATUS_DESCRIPTIONS: Record<ImageStatus, string> = {
  missing: 'No hay imagen pública para este vehículo.',
  candidate_found: 'Hay una imagen sincronizada del inventario pendiente de aprobar.',
  uploaded: 'La imagen subida espera aprobación de un revisor.',
  generated: 'La imagen generada con IA espera aprobación de un revisor.',
  approved: 'La imagen principal está aprobada y publicada.',
  rejected: 'La imagen fue rechazada; el vehículo necesita otra imagen.',
}

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

/** One tone vocabulary for image-status badges across inventory and workspace. */
export const IMAGE_STATUS_TONES: Record<ImageStatus, StatusTone> = {
  missing: 'danger',
  candidate_found: 'warning',
  uploaded: 'warning',
  generated: 'warning',
  approved: 'success',
  rejected: 'danger',
}

export const SPEC_STATUS_LABELS: Record<SpecStatus, string> = {
  missing: 'Sin especificaciones',
  partial: 'Parciales',
  matched: 'Coincidencia automática',
  manual: 'Manual',
  verified: 'Verificadas',
}

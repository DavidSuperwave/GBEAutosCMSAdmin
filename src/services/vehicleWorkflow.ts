/**
 * Vehicle workflow services.
 *
 * Pure, dependency-free helpers shared between Payload hooks, the custom
 * inventory screens and the vehicle workspace. They derive completeness,
 * image/spec status and publish validation from a vehicle-like object so the
 * same business rules apply whether a vehicle is created manually or imported.
 */

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
  gallery?: unknown[] | null
  description?: string | null
  features?: unknown[] | null
  specs?: Record<string, unknown> | null
  slug?: string | null
  inventoryStatus?: string | null
  publishStatus?: string | null
  imageStatus?: string | null
  specStatus?: string | null
  exteriorColor?: string | null
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
    { done: hasValue(vehicle.image), weight: 14 },
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
  if (
    explicit === 'approved' ||
    explicit === 'generated' ||
    explicit === 'rejected' ||
    explicit === 'candidate_found'
  ) {
    return explicit
  }
  return hasValue(vehicle.image) ? 'uploaded' : 'missing'
}

/**
 * Derive spec status. Verified / manual choices are preserved.
 */
export function deriveSpecStatus(vehicle: VehicleLike): SpecStatus {
  const explicit = vehicle.specStatus
  if (explicit === 'verified' || explicit === 'manual') return explicit

  const filled = countFilledSpecs(vehicle)
  const source = vehicle.sourceMeta?.specSource

  if (filled === 0) return 'missing'
  if ((source === 'rapidapi' || source === 'catalog') && filled >= 5) return 'matched'
  return 'partial'
}

export type PublishIssues = {
  critical: string[]
  warnings: string[]
}

/**
 * Validate whether a vehicle can be safely published. Critical issues block
 * publishing; warnings can be acknowledged.
 */
export function getVehiclePublishIssues(vehicle: VehicleLike): PublishIssues {
  const critical: string[] = []
  const warnings: string[] = []

  if (!hasValue(vehicle.dealership)) critical.push('Falta asignar una agencia.')
  if (!hasValue(vehicle.brand)) critical.push('Falta la marca.')
  if (!hasValue(vehicle.model)) critical.push('Falta el modelo.')
  if (!hasValue(vehicle.year)) critical.push('Falta el año.')
  if (!hasValue(vehicle.condition)) critical.push('Falta la condición (nuevo / seminuevo).')
  if (!hasValue(vehicle.inventoryStatus)) critical.push('Falta el estatus de inventario.')
  if (!hasValue(vehicle.slug)) critical.push('Falta el slug de la página.')
  if (!hasValue(vehicle.image)) {
    critical.push('Falta la imagen principal aprobada.')
  } else if (vehicle.imageStatus !== 'approved') {
    warnings.push('La imagen principal aún no está aprobada.')
  }

  if (!hasValue(vehicle.price)) warnings.push('Falta el precio (se publicará "Precio a consultar").')
  if (vehicle.condition === 'used' && !hasValue(vehicle.mileage)) {
    warnings.push('Un seminuevo sin kilometraje puede generar dudas.')
  }
  if (vehicle.imageStatus === 'generated') warnings.push('Se está usando una imagen generada con IA.')
  if ((vehicle.gallery?.length ?? 0) === 0) warnings.push('No hay imágenes en la galería.')
  if (countFilledSpecs(vehicle) < 4) warnings.push('Las especificaciones están incompletas.')
  if (hasValue(vehicle.description) && String(vehicle.description).trim().length < 40) {
    warnings.push('La descripción es muy corta o genérica.')
  } else if (!hasValue(vehicle.description)) {
    warnings.push('Falta una descripción.')
  }

  return { critical, warnings }
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
  candidate_found: 'Candidata encontrada',
  uploaded: 'Subida',
  generated: 'Generada con IA',
  approved: 'Aprobada',
  rejected: 'Rechazada',
}

export const SPEC_STATUS_LABELS: Record<SpecStatus, string> = {
  missing: 'Sin especificaciones',
  partial: 'Parciales',
  matched: 'Coincidencia automática',
  manual: 'Manual',
  verified: 'Verificadas',
}

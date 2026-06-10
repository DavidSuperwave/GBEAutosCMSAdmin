/**
 * Import normalization helpers.
 *
 * Turn raw dealership workbook rows (the TIPO / IDV / DES_* format) into clean
 * vehicle drafts that can enter the publish workflow.
 */

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function normalizeImportedCondition(value: unknown): 'new' | 'used' {
  const text = normalizeText(value)
  if (!text) return 'new'
  if (
    text.includes('semi') ||
    text.includes('usad') ||
    text.includes('used') ||
    text.includes('seminuevo')
  ) {
    return 'used'
  }
  if (text.includes('nuevo') || text.includes('new') || text === '0' || text.startsWith('0km')) {
    return 'new'
  }
  return 'new'
}

export function normalizeImportedYear(value: unknown): number | undefined {
  const digits = String(value ?? '').replace(/[^\d]/g, '')
  if (!digits) return undefined
  const year = Number(digits.slice(0, 4))
  if (!Number.isFinite(year)) return undefined
  if (year < 1950 || year > new Date().getFullYear() + 2) return undefined
  return year
}

export function normalizeImportedMileage(value: unknown): number | undefined {
  const digits = String(value ?? '').replace(/[^\d]/g, '')
  if (!digits) return undefined
  const mileage = Number(digits)
  return Number.isFinite(mileage) ? mileage : undefined
}

const COLOR_MAP: Record<string, string> = {
  blanco: 'Blanco',
  negro: 'Negro',
  gris: 'Gris',
  plata: 'Plata',
  plateado: 'Plata',
  rojo: 'Rojo',
  azul: 'Azul',
  verde: 'Verde',
  amarillo: 'Amarillo',
  naranja: 'Naranja',
  cafe: 'Café',
  beige: 'Beige',
  dorado: 'Dorado',
  vino: 'Vino',
}

export function normalizeImportedColor(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const key = normalizeText(raw).split(/\s+/)[0]
  if (COLOR_MAP[key]) return COLOR_MAP[key]
  return raw.replace(/\b\w/g, (char) => char.toUpperCase())
}

const BRAND_MAP: Record<string, string> = {
  vw: 'Volkswagen',
  volkswagen: 'Volkswagen',
  chevy: 'Chevrolet',
  chevrolet: 'Chevrolet',
  ford: 'Ford',
  mazda: 'Mazda',
  jeep: 'Jeep',
  ram: 'RAM',
  dodge: 'Dodge',
  fiat: 'Fiat',
  peugeot: 'Peugeot',
  jetour: 'Jetour',
  lincoln: 'Lincoln',
  dfac: 'DFAC',
  dongfeng: 'Dongfeng',
  nissan: 'Nissan',
  toyota: 'Toyota',
  honda: 'Honda',
  kia: 'Kia',
  hyundai: 'Hyundai',
}

export function normalizeImportedBrand(value: unknown): string {
  const key = normalizeText(value).replace(/[^a-z0-9]/g, '')
  if (BRAND_MAP[key]) return BRAND_MAP[key]
  const raw = String(value ?? '').trim()
  return raw.replace(/\b\w/g, (char) => char.toUpperCase())
}

export function normalizeImportedDealership(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
}

const FUEL_MAP: Record<string, string> = {
  gasolina: 'gasoline',
  gas: 'gasoline',
  diesel: 'diesel',
  hibrido: 'hybrid',
  hybrid: 'hybrid',
  electrico: 'electric',
  electric: 'electric',
}

export function normalizeImportedFuel(value: unknown): string {
  const text = normalizeText(value)
  for (const [key, mapped] of Object.entries(FUEL_MAP)) {
    if (text.includes(key)) return mapped
  }
  return ''
}

const BODY_MAP: Record<string, string> = {
  sedan: 'sedan',
  suv: 'suv',
  pickup: 'pickup',
  pick: 'pickup',
  camioneta: 'suv',
  coupe: 'coupe',
  hatchback: 'hatchback',
  hatch: 'hatchback',
  van: 'van',
}

export function normalizeImportedBody(value: unknown): string {
  const text = normalizeText(value)
  for (const [key, mapped] of Object.entries(BODY_MAP)) {
    if (text.includes(key)) return mapped
  }
  return text ? 'other' : ''
}

/**
 * The documented workbook column -> CMS field mapping.
 */
export const WORKBOOK_COLUMN_MAP: Record<string, string> = {
  TIPO: 'condition',
  IDV: 'sourceId',
  NOM_CONCESIONARIO: 'sourceDealerName',
  DES_MARCA: 'brand',
  DES_MODELO: 'model',
  DES_COLOR: 'exteriorColor',
  KM: 'mileage',
  DES_FAMILIA: 'modelFamily',
  ANIO_VEHI: 'year',
  DES_SEGMENTO: 'segment',
  DES_TIPO_MOTOR: 'motorType',
  DES_TIPO_VEHICULO: 'vehicleType',
  DES_COLOR_INTERIOR: 'interiorColor',
}

export type NormalizedVehicleDraft = {
  brand?: string
  model?: string
  trim?: string
  modelFamily?: string
  year?: number
  mileage?: number
  condition: 'new' | 'used'
  exteriorColor?: string
  interiorColor?: string
  vehicleType?: string
  segment?: string
  bodyType?: string
  motorType?: string
  fuel?: string
  sourceId?: string
  sourceDealerName?: string
  stockId?: string
}

export type RowIssue = { field: string; message: string; severity: 'error' | 'warning' }

export type NormalizedRowResult = {
  draft: NormalizedVehicleDraft
  issues: RowIssue[]
}

/**
 * Normalize a single workbook row given a header -> field mapping.
 */
export function normalizeImportRow(
  row: Record<string, unknown>,
  mapping: Record<string, string>,
): NormalizedRowResult {
  const draft: Partial<NormalizedVehicleDraft> = {}
  const issues: RowIssue[] = []

  for (const [header, field] of Object.entries(mapping)) {
    if (!field) continue
    const raw = row[header]
    if (raw === undefined || raw === null || String(raw).trim() === '') continue

    switch (field) {
      case 'condition':
        draft.condition = normalizeImportedCondition(raw)
        break
      case 'year':
        draft.year = normalizeImportedYear(raw)
        break
      case 'mileage':
        draft.mileage = normalizeImportedMileage(raw)
        break
      case 'brand':
        draft.brand = normalizeImportedBrand(raw)
        break
      case 'exteriorColor':
        draft.exteriorColor = normalizeImportedColor(raw)
        break
      case 'interiorColor':
        draft.interiorColor = normalizeImportedColor(raw)
        break
      case 'sourceDealerName':
        draft.sourceDealerName = normalizeImportedDealership(raw)
        break
      case 'motorType':
        draft.motorType = String(raw).trim()
        draft.fuel = normalizeImportedFuel(raw)
        break
      case 'segment':
        draft.segment = String(raw).trim()
        draft.bodyType = normalizeImportedBody(raw)
        break
      case 'sourceId':
        draft.sourceId = String(raw).trim()
        draft.stockId = String(raw).trim()
        break
      default:
        ;(draft as Record<string, unknown>)[field] = String(raw).trim()
    }
  }

  if (!draft.condition) draft.condition = 'new'
  if (!draft.brand) issues.push({ field: 'brand', message: 'Falta la marca', severity: 'error' })
  if (!draft.model) issues.push({ field: 'model', message: 'Falta el modelo', severity: 'error' })
  if (!draft.year) issues.push({ field: 'year', message: 'Falta o es inválido el año', severity: 'warning' })
  if (!draft.sourceDealerName) {
    issues.push({ field: 'dealership', message: 'Falta la agencia de origen', severity: 'warning' })
  }

  return { draft: draft as NormalizedVehicleDraft, issues }
}

/**
 * Suggest a CMS field for an arbitrary header (used by the mapping UI).
 */
export function suggestFieldForHeader(header: string): string {
  const exact = WORKBOOK_COLUMN_MAP[header.trim().toUpperCase()]
  if (exact) return exact

  const normalized = normalizeText(header).replace(/[^a-z0-9]/g, '')
  const guesses: Array<[string, string]> = [
    ['marca', 'brand'],
    ['brand', 'brand'],
    ['modelo', 'model'],
    ['model', 'model'],
    ['anio', 'year'],
    ['ano', 'year'],
    ['year', 'year'],
    ['km', 'mileage'],
    ['kilometraje', 'mileage'],
    ['mileage', 'mileage'],
    ['colorinterior', 'interiorColor'],
    ['color', 'exteriorColor'],
    ['familia', 'modelFamily'],
    ['segmento', 'segment'],
    ['tipomotor', 'motorType'],
    ['tipovehiculo', 'vehicleType'],
    ['concesionario', 'sourceDealerName'],
    ['idv', 'sourceId'],
    ['tipo', 'condition'],
    ['precio', 'price'],
    ['price', 'price'],
  ]
  for (const [token, field] of guesses) {
    if (normalized.includes(token)) return field
  }
  return ''
}

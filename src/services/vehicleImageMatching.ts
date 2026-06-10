export type VehicleImageIdentity = {
  brand?: string | null
  model?: string | null
  year?: number | string | null
  trim?: string | null
  exteriorColor?: string | null
}

function normalizePart(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function normalizeVehicleModel(brand?: string | null, model?: string | null): string {
  const rawModel = String(model ?? '').trim()
  const rawBrand = String(brand ?? '').trim()
  if (rawBrand && rawModel.toLowerCase().startsWith(`${rawBrand.toLowerCase()} `)) {
    return rawModel.slice(rawBrand.length).trim()
  }
  return rawModel
}

export function buildVehicleImageMatchKey(identity: VehicleImageIdentity): string {
  const parts = [
    identity.brand,
    normalizeVehicleModel(identity.brand, identity.model),
    identity.year,
    identity.trim,
    identity.exteriorColor,
  ].map(normalizePart)

  return parts.filter(Boolean).join('|')
}

export function hasUsableVehicleImageIdentity(identity: VehicleImageIdentity): boolean {
  return Boolean(normalizePart(identity.brand) && normalizePart(normalizeVehicleModel(identity.brand, identity.model)))
}

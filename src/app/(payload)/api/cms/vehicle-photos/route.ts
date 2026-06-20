import { NextResponse } from 'next/server'
import config from '@payload-config'
import { getPayload } from 'payload'
import type { PayloadRequest } from 'payload'

import { hasRole } from '../../../../../access/roles'
import {
  buildVehicleImageMatchKey,
  hasUsableVehicleImageIdentity,
  normalizeVehicleModel,
  type VehicleImageIdentity,
} from '../../../../../services/vehicleImageMatching'

/**
 * Vehicle photo sourcing service (CarsXE Vehicle Images API).
 *
 * Two responsibilities, kept on the server so the API key never reaches the
 * browser:
 *
 *   GET  ?action=search  — look up stock photos for a vehicle by
 *        make/model/year/color. Results are cache-first (see SEARCH_CACHE) so we
 *        don't burn CarsXE credits re-querying the same car on a free plan. The
 *        UI only calls this on an explicit "Buscar" click, never automatically.
 *
 *   POST { action: 'import' } — download a chosen candidate, store it in Media,
 *        and record a vehicle-media-asset (sourceType: 'api_candidate',
 *        approvalStatus: 'needs_review', rightsStatus: 'unknown'). That asset is
 *        the persistent local "copy" — once saved we never need to re-search,
 *        and it can be fed to the AI workshop as a reference.
 *
 * CarsXE's `license` filter does not reliably filter on the free plan, so every
 * candidate is treated as rights-unknown and must be human-approved.
 */

const CARSXE_API_KEY = process.env.CARSXE_API_KEY || ''
const CARSXE_HOST = process.env.CARSXE_IMAGES_HOST || 'api.carsxe.com'
const CARSXE_URL = `https://${CARSXE_HOST}/images`

// Credit-saving in-memory cache. Keyed by the normalized query; survives for the
// life of the server process. Persistent copies live in vehicle-media-assets.
const SEARCH_CACHE = new Map<string, { at: number; candidates: Candidate[] }>()
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const MIN_WIDTH = 500
const MAX_CANDIDATES = 16
const MAX_IMPORT_BYTES = 12 * 1024 * 1024 // 12 MB
const PROBE_TIMEOUT_MS = 6000
const DOWNLOAD_TIMEOUT_MS = 12000
const KNOWN_VEHICLE_MAKES = [
  'acura',
  'alfa-romeo',
  'audi',
  'bmw',
  'buick',
  'cadillac',
  'chevrolet',
  'chrysler',
  'dodge',
  'fiat',
  'ford',
  'genesis',
  'gmc',
  'honda',
  'hyundai',
  'infiniti',
  'jaguar',
  'jeep',
  'kia',
  'land-rover',
  'lexus',
  'lincoln',
  'mazda',
  'mercedes-benz',
  'mini',
  'mitsubishi',
  'nissan',
  'porsche',
  'ram',
  'subaru',
  'tesla',
  'toyota',
  'volkswagen',
  'volvo',
] as const

// Many source CDNs hang or 403 on non-browser clients, so we present as a real
// browser when downloading candidate images.
const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'image/avif,image/webp,image/png,image/svg+xml,image/*,*/*;q=0.8',
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Quick reachability check so we never show a candidate we can't actually
 * download. Source hosts that connect-timeout, 403, or return an HTML soft-404
 * are dropped. We request a single byte and discard the body to stay cheap.
 */
async function isReachable(url: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(
      url,
      { method: 'GET', headers: { ...BROWSER_HEADERS, Range: 'bytes=0-0' }, cache: 'no-store' },
      PROBE_TIMEOUT_MS,
    )
    res.body?.cancel().catch(() => {})
    if (!(res.ok || res.status === 206)) return false
    const contentType = (res.headers.get('content-type') || '').toLowerCase()
    if (contentType.startsWith('text/')) return false
    return true
  } catch {
    return false
  }
}

const MEDIA_ROLES = ['admin', 'media_editor', 'inventory_manager', 'content_editor'] as const

type Candidate = {
  link: string
  thumbnail: string
  contextLink: string
  width: number
  height: number
  mime: string
}

type LocalMatch = {
  id: number | string
  title?: string
  sourceType?: string
  approvalStatus?: string
  matchConfidence?: string
  vehicle?: number | string | Record<string, unknown> | null
  media?: number | string | { id?: number | string; url?: string; thumbnailURL?: string; alt?: string } | null
}

type RawImage = {
  link?: string
  thumbnailLink?: string
  contextLink?: string
  width?: number
  height?: number
  mime?: string
}

function str(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function extFromMime(mime: string): string {
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  if (mime.includes('gif')) return 'gif'
  return 'jpg'
}

function identityFromParts(make: string, model: string, year: string, trim: string, color: string): VehicleImageIdentity {
  return {
    brand: make,
    model: normalizeVehicleModel(make, model),
    year,
    trim,
    exteriorColor: color,
  }
}

function normalizeModel(brand: string, model: string): string {
  return normalizeVehicleModel(brand, model)
}

function cacheKey(make: string, model: string, year: string, color: string): string {
  return buildVehicleImageMatchKey(identityFromParts(make, model, year, '', color))
}

function normalizeSearchToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function candidateLooksRelevant(candidate: Candidate, make: string): boolean {
  const requestedMake = normalizeSearchToken(make)
  if (!requestedMake) return true
  const haystack = normalizeSearchToken([candidate.link, candidate.thumbnail, candidate.contextLink].join(' '))
  if (!haystack) return true
  return !KNOWN_VEHICLE_MAKES.some((knownMake) => knownMake !== requestedMake && haystack.includes(knownMake))
}

async function getVehicleIdentity(
  payload: Awaited<ReturnType<typeof getPayload>>,
  vehicleId: string,
): Promise<Partial<VehicleImageIdentity>> {
  if (!vehicleId) return {}
  const vehicle = (await payload
    .findByID({ collection: 'vehicles', id: vehicleId, depth: 0 })
    .catch(() => null)) as Record<string, unknown> | null
  if (!vehicle) return {}
  return {
    brand: str(vehicle.brand),
    model: str(vehicle.model),
    year: str(vehicle.year),
    trim: str(vehicle.trim),
    exteriorColor: str(vehicle.exteriorColor),
  }
}

async function findLocalMatches(
  payload: Awaited<ReturnType<typeof getPayload>>,
  matchKey: string,
): Promise<LocalMatch[]> {
  if (!matchKey) return []
  const result = await payload.find({
    collection: 'vehicle-media-assets',
    depth: 1,
    limit: 20,
    sort: '-updatedAt',
    where: { matchKey: { equals: matchKey } },
  })
  return (result.docs || []) as LocalMatch[]
}

async function readPersistentCache(
  payload: Awaited<ReturnType<typeof getPayload>>,
  matchKey: string,
): Promise<{ id: number | string; candidates: Candidate[] } | null> {
  if (!matchKey) return null
  const result = await payload.find({
    collection: 'vehicle-image-searches',
    depth: 0,
    limit: 1,
    where: {
      and: [
        { provider: { equals: 'carsxe' } },
        { matchKey: { equals: matchKey } },
        { expiresAt: { greater_than: new Date().toISOString() } },
      ],
    },
  })
  const doc = result.docs[0] as { id: number | string; candidates?: Candidate[] } | undefined
  if (!doc) return null
  return { id: doc.id, candidates: Array.isArray(doc.candidates) ? doc.candidates : [] }
}

async function writePersistentCache(
  payload: Awaited<ReturnType<typeof getPayload>>,
  reqContext: Partial<PayloadRequest>,
  matchKey: string,
  query: Record<string, string>,
  candidates: Candidate[],
  lastError = '',
): Promise<void> {
  if (!matchKey) return
  const existing = await payload.find({
    collection: 'vehicle-image-searches',
    depth: 0,
    limit: 1,
    where: { and: [{ provider: { equals: 'carsxe' } }, { matchKey: { equals: matchKey } }] },
  })
  const data = {
    provider: 'carsxe',
    matchKey,
    query,
    candidates,
    fetchedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
    lastError,
  }
  const doc = existing.docs[0] as { id: number | string } | undefined
  if (doc) {
    await payload.update({
      collection: 'vehicle-image-searches',
      id: doc.id,
      data: data as never,
      overrideAccess: true,
      req: reqContext,
    })
    return
  }
  await payload.create({
    collection: 'vehicle-image-searches',
    data: data as never,
    overrideAccess: true,
    req: reqContext,
  })
}

async function searchCarsXE(
  make: string,
  model: string,
  year: string,
  color: string,
): Promise<Candidate[]> {
  const params = new URLSearchParams({ key: CARSXE_API_KEY, make, model, format: 'json' })
  if (year) params.set('year', year)
  if (color) params.set('color', color)

  const response = await fetch(`${CARSXE_URL}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error(`CarsXE respondió ${response.status}`)
  }
  const data = (await response.json()) as { success?: boolean; error?: string; images?: RawImage[] }
  if (data.success === false && data.error) {
    throw new Error(data.error)
  }

  const seen = new Set<string>()
  const candidates: Candidate[] = []
  for (const img of data.images || []) {
    const link = str(img.link)
    if (!link || seen.has(link)) continue
    const width = Number(img.width) || 0
    const height = Number(img.height) || 0
    // Skip obvious banner crops / tiny thumbnails when dimensions are known.
    if (width && width < MIN_WIDTH) continue
    seen.add(link)
    candidates.push({
      link,
      thumbnail: str(img.thumbnailLink) || link,
      contextLink: str(img.contextLink),
      width,
      height,
      mime: str(img.mime) || 'image/jpeg',
    })
    if (candidates.length >= MAX_CANDIDATES) break
  }
  return candidates
}

async function _legacyGET(request: Request) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') || 'search'
  if (action !== 'search') {
    return NextResponse.json({ error: 'Acción no soportada.' }, { status: 400 })
  }

  if (!CARSXE_API_KEY) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        error: 'Búsqueda de fotos no configurada. Define CARSXE_API_KEY en el servidor.',
      },
      { status: 501 },
    )
  }

  const payload = await getPayload({ config })
  const authResult = await payload.auth({ canSetHeaders: false, headers: request.headers })
  if (!authResult.user) {
    return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 })
  }
  if (!hasRole(authResult.user, ...MEDIA_ROLES)) {
    return NextResponse.json({ error: 'Sin permisos para buscar fotos.' }, { status: 403 })
  }

  let make = str(searchParams.get('make'))
  let model = str(searchParams.get('model'))
  let year = str(searchParams.get('year'))
  let color = str(searchParams.get('color'))
  const vehicleId = str(searchParams.get('vehicleId'))
  const force = searchParams.get('force') === '1'

  // Fill any missing fields from the vehicle record.
  if (vehicleId && (!make || !model)) {
    const vehicle = (await payload
      .findByID({ collection: 'vehicles', id: vehicleId, depth: 0 })
      .catch(() => null)) as Record<string, unknown> | null
    if (vehicle) {
      make = make || str(vehicle.brand)
      model = model || str(vehicle.model)
      year = year || str(vehicle.year)
      color = color || str(vehicle.exteriorColor)
    }
  }

  make = make.trim()
  model = normalizeModel(make, model)
  year = year.trim()
  color = color.trim()

  if (!make || !model) {
    return NextResponse.json({ error: 'Se requieren al menos marca y modelo.' }, { status: 400 })
  }

  const key = cacheKey(make, model, year, color)
  const cached = SEARCH_CACHE.get(key)
  if (!force && cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json({
      ok: true,
      cached: true,
      query: { make, model, year, color },
      candidates: cached.candidates,
    })
  }

  try {
    const found = await searchCarsXE(make, model, year, color)
    // Drop candidates whose source host is unreachable/blocked so the grid only
    // shows images that can actually be imported. Cached afterwards.
    const reachability = await Promise.all(found.map((c) => isReachable(c.link)))
    const candidates = found.filter((candidate, i) => reachability[i] && candidateLooksRelevant(candidate, make))
    SEARCH_CACHE.set(key, { at: Date.now(), candidates })
    return NextResponse.json({ ok: true, cached: false, query: { make, model, year, color }, candidates })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al buscar fotos.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') || 'search'
  if (action !== 'search') {
    return NextResponse.json({ error: 'Accion no soportada.' }, { status: 400 })
  }

  const payload = await getPayload({ config })
  const authResult = await payload.auth({ canSetHeaders: false, headers: request.headers })
  if (!authResult.user) {
    return NextResponse.json({ error: 'Sesion invalida.' }, { status: 401 })
  }
  if (!hasRole(authResult.user, ...MEDIA_ROLES)) {
    return NextResponse.json({ error: 'Sin permisos para buscar fotos.' }, { status: 403 })
  }

  let make = str(searchParams.get('make'))
  let model = str(searchParams.get('model'))
  let year = str(searchParams.get('year'))
  let trim = str(searchParams.get('trim'))
  let color = str(searchParams.get('color'))
  const vehicleId = str(searchParams.get('vehicleId'))
  const force = searchParams.get('force') === '1'

  if (vehicleId && (!make || !model || !year || !trim || !color)) {
    const vehicle = await getVehicleIdentity(payload, vehicleId)
    make = make || str(vehicle.brand)
    model = model || str(vehicle.model)
    year = year || str(vehicle.year)
    trim = trim || str(vehicle.trim)
    color = color || str(vehicle.exteriorColor)
  }

  make = make.trim()
  model = normalizeVehicleModel(make, model)
  year = year.trim()
  trim = trim.trim()
  color = color.trim()

  if (!make || !model) {
    return NextResponse.json({ error: 'Se requieren al menos marca y modelo.' }, { status: 400 })
  }

  const identity = identityFromParts(make, model, year, trim, color)
  const matchKey = buildVehicleImageMatchKey(identity)
  const query = { make, model, year, trim, color }
  const localMatches = await findLocalMatches(payload, matchKey)

  if (!force && localMatches.length > 0) {
    return NextResponse.json({
      ok: true,
      cached: true,
      cacheSource: 'local',
      matchKey,
      query,
      localMatches,
      candidates: [],
    })
  }

  const memoryCache = SEARCH_CACHE.get(matchKey)
  if (!force && memoryCache && Date.now() - memoryCache.at < CACHE_TTL_MS) {
    return NextResponse.json({
      ok: true,
      cached: true,
      cacheSource: 'memory',
      matchKey,
      query,
      localMatches,
      candidates: memoryCache.candidates,
    })
  }

  if (!force) {
    const persistent = await readPersistentCache(payload, matchKey)
    if (persistent) {
      SEARCH_CACHE.set(matchKey, { at: Date.now(), candidates: persistent.candidates })
      return NextResponse.json({
        ok: true,
        cached: true,
        cacheSource: 'persistent',
        matchKey,
        query,
        localMatches,
        candidates: persistent.candidates,
      })
    }
  }

  if (!CARSXE_API_KEY) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        matchKey,
        query,
        localMatches,
        error: 'Busqueda de fotos no configurada. Define CARSXE_API_KEY en el servidor.',
      },
      { status: 501 },
    )
  }

  const reqContext = { user: authResult.user }

  try {
    const found = await searchCarsXE(make, model, year, color)
    const reachability = await Promise.all(found.map((c) => isReachable(c.link)))
    const candidates = found.filter((candidate, i) => reachability[i] && candidateLooksRelevant(candidate, make))
    SEARCH_CACHE.set(matchKey, { at: Date.now(), candidates })
    await writePersistentCache(payload, reqContext, matchKey, query, candidates)
    return NextResponse.json({
      ok: true,
      cached: false,
      cacheSource: 'provider',
      matchKey,
      query,
      localMatches,
      candidates,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al buscar fotos.'
    await writePersistentCache(payload, reqContext, matchKey, query, [], message).catch(() => {})
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

type ImportBody = {
  action?: string
  vehicleId?: number | string
  url?: string
  contextLink?: string
  color?: string
  make?: string
  model?: string
  year?: string
  trim?: string
  matchConfidence?: string
  alt?: string
  fileName?: string
  sourceProvider?: string
  sourceType?: string
  approvalStatus?: string
  rightsStatus?: string
}

export async function POST(request: Request) {
  let body: ImportBody
  try {
    body = (await request.json()) as ImportBody
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }

  if ((body.action || 'import') !== 'import') {
    return NextResponse.json({ error: 'Acción no soportada.' }, { status: 400 })
  }

  const url = str(body.url)
  if (!url) {
    return NextResponse.json({ error: 'Falta la URL de la imagen.' }, { status: 400 })
  }

  const payload = await getPayload({ config })
  const authResult = await payload.auth({ canSetHeaders: false, headers: request.headers })
  if (!authResult.user) {
    return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 })
  }
  if (!hasRole(authResult.user, ...MEDIA_ROLES)) {
    return NextResponse.json({ error: 'Sin permisos para guardar fotos.' }, { status: 403 })
  }

  const reqContext = { user: authResult.user }
  const vehicleIdentity = await getVehicleIdentity(payload, str(body.vehicleId))
  const make = str(body.make) || str(vehicleIdentity.brand)
  const model = normalizeVehicleModel(make, str(body.model) || str(vehicleIdentity.model))
  const year = str(body.year) || str(vehicleIdentity.year)
  const trim = str(body.trim) || str(vehicleIdentity.trim)
  const color = str(body.color) || str(vehicleIdentity.exteriorColor)
  const identity = identityFromParts(make, model, year, trim, color)
  const matchKey = hasUsableVehicleImageIdentity(identity) ? buildVehicleImageMatchKey(identity) : ''

  // Download the candidate so we host it ourselves (third-party URLs rot and
  // their rights are unknown — we keep our own approved copy).
  let buffer: Buffer
  let mime: string
  try {
    const res = await fetchWithTimeout(url, { headers: BROWSER_HEADERS, cache: 'no-store' }, DOWNLOAD_TIMEOUT_MS)
    if (!res.ok) throw new Error(`La fuente respondió ${res.status}`)
    const contentType = (res.headers.get('content-type') || '').split(';')[0].trim()
    mime = contentType.startsWith('image/') ? contentType : 'image/jpeg'
    const arrayBuffer = await res.arrayBuffer()
    if (arrayBuffer.byteLength > MAX_IMPORT_BYTES) {
      throw new Error('La imagen excede el tamaño máximo permitido (12 MB).')
    }
    if (arrayBuffer.byteLength === 0) {
      throw new Error('La fuente no devolvió ninguna imagen.')
    }
    buffer = Buffer.from(arrayBuffer)
  } catch (error) {
    const isAbort = error instanceof Error && error.name === 'AbortError'
    const message = isAbort
      ? 'El sitio de origen no respondió a tiempo. Intenta con otra imagen.'
      : 'No se pudo descargar la imagen de la fuente (no responde o bloquea el acceso). Intenta con otra imagen.'
    return NextResponse.json({ error: message }, { status: 502 })
  }

  const alt = str(body.alt) || 'Foto de vehículo'
  const requestedFileName = str(body.fileName).replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '')
  const fileName = requestedFileName || `vehicle-photo-${Date.now()}.${extFromMime(mime)}`
  const sourceProvider = str(body.sourceProvider) || 'carsxe'
  const sourceType = str(body.sourceType) || 'api_candidate'
  const approvalStatus = str(body.approvalStatus) || 'needs_review'
  const rightsStatus = str(body.rightsStatus) || 'unknown'

  try {
    const media = await payload.create({
      collection: 'media',
      data: { alt },
      file: { data: buffer, mimetype: mime, name: fileName, size: buffer.length },
      overrideAccess: true,
      req: reqContext,
    })

    const asset = await payload.create({
      collection: 'vehicle-media-assets',
      data: {
        title: alt,
        vehicle: body.vehicleId ?? undefined,
        media: media.id,
        sourceType,
        sourceProvider,
        sourceUrl: str(body.contextLink) || url,
        matchKey,
        make,
        model,
        year: year ? Number(year) : undefined,
        trim,
        exteriorColor: color,
        approvalStatus,
        rightsStatus,
        matchConfidence: (str(body.matchConfidence) || (color ? 'same_model_color' : 'same_model')) as never,
        exteriorColorMatched: Boolean(color),
      } as never,
      overrideAccess: true,
      req: reqContext,
    })

    return NextResponse.json({
      ok: true,
      assetId: asset.id,
      mediaId: media.id,
      mediaUrl: (media as { url?: string }).url,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo guardar la imagen.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

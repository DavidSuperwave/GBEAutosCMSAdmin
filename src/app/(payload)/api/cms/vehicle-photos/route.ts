import { NextResponse } from 'next/server'
import type { Payload, PayloadRequest } from 'payload'
import { lookup } from 'node:dns/promises'
import net from 'node:net'

import type { Role } from '../../../../../access/roles'
import { requireCmsRole } from '../../../../../services/cmsRequestAuth'
import { relationId } from '../../../../../services/relations'
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
const MAX_IMPORT_REDIRECTS = 5
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
  Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8',
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

const MEDIA_ROLES: Role[] = ['general']

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

function isPrivateIPv4(address: string): boolean {
  const parts = address.split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true
  }
  const [a, b] = parts
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  )
}

function isPrivateIPv6(address: string): boolean {
  const normalized = address.toLowerCase()
  return (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:')
  )
}

function isPrivateAddress(address: string): boolean {
  const family = net.isIP(address)
  if (family === 4) return isPrivateIPv4(address)
  if (family === 6) return isPrivateIPv6(address)
  return true
}

function isAllowedImageMime(mime: string) {
  const normalized = mime.toLowerCase()
  return normalized.startsWith('image/') && normalized !== 'image/svg+xml' && !normalized.includes('svg')
}

async function assertImportUrlAllowed(rawUrl: string): Promise<URL> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('La URL de la imagen no es valida.')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Solo se permiten imagenes http/https.')
  }

  const hostname = parsed.hostname.toLowerCase()
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('La fuente de imagen no esta permitida.')
  }

  const addresses = net.isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true })
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('La fuente de imagen no esta permitida.')
  }
  return parsed
}

async function readResponseBufferCapped(res: Response, maxBytes: number): Promise<Buffer> {
  const length = Number(res.headers.get('content-length') || 0)
  if (Number.isFinite(length) && length > maxBytes) {
    throw new Error('La imagen excede el tamaño máximo permitido (12 MB).')
  }

  if (!res.body) {
    const arrayBuffer = await res.arrayBuffer()
    if (arrayBuffer.byteLength > maxBytes) {
      throw new Error('La imagen excede el tamaño máximo permitido (12 MB).')
    }
    if (arrayBuffer.byteLength === 0) {
      throw new Error('La fuente no devolvió ninguna imagen.')
    }
    return Buffer.from(arrayBuffer)
  }

  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel().catch(() => {})
      throw new Error('La imagen excede el tamaño máximo permitido (12 MB).')
    }
    chunks.push(value)
  }

  if (total === 0) {
    throw new Error('La fuente no devolvió ninguna imagen.')
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
}

async function fetchAllowedImage(rawUrl: string): Promise<{ res: Response; finalUrl: string }> {
  let current = (await assertImportUrlAllowed(rawUrl)).toString()

  for (let redirects = 0; redirects <= MAX_IMPORT_REDIRECTS; redirects += 1) {
    const res = await fetchWithTimeout(
      current,
      { headers: BROWSER_HEADERS, cache: 'no-store', redirect: 'manual' },
      DOWNLOAD_TIMEOUT_MS,
    )

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      res.body?.cancel().catch(() => {})
      if (!location) throw new Error('La fuente redirigio sin URL valida.')
      current = (await assertImportUrlAllowed(new URL(location, current).toString())).toString()
      continue
    }

    return { res, finalUrl: current }
  }

  throw new Error('La fuente redirigio demasiadas veces.')
}

function extFromMime(mime: string): string {
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  if (mime.includes('gif')) return 'gif'
  return 'jpg'
}

async function findExistingVehicleSourceAsset(
  payload: Payload,
  vehicleId: string,
  sourceUrl: string,
): Promise<{ assetId: string | number; mediaId: string | number; mediaUrl?: string } | null> {
  if (!vehicleId || !sourceUrl) return null
  const result = await payload.find({
    collection: 'vehicle-media-assets',
    depth: 1,
    limit: 1,
    sort: '-updatedAt',
    where: {
      and: [{ vehicle: { equals: vehicleId } }, { sourceUrl: { equals: sourceUrl } }],
    },
  })
  const asset = result.docs[0] as { id?: string | number; media?: unknown } | undefined
  const mediaId = relationId(asset?.media)
  if (!asset?.id || mediaId == null) return null
  const mediaUrl =
    asset.media && typeof asset.media === 'object' ? str((asset.media as { url?: unknown }).url) || undefined : undefined
  return { assetId: asset.id, mediaId, mediaUrl }
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
  payload: Payload,
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
  payload: Payload,
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
  payload: Payload,
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
  payload: Payload,
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

  const auth = await requireCmsRole(request, MEDIA_ROLES, 'Sin permisos para buscar fotos.')
  if (auth.response) return auth.response
  const { payload } = auth

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

  const auth = await requireCmsRole(request, MEDIA_ROLES, 'Sin permisos para buscar fotos.')
  if (auth.response) return auth.response
  const { payload } = auth

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

  const reqContext = { user: auth.user }

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
  if (!body.vehicleId) {
    return NextResponse.json({ error: 'Falta el vehiculo para asociar la imagen.' }, { status: 400 })
  }

  const auth = await requireCmsRole(request, MEDIA_ROLES, 'Sin permisos para guardar fotos.')
  if (auth.response) return auth.response
  const { payload } = auth

  const reqContext = { user: auth.user }
  try {
    await assertImportUrlAllowed(url)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'La fuente de imagen no esta permitida.'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const vehicleIdentity = await getVehicleIdentity(payload, str(body.vehicleId))
  const make = str(body.make) || str(vehicleIdentity.brand)
  const model = normalizeVehicleModel(make, str(body.model) || str(vehicleIdentity.model))
  const year = str(body.year) || str(vehicleIdentity.year)
  const trim = str(body.trim) || str(vehicleIdentity.trim)
  const color = str(body.color) || str(vehicleIdentity.exteriorColor)
  const identity = identityFromParts(make, model, year, trim, color)
  const matchKey = hasUsableVehicleImageIdentity(identity) ? buildVehicleImageMatchKey(identity) : ''
  const sourceUrl = str(body.contextLink) || url
  const sourceProvider = str(body.sourceProvider) || 'carsxe'
  const sourceType = str(body.sourceType) || 'api_candidate'
  // Generic remote imports are never trusted as public-ready from client input.
  const approvalStatus = 'needs_review'
  const rightsStatus = 'unknown'
  const alt = str(body.alt) || 'Foto de vehiculo'
  const requestedFileName = str(body.fileName).replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '')

  const existing = await findExistingVehicleSourceAsset(payload, str(body.vehicleId), sourceUrl)
  if (existing) {
    return NextResponse.json({
      ok: true,
      reused: true,
      assetId: existing.assetId,
      mediaId: existing.mediaId,
      mediaUrl: existing.mediaUrl,
    })
  }

  // Download the candidate so we host it ourselves (third-party URLs rot and
  // their rights are unknown — we keep our own approved copy).
  let buffer: Buffer
  let mime: string
  let downloadedSourceUrl = sourceUrl
  try {
    const { res, finalUrl } = await fetchAllowedImage(url)
    downloadedSourceUrl = finalUrl
    if (!res.ok) throw new Error(`La fuente respondió ${res.status}`)
    const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    if (!isAllowedImageMime(contentType)) {
      throw new Error('La fuente no devolvio una imagen valida.')
    }
    mime = contentType
    buffer = await readResponseBufferCapped(res, MAX_IMPORT_BYTES)
  } catch (error) {
    const isAbort = error instanceof Error && error.name === 'AbortError'
    const message = isAbort
      ? 'El sitio de origen no respondió a tiempo. Intenta con otra imagen.'
      : 'No se pudo descargar la imagen de la fuente (no responde o bloquea el acceso). Intenta con otra imagen.'
    return NextResponse.json({ error: message }, { status: 502 })
  }

  const fileName = requestedFileName || `vehicle-photo-${Date.now()}.${extFromMime(mime)}`

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
        sourceUrl: downloadedSourceUrl,
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

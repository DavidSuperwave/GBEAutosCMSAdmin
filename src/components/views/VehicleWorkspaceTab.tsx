'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'

import SectionBuilder, { type BuilderPreviewContext, type Section } from '../admin-ui/SectionBuilder'
import VehicleImageStudio from './VehicleImageStudio'
import VehicleSpecsLookup, { type AppliedVehicleSpecs } from './VehicleSpecsLookup'
import { VEHICLE_SECTION_LIBRARY } from '../admin-ui/sectionLibraries'
import {
  clearVehicleQueue,
  readVehicleQueue,
  vehicleWorkspacePath,
  writeVehicleQueue,
  type VehicleQueue,
} from '../admin-ui/vehicleQueue'
import {
  ActionButton,
  AdminPageShell,
  AdminTabs,
  CompletionChecklist,
  ConfirmDialog,
  EmptyState,
  PrimaryActionBar,
  StatusBadge,
  VehicleSummaryCard,
  type ChecklistItem,
} from '../admin-ui/kit'
import {
  IMAGE_STATUS_LABELS,
  PUBLISH_STATUS_LABELS,
  SPEC_STATUS_LABELS,
  SPEC_KEYS,
  calculateVehicleCompleteness,
  countFilledSpecs,
  getVehiclePublishIssues,
  type ImageStatus,
  type PublishStatus,
  type SpecStatus,
  type VehicleLike,
} from '../../services/vehicleWorkflow'

type MediaRef =
  | { id?: string | number; url?: string; thumbnailURL?: string; alt?: string }
  | string
  | number
  | null
  | undefined

type RelationRef = { id?: string | number; name?: string; displayName?: string; city?: string } | string | number | null

type VehicleTag = {
  id: string | number
  name?: string
  label?: string
  slug?: string
  type?: string
  isVisible?: boolean
}

type Dealership = {
  id: string | number
  brandName?: string
  displayName?: string
  city?: string
  isActive?: boolean
}

type Vehicle = Omit<VehicleLike, 'gallery' | 'dealership'> & {
  id: string | number
  image?: MediaRef
  gallery?: Array<{ image?: MediaRef; alt?: string | null }> | null
  dealership?: RelationRef
  tags?: Array<VehicleTag | string | number> | null
  features?: Array<{ feature?: string | null }> | null
  createdAt?: string
  updatedAt?: string
  publishedAt?: string | null
  lastReviewedAt?: string | null
  sourceDealerName?: string | null
  imageUrl?: string | null
  imagePath?: string | null
  imageFilename?: string | null
  interiorColor?: string | null
  trim?: string | null
  bodyType?: string | null
  transmission?: string | null
  fuel?: string | null
  specs?: Record<string, unknown> | null
  landing?: Section[] | null
  sourceMeta?: {
    specSource?: string | null
    externalMakeId?: string | null
    externalModelId?: string | null
    externalGenerationId?: string | null
    externalTrimId?: string | null
    lastSpecSyncAt?: string | null
  } | null
  templateOverrides?: VehicleTemplateOverrides | null
}

type TemplateOverride = 'inherit' | 'show' | 'hide'

type VehicleTemplateOverrides = {
  gallery?: TemplateOverride | null
  purchaseCard?: TemplateOverride | null
  quickSpecs?: TemplateOverride | null
  description?: TemplateOverride | null
  features?: TemplateOverride | null
  similarVehicles?: TemplateOverride | null
  mobileCta?: TemplateOverride | null
}

type VehicleDraft = {
  price: string
  condition: string
  inventoryStatus: string
  dealership: string
  city: string
  description: string
  mileage: string
  exteriorColor: string
  interiorColor: string
  bodyType: string
  transmission: string
  fuel: string
  specs: Record<string, string>
  sourceMeta?: AppliedVehicleSpecs['sourceMeta']
  features: string[]
}

type VehicleAnalytics = {
  views: number
  clicks: number
  leads: number
  conversionRate: number
  lastView?: string
  lastLead?: string
}

const SPEC_LABELS: Record<string, string> = {
  tipo: 'Tipo / carrocería',
  motor: 'Motor',
  potencia: 'Potencia',
  transmision: 'Transmisión',
  combustible: 'Combustible',
  traccion: 'Tracción',
  cylinders: 'Cilindros',
  seats: 'Asientos',
  doors: 'Puertas',
  lengthMm: 'Largo (mm)',
  widthMm: 'Ancho (mm)',
  heightMm: 'Alto (mm)',
  wheelbaseMm: 'Distancia entre ejes (mm)',
  maxTrunkCapacityL: 'Capacidad cajuela (L)',
  torqueNm: 'Torque (Nm)',
  fuelTankCapacityL: 'Tanque combustible (L)',
}

const INVENTORY_STATUS_LABELS: Record<string, string> = {
  available: 'Disponible',
  reserved: 'Apartado',
  sold: 'Vendido',
}

/** Grouped presentation of SPEC_KEYS so the form reads in sections. */
const SPEC_GROUPS: Array<{ title: string; keys: string[] }> = [
  {
    title: 'Motor y desempeño',
    keys: ['motor', 'potencia', 'torqueNm', 'cylinders', 'transmision', 'combustible', 'traccion'],
  },
  { title: 'Carrocería', keys: ['tipo', 'seats', 'doors'] },
  { title: 'Dimensiones', keys: ['lengthMm', 'widthMm', 'heightMm', 'wheelbaseMm'] },
  { title: 'Capacidades', keys: ['maxTrunkCapacityL', 'fuelTankCapacityL'] },
]

const BODY_TYPE_OPTIONS = [
  ['', 'Sin definir'],
  ['sedan', 'Sedán'],
  ['suv', 'SUV'],
  ['pickup', 'Pickup'],
  ['coupe', 'Coupe'],
  ['hatchback', 'Hatchback'],
  ['van', 'Van'],
  ['other', 'Otro'],
] as const

const TRANSMISSION_OPTIONS = [
  ['', 'Sin definir'],
  ['automatic', 'Automática'],
  ['manual', 'Manual'],
  ['cvt', 'CVT'],
] as const

const FUEL_OPTIONS = [
  ['', 'Sin definir'],
  ['gasoline', 'Gasolina'],
  ['diesel', 'Diesel'],
  ['hybrid', 'Híbrido'],
  ['electric', 'Eléctrico'],
] as const

const TABS = [
  { key: 'overview', label: 'Resumen' },
  { key: 'specs', label: 'Detalles y etiquetas' },
  { key: 'images', label: 'Imágenes' },
  { key: 'listing', label: 'Página' },
  { key: 'review', label: 'Revisar y publicar' },
] as const

const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000'

const TEMPLATE_OVERRIDE_FIELDS: Array<{ key: keyof VehicleTemplateOverrides; label: string }> = [
  { key: 'gallery', label: 'Galería principal' },
  { key: 'purchaseCard', label: 'Tarjeta de contacto' },
  { key: 'quickSpecs', label: 'Resumen de specs' },
  { key: 'description', label: 'Descripción' },
  { key: 'features', label: 'Características' },
  { key: 'similarVehicles', label: 'Autos similares' },
  { key: 'mobileCta', label: 'CTA móvil WhatsApp' },
]

type TabKey = (typeof TABS)[number]['key']

function mediaUrl(media: MediaRef): string | undefined {
  if (!media || typeof media === 'string' || typeof media === 'number') return undefined
  return media.thumbnailURL || media.url
}

function vehicleImageUrl(vehicle: Vehicle): string | undefined {
  return mediaUrl(vehicle.image) || undefined
}

function displayedImageStatus(vehicle: Vehicle): ImageStatus {
  return (vehicle.imageStatus as ImageStatus) || 'missing'
}

function text(value: unknown): string {
  return String(value ?? '').trim()
}

function relationDoc(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function relationId(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: string | number }).id
    return id === undefined ? '' : String(id)
  }
  return ''
}

function mediaPreviewPayload(
  value: unknown,
  mediaOptions: BuilderPreviewContext['mediaOptions'],
): { url: string; alt?: string } | undefined {
  if (value && typeof value === 'object') {
    const media = value as { alt?: string | null; filename?: string | null; thumbnailURL?: string | null; url?: string | null }
    const url = media.url || media.thumbnailURL
    if (url) return { url, alt: text(media.alt || media.filename) || undefined }
  }

  const id = relationId(value)
  if (!id) return undefined
  const option = mediaOptions.find((item) => String(item.id) === id)
  const url = option?.url || option?.thumbnailURL
  return url ? { url, alt: option?.label } : undefined
}

function featureText(value: unknown): string {
  if (typeof value === 'string') return text(value)
  return text(relationDoc(value).feature)
}

function sanitizeVehicleSections(sections: Section[]): Section[] {
  return sections.map((section) => {
    const next: Section = { ...section }

    if (section.blockType === 'gallery' && Array.isArray(section.images)) {
      next.images = section.images.filter((item) => relationId(relationDoc(item).image))
    }

    if (section.blockType === 'highlightList' && Array.isArray(section.items)) {
      next.items = section.items.filter((item) => text(relationDoc(item).label))
    }

    if (section.blockType === 'featureGrid' && Array.isArray(section.items)) {
      next.items = section.items.filter((item) => featureText(item))
    }

    return next
  })
}

function landingSectionsForPreview(
  sections: Section[],
  context: BuilderPreviewContext,
): Section[] {
  return sections
    .filter((_, index) => !context.hiddenIndexes.has(index))
    .map((section) => {
      if (section.blockType === 'imageText') {
        return {
          ...section,
          image: mediaPreviewPayload(section.image, context.mediaOptions),
        }
      }

      if (section.blockType === 'gallery') {
        return {
          ...section,
          images: Array.isArray(section.images)
            ? section.images
                .map((item) => {
                  const itemRecord = relationDoc(item)
                  const image = mediaPreviewPayload(itemRecord.image, context.mediaOptions)
                  return image ? { image, alt: text(itemRecord.alt) || image.alt } : null
                })
                .filter(Boolean)
            : [],
        }
      }

      if (section.blockType === 'highlightList') {
        return {
          ...section,
          items: Array.isArray(section.items)
            ? section.items
                .map((item) => {
                  const itemRecord = relationDoc(item)
                  return {
                    label: text(itemRecord.label),
                    description: text(itemRecord.description),
                  }
                })
                .filter((item) => item.label)
            : [],
        }
      }

      if (section.blockType === 'featureGrid') {
        return {
          ...section,
          items: Array.isArray(section.items)
            ? section.items.map(featureText).filter(Boolean)
            : [],
        }
      }

      return section
    })
}

function buildVehicleLivePreviewPayload(
  vehicle: Vehicle,
  sections: Section[],
  context: BuilderPreviewContext,
  templateOverrides: VehicleTemplateOverrides,
) {
  const image = mediaPreviewPayload(vehicle.image, context.mediaOptions)
  const gallery = Array.isArray(vehicle.gallery)
    ? vehicle.gallery
        .map((item) => {
          const galleryImage = mediaPreviewPayload(item.image, context.mediaOptions)
          return galleryImage ? { image: galleryImage, alt: text(item.alt) || galleryImage.alt } : null
        })
        .filter(Boolean)
    : []
  const dealership =
    vehicle.dealership && typeof vehicle.dealership === 'object'
      ? vehicle.dealership
      : vehicle.sourceDealerName
        ? {
            displayName: vehicle.sourceDealerName,
            brandName: vehicle.sourceDealerName,
            city: dealershipCity(vehicle),
          }
        : undefined

  return {
    ...vehicle,
    id: vehicle.id,
    uuid: vehicle.id,
    image,
    gallery,
    dealership,
    city: dealershipCity(vehicle),
    features: Array.isArray(vehicle.features) ? vehicle.features.map(featureText).filter(Boolean) : [],
    landing: landingSectionsForPreview(sections, context),
    templateOverrides,
  }
}

function payloadRelationshipId(value: string): string | number {
  return /^\d+$/.test(value) ? Number(value) : value
}

function tagLabel(tag: VehicleTag): string {
  return tag.label || tag.name || tag.slug || String(tag.id)
}

function formatDate(value?: string | null): string {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return value
  }
}

function dealershipName(vehicle: Vehicle): string {
  if (vehicle.dealership && typeof vehicle.dealership === 'object') {
    return vehicle.dealership.displayName || vehicle.dealership.name || 'Agencia asignada'
  }
  return vehicle.dealership ? 'Agencia asignada' : ''
}

function dealershipCity(vehicle: Vehicle): string {
  if (vehicle.city) return vehicle.city
  if (vehicle.dealership && typeof vehicle.dealership === 'object') return vehicle.dealership.city || ''
  return ''
}

function createDraft(vehicle: Vehicle): VehicleDraft {
  return {
    price: vehicle.price || '',
    condition: vehicle.condition || 'new',
    inventoryStatus: vehicle.inventoryStatus || 'available',
    dealership: relationId(vehicle.dealership),
    city: dealershipCity(vehicle),
    description: vehicle.description || '',
    mileage: vehicle.mileage == null ? '' : String(vehicle.mileage),
    exteriorColor: vehicle.exteriorColor || '',
    interiorColor: vehicle.interiorColor || '',
    bodyType: vehicle.bodyType || '',
    transmission: vehicle.transmission || '',
    fuel: vehicle.fuel || '',
    specs: SPEC_KEYS.reduce<Record<string, string>>((draft, key) => {
      draft[key] = vehicle.specs?.[key] ? String(vehicle.specs[key]) : ''
      return draft
    }, {}),
    features: (Array.isArray(vehicle.features) ? vehicle.features : [])
      .map((item) =>
        item && typeof item === 'object' && 'feature' in item
          ? String((item as { feature?: string | null }).feature || '')
          : '',
      )
      .filter(Boolean),
    sourceMeta:
      vehicle.sourceMeta?.specSource === 'rapidapi'
        ? {
            specSource: 'rapidapi',
            externalMakeId: vehicle.sourceMeta.externalMakeId || undefined,
            externalModelId: vehicle.sourceMeta.externalModelId || undefined,
            externalGenerationId: vehicle.sourceMeta.externalGenerationId || undefined,
            externalTrimId: vehicle.sourceMeta.externalTrimId || undefined,
            lastSpecSyncAt: vehicle.sourceMeta.lastSpecSyncAt || new Date().toISOString(),
          }
        : undefined,
  }
}

export default function VehicleWorkspaceTab() {
  const { id } = useDocumentInfo()
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [draft, setDraft] = useState<VehicleDraft | null>(null)
  const [tab, setTab] = useState<TabKey>('overview')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tagBusy, setTagBusy] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [dealerships, setDealerships] = useState<Dealership[]>([])
  const [tagOptions, setTagOptions] = useState<VehicleTag[]>([])
  const [templateOverrides, setTemplateOverrides] = useState<VehicleTemplateOverrides>({})
  const [templateSaving, setTemplateSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [queue, setQueue] = useState<VehicleQueue | null>(null)
  const [pendingNav, setPendingNav] = useState<(() => void) | null>(null)
  const [analytics, setAnalytics] = useState<VehicleAnalytics>({
    views: 0,
    clicks: 0,
    leads: 0,
    conversionRate: 0,
  })

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/vehicles/${id}?depth=1`, { credentials: 'include' })
      if (!res.ok) throw new Error('No se pudo cargar el vehículo.')
      const nextVehicle = (await res.json()) as Vehicle
      setVehicle(nextVehicle)
      setDraft(createDraft(nextVehicle))
      setDirty(false)
      setTemplateOverrides(nextVehicle.templateOverrides || {})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  // Triage queue: pick it up when this vehicle belongs to the active queue and
  // keep the stored index pointing at the vehicle being viewed.
  useEffect(() => {
    if (!id) return
    const activeQueue = readVehicleQueue()
    if (!activeQueue) return
    const position = activeQueue.ids.indexOf(String(id))
    if (position === -1) {
      setQueue(null)
      return
    }
    if (activeQueue.index !== position) {
      activeQueue.index = position
      writeVehicleQueue(activeQueue)
    }
    setQueue(activeQueue)
  }, [id])

  // Warn on tab close / external navigation while the form has unsaved edits.
  useEffect(() => {
    if (!dirty) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  useEffect(() => {
    let active = true
    void (async () => {
      const [dealershipsRes, tagsRes] = await Promise.all([
        fetch('/api/dealerships?depth=0&limit=300&sort=displayName', { credentials: 'include' }),
        fetch('/api/vehicle-tags?depth=0&limit=300&sort=name', { credentials: 'include' }),
      ])
      if (!active) return
      if (dealershipsRes.ok) {
        const data = (await dealershipsRes.json()) as { docs?: Dealership[] }
        setDealerships(data.docs || [])
      }
      if (tagsRes.ok) {
        const data = (await tagsRes.json()) as { docs?: VehicleTag[] }
        setTagOptions(data.docs || [])
      }
    })()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!id) return
    let active = true
    void (async () => {
      const [eventsRes, leadsRes] = await Promise.all([
        fetch(`/api/analytics-events?where[vehicle][equals]=${id}&limit=200&sort=-createdAt`, {
          credentials: 'include',
        }),
        fetch(`/api/leads?where[vehicle][equals]=${id}&limit=200&sort=-createdAt`, {
          credentials: 'include',
        }),
      ])
      if (!active) return
      const events = eventsRes.ok
        ? ((await eventsRes.json()) as { docs?: Array<{ eventType?: string; createdAt?: string }> }).docs || []
        : []
      const leads = leadsRes.ok
        ? ((await leadsRes.json()) as { docs?: Array<{ createdAt?: string }> }).docs || []
        : []
      const views = events.filter((event) => event.eventType === 'vehicle_view').length
      const clicks = events.filter(
        (event) => event.eventType === 'vehicle_click' || event.eventType === 'cta_click',
      ).length
      setAnalytics({
        views,
        clicks,
        leads: leads.length,
        conversionRate: views ? Math.round((leads.length / views) * 100) : 0,
        lastView: events.find((event) => event.eventType === 'vehicle_view')?.createdAt,
        lastLead: leads[0]?.createdAt,
      })
    })()
    return () => {
      active = false
    }
  }, [id])

  const completeness = useMemo(() => (vehicle ? calculateVehicleCompleteness(vehicle) : 0), [vehicle])
  const issues = useMemo(
    () => (vehicle ? getVehiclePublishIssues(vehicle) : { critical: [], warnings: [], issues: [] }),
    [vehicle],
  )
  const primaryImageUrl = vehicle ? vehicleImageUrl(vehicle) : undefined
  const imageStatus = vehicle ? displayedImageStatus(vehicle) : 'missing'
  // Badge counts and the publish banner derive from the same issue service the
  // server hook enforces, so the preflight can't drift from the real gate.
  const imageIssueCount = issues.issues.filter((issue) => issue.area === 'media').length
  const detailIssueCount = issues.issues.filter((issue) => issue.area !== 'media').length
  const publishBlocker = issues.critical[0] || 'hay bloqueos pendientes.'

  const selectedTagIds = useMemo(() => new Set((vehicle?.tags || []).map(relationId).filter(Boolean)), [vehicle?.tags])
  const dealershipOptions = useMemo(() => {
    const options = [...dealerships]
    if (vehicle?.dealership && typeof vehicle.dealership === 'object') {
      const currentId = relationId(vehicle.dealership)
      if (currentId && !options.some((dealership) => String(dealership.id) === currentId)) {
        options.unshift({
          id: currentId,
          displayName: vehicle.dealership.displayName || vehicle.dealership.name || 'Agencia actual',
          city: vehicle.dealership.city,
        })
      }
    }
    return options
  }, [dealerships, vehicle?.dealership])
  const cityOptions = useMemo(() => {
    const values = new Set<string>()
    dealershipOptions.forEach((dealership) => {
      if (dealership.city) values.add(dealership.city)
    })
    if (draft?.city) values.add(draft.city)
    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [dealershipOptions, draft?.city])

  const checklist = useMemo<ChecklistItem[]>(() => {
    if (!vehicle) return []
    const items: ChecklistItem[] = []
    const need = (label: string, ok: boolean, target: TabKey = 'specs') =>
      items.push({ label, status: ok ? 'ok' : 'bad', onClick: () => setTab(target) })
    need('Marca, modelo y año', Boolean(vehicle.brand && vehicle.model && vehicle.year))
    need('Condición', Boolean(vehicle.condition))
    need('Agencia y ciudad', Boolean(vehicle.dealership && dealershipCity(vehicle)))
    need('Imagen principal', Boolean(vehicleImageUrl(vehicle)), 'images')
    need('Estatus', Boolean(vehicle.inventoryStatus))
    items.push({
      label: 'Imagen aprobada',
      status: vehicle.imageStatus === 'approved' ? 'ok' : vehicleImageUrl(vehicle) ? 'warn' : 'bad',
      onClick: () => setTab('images'),
    })
    items.push({ label: 'Precio', status: vehicle.price ? 'ok' : 'warn', onClick: () => setTab('specs') })
    items.push({
      label: 'Descripción',
      status: vehicle.description && String(vehicle.description).length >= 40 ? 'ok' : 'warn',
      onClick: () => setTab('specs'),
    })
    return items
  }, [vehicle])

  const updateDraft = useCallback((patch: Partial<VehicleDraft>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current))
    setDirty(true)
  }, [])

  const setSpecValue = useCallback((key: string, value: string) => {
    setDraft((current) =>
      current ? { ...current, specs: { ...current.specs, [key]: value } } : current,
    )
    setDirty(true)
  }, [])

  const setFeatureValue = useCallback((index: number, value: string) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            features: current.features.map((feature, featureIndex) =>
              featureIndex === index ? value : feature,
            ),
          }
        : current,
    )
    setDirty(true)
  }, [])

  const applySpecs = useCallback((data: AppliedVehicleSpecs) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            bodyType: data.bodyType || current.bodyType,
            transmission: data.transmission || current.transmission,
            fuel: data.fuel || current.fuel,
            specs: { ...current.specs, ...data.specs },
            sourceMeta: data.sourceMeta,
          }
        : current,
    )
    setDirty(true)
    setNotice('Especificaciones aplicadas al borrador. Guarda los cambios para conservarlas.')
  }, [])

  const saveVehicleEdits = useCallback(async (): Promise<boolean> => {
    if (!id || !draft) return false
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const mileage = draft.mileage.trim() ? Number(draft.mileage) : null
      if (draft.mileage.trim() && !Number.isFinite(mileage)) {
        throw new Error('El kilometraje debe ser numérico.')
      }

      const res = await fetch(`/api/vehicles/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price: draft.price.trim() || null,
          condition: draft.condition,
          inventoryStatus: draft.inventoryStatus,
          dealership: draft.dealership ? payloadRelationshipId(draft.dealership) : null,
          city: draft.city.trim() || null,
          description: draft.description,
          mileage,
          exteriorColor: draft.exteriorColor.trim() || null,
          interiorColor: draft.interiorColor.trim() || null,
          bodyType: draft.bodyType || null,
          transmission: draft.transmission || null,
          fuel: draft.fuel || null,
          specs: draft.specs,
          features: draft.features.map((feature) => feature.trim()).filter(Boolean).map((feature) => ({ feature })),
          sourceMeta: draft.sourceMeta || { specSource: 'manual' },
        }),
      })
      if (!res.ok) {
        const detail = await res.text()
        throw new Error(`No se pudieron guardar los cambios. ${detail.slice(0, 160)}`)
      }
      setDirty(false)
      setNotice('Cambios guardados en el vehículo.')
      await load()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar.')
      return false
    } finally {
      setSaving(false)
    }
  }, [id, draft, load])

  const setStatus = useCallback(
    async (publishStatus: PublishStatus, opts?: { guard?: boolean }) => {
      if (!id || !vehicle) return
      if (dirty) {
        setError('Tienes cambios sin guardar. Guarda los cambios antes de cambiar el estado.')
        return
      }
      if (opts?.guard && issues.critical.length > 0) {
        setError('No se puede publicar: resuelve los problemas críticos primero.')
        setTab('review')
        return
      }
      setBusy(true)
      setError(null)
      setNotice(null)
      try {
        const res = await fetch(`/api/vehicles/${id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publishStatus }),
        })
        if (!res.ok) {
          const detail = await res.text()
          throw new Error(`No se pudo actualizar el estado. ${detail.slice(0, 160)}`)
        }
        setNotice(`Estado actualizado a "${PUBLISH_STATUS_LABELS[publishStatus]}".`)
        await load()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al actualizar.')
      } finally {
        setBusy(false)
      }
    },
    [id, vehicle, dirty, issues.critical.length, load],
  )

  // ---- Triage queue navigation --------------------------------------------

  const commitQueueNav = useCallback(
    (nextIndex: number) => {
      if (!queue) return
      const bounded = Math.min(Math.max(0, nextIndex), queue.ids.length - 1)
      writeVehicleQueue({ ...queue, index: bounded })
      window.location.href = vehicleWorkspacePath(queue.ids[bounded])
    },
    [queue],
  )

  const requestQueueNav = useCallback(
    (nextIndex: number) => {
      if (dirty) {
        setPendingNav(() => () => commitQueueNav(nextIndex))
        return
      }
      commitQueueNav(nextIndex)
    },
    [dirty, commitQueueNav],
  )

  const exitQueue = useCallback(() => {
    const returnTo = queue?.returnTo || '/admin/inventory'
    const leave = () => {
      clearVehicleQueue()
      window.location.href = returnTo
    }
    if (dirty) {
      setPendingNav(() => leave)
      return
    }
    leave()
  }, [queue, dirty])

  const saveTags = useCallback(
    async (tagIds: string[]) => {
      if (!id) return
      setTagBusy(true)
      setError(null)
      setNotice(null)
      try {
        const res = await fetch(`/api/vehicles/${id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags: tagIds.map(payloadRelationshipId) }),
        })
        if (!res.ok) {
          const detail = await res.text()
          throw new Error(`No se pudieron guardar tags. ${detail.slice(0, 160)}`)
        }
        setNotice('Tags actualizados.')
        await load()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al guardar tags.')
      } finally {
        setTagBusy(false)
      }
    },
    [id, load],
  )

  const toggleTag = useCallback(
    (tagId: string) => {
      const next = new Set(selectedTagIds)
      if (next.has(tagId)) next.delete(tagId)
      else next.add(tagId)
      void saveTags(Array.from(next))
    },
    [saveTags, selectedTagIds],
  )

  const createAndAssignTag = useCallback(async () => {
    const name = newTagName.trim()
    if (!name || !id) return
    setTagBusy(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch('/api/vehicle-tags', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, label: name, type: 'manual', isVisible: true }),
      })
      if (!res.ok) {
        const detail = await res.text()
        throw new Error(`No se pudo crear el tag. ${detail.slice(0, 160)}`)
      }
      const created = (await res.json()) as { doc?: VehicleTag }
      const createdId = created.doc?.id
      if (!createdId) throw new Error('El tag se creo sin ID.')
      const next = Array.from(new Set([...Array.from(selectedTagIds), String(createdId)]))
      await saveTags(next)
      setTagOptions((current) => [...current, created.doc as VehicleTag])
      setNewTagName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear tag.')
      setTagBusy(false)
    }
  }, [id, newTagName, saveTags, selectedTagIds])

  const loadSections = useCallback(async () => {
    if (!id) return { sections: [] as Section[] }
    const res = await fetch(`/api/vehicles/${id}?depth=0`, { credentials: 'include' })
    if (!res.ok) throw new Error('No se pudo cargar el contenido.')
    const data = (await res.json()) as { landing?: Section[] }
    return { sections: data.landing || [] }
  }, [id])

  const saveSections = useCallback(
    async (sections: Section[]) => {
      if (!id) return
      const sanitizedSections = sanitizeVehicleSections(sections)
      const res = await fetch(`/api/vehicles/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ landing: sanitizedSections }),
      })
      if (!res.ok) {
        const detail = await res.text()
        throw new Error(`No se pudo guardar. ${detail.slice(0, 160)}`)
      }
      setVehicle((current) => (current ? { ...current, landing: sanitizedSections } : current))
    },
    [id],
  )

  const saveTemplateOverrides = useCallback(async () => {
    if (!id) return
    setTemplateSaving(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch(`/api/vehicles/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateOverrides }),
      })
      if (!res.ok) {
        const detail = await res.text()
        throw new Error(`No se pudo guardar la plantilla. ${detail.slice(0, 160)}`)
      }
      setNotice('Visibilidad de plantilla actualizada.')
      setVehicle((current) => (current ? { ...current, templateOverrides } : current))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar plantilla.')
    } finally {
      setTemplateSaving(false)
    }
  }, [id, templateOverrides])

  if (!id) {
    return (
      <AdminPageShell className="workspace">
        <EmptyState
          title="Guarda el vehículo primero"
          message="El espacio de trabajo está disponible después de crear el vehículo."
        />
      </AdminPageShell>
    )
  }

  if (loading) {
    return (
      <AdminPageShell className="workspace">
        <p className="builder__muted">Cargando espacio de trabajo...</p>
      </AdminPageShell>
    )
  }

  if (!vehicle || !draft) {
    return (
      <AdminPageShell className="workspace">
        <div className="builder__error">{error || 'No se encontró el vehículo.'}</div>
      </AdminPageShell>
    )
  }

  const title = `${vehicle.brand || 'Vehiculo'} ${vehicle.model || ''} ${vehicle.year || ''}`.trim()
  const publishStatus = (vehicle.publishStatus as PublishStatus) || 'draft'
  const agencyName = dealershipName(vehicle)
  const agencyCity = dealershipCity(vehicle)
  const previewUrl = `${FRONTEND_URL}/cars/preview/${id}`
  const publicUrl = vehicle.slug ? `${FRONTEND_URL}/cars/${vehicle.slug}` : ''

  return (
    <AdminPageShell className="workspace">
      {queue ? (
        <div className="workspace__queuebar">
          <div className="workspace__queuebar-info">
            <strong>Cola: {queue.label}</strong>
            <span>
              {queue.index + 1} de {queue.ids.length}
            </span>
          </div>
          <div className="workspace__queuebar-actions">
            <ActionButton
              size="sm"
              variant="secondary"
              disabled={queue.index <= 0}
              onClick={() => requestQueueNav(queue.index - 1)}
            >
              ← Anterior
            </ActionButton>
            <ActionButton
              size="sm"
              variant="primary"
              disabled={queue.index >= queue.ids.length - 1}
              onClick={() => requestQueueNav(queue.index + 1)}
            >
              Siguiente →
            </ActionButton>
            <ActionButton size="sm" variant="ghost" onClick={exitQueue}>
              Salir de la cola
            </ActionButton>
          </div>
        </div>
      ) : null}

      <PrimaryActionBar className="workspace__actionbar">
        <div className="workspace__actionbar-info">
          <strong>{title}</strong>
          <StatusBadge
            tone={
              publishStatus === 'published'
                ? 'success'
                : publishStatus === 'needs_review'
                  ? 'warning'
                  : 'neutral'
            }
          >
            {PUBLISH_STATUS_LABELS[publishStatus]}
          </StatusBadge>
          {dirty ? <StatusBadge tone="warning">Cambios sin guardar</StatusBadge> : null}
          <span className="workspace__completeness">
            <span className="workspace__completeness-bar">
              <span style={{ width: `${completeness}%` }} />
            </span>
            {completeness}% completo
          </span>
        </div>
        <div className="workspace__actionbar-buttons">
          <ActionButton
            variant={dirty ? 'primary' : 'secondary'}
            disabled={saving}
            onClick={() => void saveVehicleEdits()}
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </ActionButton>
          <ActionButton variant="secondary" disabled={busy} onClick={() => void setStatus('draft')}>
            Marcar como borrador
          </ActionButton>
          <ActionButton variant="secondary" disabled={busy} onClick={() => void setStatus('needs_review')}>
            Enviar a revisión
          </ActionButton>
          <ActionButton
            variant={dirty ? 'secondary' : 'primary'}
            disabled={busy || issues.critical.length > 0}
            title={issues.critical.length > 0 ? `Bloqueado: ${issues.critical.join(' ')}` : undefined}
            onClick={() => void setStatus('published', { guard: true })}
          >
            Publicar
          </ActionButton>
        </div>
      </PrimaryActionBar>

      <ConfirmDialog
        open={pendingNav !== null}
        title="Tienes cambios sin guardar"
        message="Guarda los cambios de este vehículo antes de continuar, o sigue editando."
        confirmLabel="Guardar y continuar"
        cancelLabel="Seguir editando"
        busy={saving}
        onCancel={() => setPendingNav(null)}
        onConfirm={() => {
          void (async () => {
            const saved = await saveVehicleEdits()
            if (saved && pendingNav) pendingNav()
            setPendingNav(null)
          })()
        }}
      />

      {issues.critical.length > 0 ? (
        <div className="workspace__publish-blocker">
          No se puede publicar: {publishBlocker}
        </div>
      ) : null}

      {error ? <div className="builder__error">{error}</div> : null}
      {notice ? <div className="workspace__notice">{notice}</div> : null}

      <AdminTabs
        active={tab}
        ariaLabel="Pestanas del espacio de trabajo"
        className="workspace__tabs"
        items={TABS.map((t) => ({
          key: t.key,
          label: t.label,
          badge:
            t.key === 'images' && imageIssueCount > 0
              ? imageIssueCount
              : t.key === 'specs' && detailIssueCount > 0
                ? detailIssueCount
                : t.key === 'review' && issues.critical.length > 0
                  ? issues.critical.length
                  : undefined,
          badgeTone: 'danger',
        }))}
        onChange={setTab}
      />

      <div className="workspace__body">
        {tab === 'overview' ? (
          <div className="workspace__grid">
            <div>
              <VehicleSummaryCard
                imageUrl={primaryImageUrl}
                title={title}
                subtitle={`${vehicle.condition === 'used' ? 'Seminuevo' : 'Nuevo'} - ${
                  agencyCity || 'Sin ciudad'
                }`}
                badge={<StatusBadge tone="info">{vehicle.price || 'Precio a consultar'}</StatusBadge>}
              />
              <dl className="workspace__facts">
                <div>
                  <dt>Agencia</dt>
                  <dd>{agencyName || vehicle.sourceDealerName || '-'}</dd>
                </div>
                <div>
                  <dt>Ciudad</dt>
                  <dd>{agencyCity || '-'}</dd>
                </div>
                <div>
                  <dt>Estatus</dt>
                  <dd>{INVENTORY_STATUS_LABELS[vehicle.inventoryStatus || ''] || '-'}</dd>
                </div>
                <div>
                  <dt>Kilometraje</dt>
                  <dd>{vehicle.mileage ? `${vehicle.mileage} km` : '-'}</dd>
                </div>
                <div>
                  <dt>Slug</dt>
                  <dd>{vehicle.slug || '-'}</dd>
                </div>
                <div>
                  <dt>Actualizado</dt>
                  <dd>{formatDate(vehicle.updatedAt)}</dd>
                </div>
                <div>
                  <dt>Imagen sync</dt>
                  <dd>
                    {vehicle.imageUrl ? (
                      <a href={vehicle.imageUrl} rel="noreferrer" target="_blank">
                        {vehicle.imageFilename || vehicle.imagePath || 'Abrir imagen'}
                      </a>
                    ) : (
                      '-'
                    )}
                  </dd>
                </div>
              </dl>
              <div className="workspace__section-head">
                <h3>Demanda del vehículo</h3>
                <StatusBadge tone={analytics.leads ? 'success' : 'neutral'}>
                  {analytics.conversionRate}% conversion
                </StatusBadge>
              </div>
              <dl className="workspace__facts workspace__facts--analytics">
                <div>
                  <dt>Vistas</dt>
                  <dd>{analytics.views}</dd>
                </div>
                <div>
                  <dt>Clics</dt>
                  <dd>{analytics.clicks}</dd>
                </div>
                <div>
                  <dt>Leads WhatsApp</dt>
                  <dd>{analytics.leads}</dd>
                </div>
                <div>
                  <dt>Ultima vista</dt>
                  <dd>{formatDate(analytics.lastView)}</dd>
                </div>
                <div>
                  <dt>Ultimo lead</dt>
                  <dd>{formatDate(analytics.lastLead)}</dd>
                </div>
              </dl>
            </div>
            <div>
              <h3>Lista de completitud</h3>
              <CompletionChecklist items={checklist} />
              <p className="builder__muted">{vehicle.description || 'Sin descripcion.'}</p>
            </div>
          </div>
        ) : null}

        {tab === 'specs' ? (
          <div className="workspace__edit-stack">
            <div className="workspace__section-head">
              <h3>Detalles principales</h3>
              <StatusBadge tone="info">{SPEC_STATUS_LABELS[(vehicle.specStatus as SpecStatus) || 'missing']}</StatusBadge>
            </div>

            <div className="workspace__form-grid">
              <label className="builder__field">
                <span>Precio</span>
                <input
                  value={draft.price}
                  onChange={(event) => updateDraft({ price: event.target.value })}
                  placeholder="398900 or 599000 - 798500"
                />
              </label>
              <label className="builder__field">
                <span>Condición</span>
                <select value={draft.condition} onChange={(event) => updateDraft({ condition: event.target.value })}>
                  <option value="new">Nuevo</option>
                  <option value="used">Seminuevo</option>
                </select>
              </label>
              <label className="builder__field">
                <span>Estatus</span>
                <select
                  value={draft.inventoryStatus}
                  onChange={(event) => updateDraft({ inventoryStatus: event.target.value })}
                >
                  <option value="available">Disponible</option>
                  <option value="reserved">Apartado</option>
                  <option value="sold">Vendido</option>
                </select>
              </label>
              <label className="builder__field">
                <span>Agencia</span>
                <select
                  value={draft.dealership}
                  onChange={(event) => {
                    const dealership = dealershipOptions.find((item) => String(item.id) === event.target.value)
                    updateDraft({
                      dealership: event.target.value,
                      city: dealership?.city || draft.city,
                    })
                  }}
                >
                  <option value="">Sin agencia</option>
                  {dealershipOptions.map((dealership) => (
                    <option key={dealership.id} value={String(dealership.id)}>
                      {dealership.displayName || dealership.brandName || dealership.id}
                      {dealership.city ? ` - ${dealership.city}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="builder__field">
                <span>Ciudad</span>
                <input
                  list="workspace-city-options"
                  value={draft.city}
                  onChange={(event) => updateDraft({ city: event.target.value })}
                />
                <datalist id="workspace-city-options">
                  {cityOptions.map((city) => (
                    <option key={city} value={city} />
                  ))}
                </datalist>
              </label>
              <label className="builder__field">
                <span>Kilometraje</span>
                <input value={draft.mileage} onChange={(event) => updateDraft({ mileage: event.target.value })} />
              </label>
              <label className="builder__field">
                <span>Color exterior</span>
                <input
                  value={draft.exteriorColor}
                  onChange={(event) => updateDraft({ exteriorColor: event.target.value })}
                />
              </label>
              <label className="builder__field">
                <span>Color interior</span>
                <input
                  value={draft.interiorColor}
                  onChange={(event) => updateDraft({ interiorColor: event.target.value })}
                />
              </label>
              <label className="builder__field workspace__field-wide">
                <span>Descripción</span>
                <textarea
                  rows={4}
                  value={draft.description}
                  onChange={(event) => updateDraft({ description: event.target.value })}
                />
              </label>
            </div>

            <VehicleSpecsLookup
              defaultMake={vehicle.brand || ''}
              defaultModel={vehicle.model || ''}
              defaultYear={vehicle.year == null ? '' : String(vehicle.year)}
              onApply={applySpecs}
            />

            <div className="workspace__section-head">
              <h3>Especificaciones comerciales</h3>
            </div>
            <div className="workspace__form-grid">
              <label className="builder__field">
                <span>Tipo de carrocería</span>
                <select value={draft.bodyType} onChange={(event) => updateDraft({ bodyType: event.target.value })}>
                  {BODY_TYPE_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="builder__field">
                <span>Transmisión comercial</span>
                <select
                  value={draft.transmission}
                  onChange={(event) => updateDraft({ transmission: event.target.value })}
                >
                  {TRANSMISSION_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="builder__field">
                <span>Combustible comercial</span>
                <select value={draft.fuel} onChange={(event) => updateDraft({ fuel: event.target.value })}>
                  {FUEL_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="workspace__section-head">
              <h3>Especificaciones técnicas</h3>
              <StatusBadge tone="info" title="Con 4 o más especificaciones completas, las specs dejan de bloquear la publicación.">
                {countFilledSpecs({ specs: draft.specs })}/4 para publicar
              </StatusBadge>
            </div>
            {SPEC_GROUPS.map((group) => (
              <React.Fragment key={group.title}>
                <h4 className="workspace__spec-group">{group.title}</h4>
                <div className="workspace__form-grid">
                  {group.keys.map((key) => (
                    <label key={key} className="builder__field">
                      <span>{SPEC_LABELS[key] || key}</span>
                      <input value={draft.specs[key] || ''} onChange={(event) => setSpecValue(key, event.target.value)} />
                    </label>
                  ))}
                </div>
              </React.Fragment>
            ))}

            <div className="workspace__section-head">
              <h3>Características</h3>
              <ActionButton
                variant="secondary"
                onClick={() => updateDraft({ features: [...draft.features, ''] })}
              >
                Agregar característica
              </ActionButton>
            </div>
            <div className="workspace__feature-list">
              {draft.features.length === 0 ? <p className="builder__muted">Sin características.</p> : null}
              {draft.features.map((feature, index) => (
                <div className="workspace__feature-row" key={`${index}-${feature}`}>
                  <input value={feature} onChange={(event) => setFeatureValue(index, event.target.value)} />
                  <button
                    type="button"
                    onClick={() =>
                      updateDraft({ features: draft.features.filter((_, featureIndex) => featureIndex !== index) })
                    }
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </div>

            <div className="workspace__section-head">
              <h3>Tags de catálogo</h3>
              <StatusBadge tone="neutral">{selectedTagIds.size}</StatusBadge>
            </div>
            <div className="workspace__tag-tools">
              <input
                value={newTagName}
                onChange={(event) => setNewTagName(event.target.value)}
                placeholder="Nuevo tag reutilizable"
              />
              <ActionButton variant="secondary" disabled={tagBusy || !newTagName.trim()} onClick={() => void createAndAssignTag()}>
                Crear y asignar
              </ActionButton>
            </div>
            <div className="workspace__tag-picker">
              {tagOptions.length === 0 ? <p className="builder__muted">No hay tags reutilizables todavia.</p> : null}
              {tagOptions.map((tag) => {
                const tagId = String(tag.id)
                const selected = selectedTagIds.has(tagId)
                return (
                  <button
                    className={`workspace__tag-chip${selected ? ' workspace__tag-chip--active' : ''}`}
                    disabled={tagBusy}
                    key={tag.id}
                    onClick={() => toggleTag(tagId)}
                    type="button"
                  >
                    {tagLabel(tag)}
                  </button>
                )
              })}
            </div>

            <div className="workspace__form-actions">
              <ActionButton
                variant={dirty ? 'primary' : 'secondary'}
                disabled={saving}
                onClick={() => void saveVehicleEdits()}
              >
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </ActionButton>
            </div>
          </div>
        ) : null}

        {tab === 'images' ? (
          <div>
            <div className="workspace__section-head">
              <h3>Imágenes</h3>
              <StatusBadge
                tone={
                  imageStatus === 'approved'
                    ? 'success'
                    : imageStatus === 'missing'
                      ? 'danger'
                      : 'warning'
                }
              >
                {IMAGE_STATUS_LABELS[imageStatus]}
              </StatusBadge>
            </div>
            <VehicleImageStudio vehicle={vehicle} onChanged={() => void load()} />
          </div>
        ) : null}

        {tab === 'listing' ? (
          <SectionBuilder
            title="Página del vehículo"
            subtitle="Controla la plantilla fija y agrega secciones personalizadas bajo la ficha del vehículo."
            previewUrl={previewUrl}
            library={VEHICLE_SECTION_LIBRARY}
            load={loadSections}
            save={saveSections}
            autoSave
            saveLabel="Guardar borrador"
            savedLabel="Borrador guardado"
            settingsLabel="Plantilla"
            previewCollectionSlug="vehicles"
            previewOrigin={new URL(previewUrl).origin}
            previewActions={
              <>
                <a className="builder__preview-link" href={previewUrl} rel="noreferrer" target="_blank">
                  Abrir vista previa
                </a>
                {publicUrl ? (
                  <a className="builder__preview-link" href={publicUrl} rel="noreferrer" target="_blank">
                    Abrir página pública
                  </a>
                ) : null}
              </>
            }
            previewPayload={(sections, context) => (
              buildVehicleLivePreviewPayload(vehicle, sections, context, templateOverrides)
            )}
            settingsPanel={
              <TemplateOverridesPanel
                value={templateOverrides}
                saving={templateSaving}
                onChange={setTemplateOverrides}
                onSave={() => void saveTemplateOverrides()}
              />
            }
          />
        ) : null}

        {tab === 'review' ? (
          <div className="workspace__review">
            <div>
              <h3>Problemas criticos</h3>
              {issues.critical.length === 0 ? (
                <p className="workspace__ok">OK. Sin bloqueos. Este vehículo se puede publicar.</p>
              ) : (
                <ul className="workspace__issues workspace__issues--critical">
                  {issues.critical.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3>Advertencias</h3>
              {issues.warnings.length === 0 ? (
                <p className="builder__muted">Sin advertencias.</p>
              ) : (
                <ul className="workspace__issues workspace__issues--warning">
                  {issues.warnings.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              )}
            </div>
            <ActionButton
              variant="primary"
              disabled={busy || issues.critical.length > 0}
              onClick={() => void setStatus('published', { guard: true })}
            >
              Publicar vehículo
            </ActionButton>
          </div>
        ) : null}
      </div>
    </AdminPageShell>
  )
}

function TemplateOverridesPanel({
  value,
  saving,
  onChange,
  onSave,
}: {
  value: VehicleTemplateOverrides
  saving: boolean
  onChange: (next: VehicleTemplateOverrides) => void
  onSave: () => void
}) {
  return (
    <div className="template-overrides">
      {TEMPLATE_OVERRIDE_FIELDS.map((field) => (
        <label className="builder__field" key={field.key}>
          <span>{field.label}</span>
          <select
            value={value[field.key] || 'inherit'}
            onChange={(event) =>
              onChange({
                ...value,
                [field.key]: event.target.value as TemplateOverride,
              })
            }
          >
            <option value="inherit">Usar global</option>
            <option value="show">Mostrar</option>
            <option value="hide">Ocultar</option>
          </select>
        </label>
      ))}
      <ActionButton variant="secondary" disabled={saving} onClick={onSave}>
        {saving ? 'Guardando...' : 'Guardar plantilla'}
      </ActionButton>
    </div>
  )
}

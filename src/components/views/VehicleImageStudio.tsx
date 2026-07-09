'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@payloadcms/ui'

import { ActionButton, EmptyState, StatusBadge } from '../admin-ui/kit'
import { isMediaReviewer } from '../../access/roles'
import { isPublishableRights } from '../../services/vehicleMediaPolicy'
import { buildVehicleImageMatchKey } from '../../services/vehicleImageMatching'
import VehicleAIImageWizard from './VehicleAIImageWizard'

/**
 * In-vehicle image studio (Taller de IA), rendered inside the vehicle
 * workspace "Imágenes" tab. Two ways to add imagery:
 *   1. Subir imagen  — upload a file (stored in Media + tracked as a
 *      vehicle-media-asset) and set it as hero or add it to the gallery.
 *   2. Crear con IA   — a guided wizard: pick a type/preset or a saved
 *      template, optionally attach a reference/template image, write a prompt,
 *      and generate. Generation is stubbed until AI_IMAGE_API_KEY is set (the
 *      endpoint returns 501 and we show a clear banner), but everything else
 *      works: outputs can be reviewed and saved as the primary/gallery image.
 *
 * Every image touched here is tracked per-vehicle in `vehicle-media-assets`,
 * so prior uploads/generations stay available as reusable references.
 */

type MediaRef =
  | { id?: number | string; url?: string; thumbnailURL?: string; alt?: string }
  | number
  | string
  | null
  | undefined

type VehicleLite = {
  id: number | string
  brand?: string | null
  model?: string | null
  year?: number | null
  trim?: string | null
  exteriorColor?: string | null
  image?: MediaRef
  imageUrl?: string | null
  imagePath?: string | null
  imageFilename?: string | null
  gallery?: Array<{ image?: MediaRef; alt?: string | null }> | null
}

type Asset = {
  id: number | string
  title?: string
  sourceType?: string
  sourceUrl?: string
  sourceProvider?: string
  approvalStatus?: string
  rightsStatus?: string
  usage?: string
  matchKey?: string
  matchConfidence?: string
  make?: string
  model?: string
  year?: number
  trim?: string
  exteriorColor?: string
  vehicle?: number | string | Record<string, unknown> | null
  media?: MediaRef
}

type Template = {
  id: number | string
  name?: string
  preset?: string
  prompt?: string
  referenceImage?: MediaRef
}

type Candidate = {
  link: string
  thumbnail: string
  contextLink: string
  width: number
  height: number
  mime: string
}

type PreviewImage = {
  id: number | string
  url: string
  label: string
  index?: number
}

type GalleryPreviewImage = PreviewImage & {
  index: number
}

type CropTarget = PreviewImage & {
  source?: string
}

type GalleryItem = NonNullable<VehicleLite['gallery']>[number]

type GalleryPatchItem = {
  image: number | string
  alt?: string | null
}

/** Strip a leading brand from the model ("Mazda CX-50" -> "CX-50"). */
function normalizeModel(brand: string, model: string): string {
  const m = (model || '').trim()
  const b = (brand || '').trim()
  if (b && m.toLowerCase().startsWith(`${b.toLowerCase()} `)) return m.slice(b.length).trim()
  return m
}

const KNOWN_VEHICLE_MAKES = [
  'acura',
  'alfa romeo',
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
  'land rover',
  'lexus',
  'lincoln',
  'mazda',
  'mercedes benz',
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
]

function mediaId(ref: MediaRef): number | string | undefined {
  if (ref == null) return undefined
  if (typeof ref === 'object') return ref.id
  return ref
}

function mediaUrl(ref: MediaRef): string | undefined {
  if (ref && typeof ref === 'object') return ref.thumbnailURL || ref.url
  return undefined
}

function galleryPatchItems(items: GalleryItem[]): GalleryPatchItem[] {
  const patchItems: GalleryPatchItem[] = []
  items.forEach((item) => {
    const image = mediaId(item.image)
    if (image == null) return
    const nextItem: GalleryPatchItem = { image }
    if (item.alt != null) nextItem.alt = item.alt
    patchItems.push(nextItem)
  })
  return patchItems
}

function sourceIdentity(value?: string | null): string {
  return normalizeToken(value || '')
}

function isGalleryPreviewImage(item: GalleryPreviewImage | null): item is GalleryPreviewImage {
  return item !== null
}

function normalizeToken(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function mentionsOtherMake(text: string, make?: string | null): boolean {
  const requested = normalizeToken(make)
  const haystack = ` ${normalizeToken(text)} `
  if (!requested || !haystack.trim()) return false
  return KNOWN_VEHICLE_MAKES.some((knownMake) => knownMake !== requested && haystack.includes(` ${knownMake} `))
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  uploaded: 'Foto subida',
  dealer_photo: 'Foto de agencia',
  api_candidate: 'Candidata buscada',
  ai_generated: 'Generada con IA',
  ai_edited: 'Editada',
  representative: 'Representativa',
}

const APPROVAL_STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  needs_review: 'Pendiente de revisión',
  approved: 'Aprobada',
  rejected: 'Rechazada',
}

const RIGHTS_STATUS_LABELS: Record<string, string> = {
  owned: 'Derechos propios',
  licensed: 'Con licencia',
  unknown: 'Derechos por revisar',
}

/** Mirrors the matchConfidence select options in VehicleMediaAssets. */
const MATCH_CONFIDENCE_LABELS: Record<string, string> = {
  exact_vehicle: 'Vehículo exacto',
  same_trim_color: 'Mismo trim y color',
  same_model_color: 'Mismo modelo y color',
  same_model: 'Mismo modelo',
  representative: 'Representativa',
  generated: 'Generada',
  unknown: 'Por revisar',
}

function matchConfidenceLabel(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback
  return MATCH_CONFIDENCE_LABELS[value] || fallback
}

const USAGE_LABELS: Record<string, string> = {
  vehicle_hero: 'Principal',
  vehicle_gallery: 'Galería',
  homepage: 'Homepage',
  landing_page: 'Landing',
  promo_banner: 'Promo',
  social_ad: 'Anuncio',
  reference: 'Referencia',
}

const AI_IMAGE_WIZARD_ENABLED = process.env.NEXT_PUBLIC_ENABLE_AI_IMAGE_WIZARD === 'true'

function canAssignPublicAsset(asset: Asset): boolean {
  return asset.approvalStatus === 'approved' && isPublishableRights(asset.rightsStatus)
}

function needsReviewAsset(asset: Asset): boolean {
  return asset.approvalStatus !== 'rejected' && !canAssignPublicAsset(asset)
}

function assetIsHero(asset: Asset, heroId?: number | string): boolean {
  const id = mediaId(asset.media)
  return id != null && heroId != null && String(id) === String(heroId)
}

function assetIsInGallery(asset: Asset, galleryIds: Set<string>): boolean {
  const id = mediaId(asset.media)
  return id != null && galleryIds.has(String(id))
}

function assetPublicationLabel(asset: Asset, heroId: number | string | undefined, galleryIds: Set<string>): string {
  if (asset.approvalStatus === 'rejected') return 'Rechazada'
  if (assetIsHero(asset, heroId)) return 'Principal'
  if (assetIsInGallery(asset, galleryIds)) return 'Publicada en galería'
  if (canAssignPublicAsset(asset)) return 'Aprobada - sin publicar'
  return 'En revisión'
}

function assetPublicationTone(
  asset: Asset,
  heroId: number | string | undefined,
  galleryIds: Set<string>,
): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (asset.approvalStatus === 'rejected') return 'danger'
  if (assetIsHero(asset, heroId) || assetIsInGallery(asset, galleryIds)) return 'success'
  if (canAssignPublicAsset(asset)) return 'warning'
  return 'info'
}

function intendedTarget(asset: Asset): 'hero' | 'gallery' | undefined {
  if (asset.usage === 'vehicle_hero') return 'hero'
  if (asset.usage === 'vehicle_gallery') return 'gallery'
  return undefined
}

function assetSourceLabel(asset: Asset): string {
  return SOURCE_TYPE_LABELS[asset.sourceType || ''] || asset.sourceType || 'Imagen'
}

function assetApprovalLabel(asset: Asset): string {
  return APPROVAL_STATUS_LABELS[asset.approvalStatus || 'draft'] || asset.approvalStatus || 'Borrador'
}

function assetRightsLabel(asset: Asset): string {
  return RIGHTS_STATUS_LABELS[asset.rightsStatus || 'unknown'] || asset.rightsStatus || 'Derechos por revisar'
}

export default function VehicleImageStudio({
  vehicle,
  onChanged,
}: {
  vehicle: VehicleLite
  onChanged: () => void
}) {
  const vehicleId = vehicle.id
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [assets, setAssets] = useState<Asset[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [aiWizardOpen, setAiWizardOpen] = useState(false)
  const [uploadTarget, setUploadTarget] = useState<'hero' | 'gallery'>('hero')
  const [confirmDealerRights, setConfirmDealerRights] = useState(false)

  // Photo search (CarsXE) state
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchMake, setSearchMake] = useState(vehicle.brand || '')
  const [searchModel, setSearchModel] = useState(normalizeModel(vehicle.brand || '', vehicle.model || ''))
  const [searchYear, setSearchYear] = useState(vehicle.year ? String(vehicle.year) : '')
  const [searchColor, setSearchColor] = useState(vehicle.exteriorColor || '')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [localMatches, setLocalMatches] = useState<Asset[]>([])
  const [searchCached, setSearchCached] = useState(false)
  const [cacheSource, setCacheSource] = useState('')
  const [searchedOnce, setSearchedOnce] = useState(false)
  const [searchUnavailable, setSearchUnavailable] = useState(false)
  const [importingUrl, setImportingUrl] = useState<string | null>(null)
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null)
  const [galleryItems, setGalleryItems] = useState(() => vehicle.gallery || [])
  const [cropTarget, setCropTarget] = useState<CropTarget | null>(null)
  const [draggedGalleryIndex, setDraggedGalleryIndex] = useState<number | null>(null)
  const [dragOverGalleryIndex, setDragOverGalleryIndex] = useState<number | null>(null)
  const [openGalleryMenu, setOpenGalleryMenu] = useState<string | null>(null)
  const [dismissedApprovedAssetIds, setDismissedApprovedAssetIds] = useState<Set<string>>(() => new Set())

  const { user: authUser } = useAuth()
  const canReviewMedia = useMemo(
    () => isMediaReviewer(authUser as Parameters<typeof isMediaReviewer>[0]),
    [authUser],
  )

  useEffect(() => {
    setGalleryItems(vehicle.gallery || [])
  }, [vehicle.gallery])

  const vehicleMatchKey = useMemo(
    () =>
      buildVehicleImageMatchKey({
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        trim: vehicle.trim,
        exteriorColor: vehicle.exteriorColor,
      }),
    [vehicle.brand, vehicle.model, vehicle.year, vehicle.trim, vehicle.exteriorColor],
  )

  const visibleAssets = useMemo(
    () => {
      const seen = new Set<string>()
      return assets.filter((asset) => {
        if (asset.matchKey && asset.matchKey !== vehicleMatchKey) return false
        if (asset.make && normalizeToken(asset.make) !== normalizeToken(vehicle.brand)) return false
        if (mentionsOtherMake([asset.title, asset.make, asset.model].filter(Boolean).join(' '), vehicle.brand)) {
          return false
        }

        const id = mediaId(asset.media)
        const key = sourceIdentity(asset.sourceUrl) || (id == null ? '' : `media:${id}`)
        if (!key) return true
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    },
    [assets, vehicle.brand, vehicleMatchKey],
  )

  const loadAssets = useCallback(async () => {
    const res = await fetch(
      `/api/vehicle-media-assets?where[vehicle][equals]=${vehicleId}&depth=1&limit=50&sort=-updatedAt`,
      { credentials: 'include' },
    )
    if (res.ok) setAssets(((await res.json()) as { docs?: Asset[] }).docs || [])
  }, [vehicleId])

  const loadTemplates = useCallback(async () => {
    const res = await fetch('/api/image-templates?depth=1&limit=50&sort=-updatedAt', { credentials: 'include' })
    if (res.ok) setTemplates(((await res.json()) as { docs?: Template[] }).docs || [])
  }, [])

  useEffect(() => {
    void loadAssets()
    void loadTemplates()
  }, [loadAssets, loadTemplates])

  // ---- Media helpers -----------------------------------------------------
  const uploadMedia = useCallback(async (file: File): Promise<{ id: number | string; url?: string }> => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('_payload', JSON.stringify({ alt: file.name }))
    const res = await fetch('/api/media', { method: 'POST', credentials: 'include', body: fd })
    if (!res.ok) throw new Error((await res.text()).slice(0, 160))
    const data = (await res.json()) as { doc?: { id: number | string; url?: string } }
    if (!data.doc?.id) throw new Error('No se pudo subir el archivo.')
    return { id: data.doc.id, url: data.doc.url }
  }, [])

  const recordAsset = useCallback(
    async (media: number | string, sourceType: string, usage?: string, extra?: Record<string, unknown>) => {
      const res = await fetch('/api/vehicle-media-assets', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${vehicle.brand || ''} ${vehicle.model || ''}`.trim() || 'Imagen',
          vehicle: vehicleId,
          media,
          sourceType,
          usage,
          matchKey: vehicleMatchKey,
          make: vehicle.brand,
          model: normalizeModel(vehicle.brand || '', vehicle.model || ''),
          year: vehicle.year,
          trim: vehicle.trim,
          exteriorColor: vehicle.exteriorColor,
          ...extra,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { doc?: { id?: number | string }; message?: string; error?: string }
      if (!res.ok || data.doc?.id == null) {
        throw new Error(data.error || data.message || 'No se pudo registrar la imagen del vehiculo.')
      }
      return data.doc.id
    },
    [vehicleId, vehicle.brand, vehicle.model, vehicle.year, vehicle.trim, vehicle.exteriorColor, vehicleMatchKey],
  )

  const assignAsset = useCallback(
    async (assetId: number | string, target: 'hero' | 'gallery') => {
      const res = await fetch('/api/cms/vehicle-media-assets/assign', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleId, assetId, target }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'No se pudo asignar la imagen aprobada.')
    },
    [vehicleId],
  )

  const reviewAsset = useCallback(
    async (
      assetId: number | string,
      decision: 'approve_owned' | 'approve_licensed' | 'reject',
      assignTo?: 'hero' | 'gallery',
    ) => {
      const res = await fetch('/api/cms/vehicle-media-assets/review', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleId, assetId, decision, assignTo }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'No se pudo revisar la imagen.')
    },
    [vehicleId],
  )

  const withBusy = useCallback(async (fn: () => Promise<void>, okMessage?: string) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await fn()
      if (okMessage) setNotice(okMessage)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }, [])

  const clearHero = useCallback(async () => {
    await withBusy(async () => {
      const res = await fetch(`/api/vehicles/${vehicleId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: null, imageStatus: 'missing' }),
      })
      if (!res.ok) throw new Error((await res.text()).slice(0, 160))
      setPreviewImage(null)
      onChanged()
    }, 'Imagen principal quitada del vehiculo.')
  }, [onChanged, vehicleId, withBusy])

  const removeFromGallery = useCallback(
    async (media: number | string) => {
      await withBusy(async () => {
        const nextItems = galleryItems.filter((g) => String(mediaId(g.image)) !== String(media))
        const gallery = galleryPatchItems(nextItems)
        const res = await fetch(`/api/vehicles/${vehicleId}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gallery }),
        })
        if (!res.ok) throw new Error((await res.text()).slice(0, 160))
        setGalleryItems(nextItems)
        if (String(previewImage?.id) === String(media)) setPreviewImage(null)
        setOpenGalleryMenu(null)
        onChanged()
      }, 'Imagen eliminada de la galería.')
    },
    [galleryItems, onChanged, previewImage?.id, vehicleId, withBusy],
  )

  const reorderGallery = useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return
      if (fromIndex >= galleryItems.length || toIndex >= galleryItems.length) return

      await withBusy(async () => {
        const nextItems = [...galleryItems]
        const [moved] = nextItems.splice(fromIndex, 1)
        nextItems.splice(toIndex, 0, moved)
        const gallery = galleryPatchItems(nextItems)
        const res = await fetch(`/api/vehicles/${vehicleId}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gallery }),
        })
        if (!res.ok) throw new Error((await res.text()).slice(0, 160))
        setGalleryItems(nextItems)
        setPreviewImage((current) => {
          if (!current) return current
          const nextIndex = nextItems.findIndex((item) => String(mediaId(item.image)) === String(current.id))
          return nextIndex >= 0 ? { ...current, label: current.label, index: nextIndex } : current
        })
        onChanged()
      }, 'Orden de galería actualizado.')
    },
    [galleryItems, onChanged, vehicleId, withBusy],
  )

  const startGalleryDrag = useCallback((event: React.DragEvent, index: number) => {
    setDraggedGalleryIndex(index)
    setDragOverGalleryIndex(index)
    setOpenGalleryMenu(null)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
  }, [])

  const clearGalleryDrag = useCallback(() => {
    setDraggedGalleryIndex(null)
    setDragOverGalleryIndex(null)
  }, [])

  // ---- Upload actions ----------------------------------------------------
  const handleUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (file) {
        await withBusy(async () => {
          if (!confirmDealerRights) {
            throw new Error('Confirma que la agencia tiene derechos para publicar esta foto.')
          }
          const media = await uploadMedia(file)
          const assetId = await recordAsset(media.id, 'dealer_photo', uploadTarget === 'hero' ? 'vehicle_hero' : 'vehicle_gallery', {
            approvalStatus: canReviewMedia ? 'approved' : 'needs_review',
            rightsStatus: canReviewMedia ? 'owned' : 'unknown',
            matchConfidence: 'exact_vehicle',
          })
          if (canReviewMedia) {
            await assignAsset(assetId, uploadTarget === 'hero' ? 'hero' : 'gallery')
          }
          await loadAssets()
          onChanged()
        }, canReviewMedia
          ? uploadTarget === 'hero'
            ? 'Foto propia publicada como imagen principal.'
            : 'Foto propia agregada a la galería pública.'
          : 'Foto subida para revisión. Un admin o editor de medios debe aprobarla antes de publicarla.')
      }
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [
      assignAsset,
      canReviewMedia,
      confirmDealerRights,
      loadAssets,
      onChanged,
      recordAsset,
      uploadMedia,
      uploadTarget,
      withBusy,
    ],
  )

  // ---- Photo search (CarsXE) --------------------------------------------
  const runSearch = useCallback(
    async (force = false) => {
      await withBusy(async () => {
        setSearchUnavailable(false)
        const params = new URLSearchParams({
          vehicleId: String(vehicleId),
          make: searchMake,
          model: searchModel,
          year: searchYear,
          trim: vehicle.trim || '',
          color: searchColor,
        })
        if (force) params.set('force', '1')
        const res = await fetch(`/api/cms/vehicle-photos?action=search&${params.toString()}`, {
          credentials: 'include',
        })
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          cached?: boolean
          cacheSource?: string
          configured?: boolean
          localMatches?: Asset[]
          candidates?: Candidate[]
          error?: string
        }
        if (res.status === 501 || data.configured === false) {
          setSearchUnavailable(true)
          setCandidates([])
          return
        }
        if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudieron buscar fotos.')
        setLocalMatches(
          (data.localMatches || []).filter(
            (asset) => !mentionsOtherMake([asset.title, asset.make, asset.model].filter(Boolean).join(' '), vehicle.brand),
          ),
        )
        setCandidates(data.candidates || [])
        setSearchCached(Boolean(data.cached))
        setCacheSource(data.cacheSource || '')
        setSearchedOnce(true)
      })
    },
    [withBusy, vehicleId, vehicle.trim, vehicle.brand, searchMake, searchModel, searchYear, searchColor],
  )

  const importCandidate = useCallback(
    async (candidate: Candidate, then?: 'hero' | 'gallery' | 'reference') => {
      setImportingUrl(candidate.link)
      setError('')
      setNotice('')
      try {
        const res = await fetch('/api/cms/vehicle-photos', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'import',
            vehicleId,
            url: candidate.link,
            contextLink: candidate.contextLink,
            make: searchMake,
            model: searchModel,
            year: searchYear,
            trim: vehicle.trim,
            color: searchColor,
            alt: `${searchMake} ${searchModel} ${searchYear}`.trim(),
          }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          assetId?: number | string
          mediaId?: number | string
          mediaUrl?: string
          error?: string
        }
        if (!res.ok || !data.ok || data.mediaId == null) {
          throw new Error(data.error || 'No se pudo guardar la imagen.')
        }
        await loadAssets()
        onChanged()
        setNotice(
          then === 'hero'
            ? 'Candidata enviada a revisión como principal.'
            : then === 'gallery'
              ? 'Candidata enviada a revisión para galería.'
              : then === 'reference'
                ? 'Imagen guardada en la biblioteca del vehículo.'
                : 'Imagen guardada en la biblioteca del vehículo.',
        )
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setImportingUrl(null)
      }
    },
    [vehicleId, vehicle.trim, searchColor, searchMake, searchModel, searchYear, loadAssets, onChanged],
  )

  const importSyncedImage = useCallback(
    async (then: 'hero' | 'gallery' = 'hero') => {
      if (!vehicle.imageUrl) return
      const existingAsset = assets.find(
        (asset) =>
          sourceIdentity(asset.sourceUrl) === sourceIdentity(vehicle.imageUrl) && mediaId(asset.media) != null,
      )
      const existingMedia = mediaId(existingAsset?.media)
      if (existingMedia != null && existingAsset?.id != null) {
        await withBusy(async () => {
          if (canAssignPublicAsset(existingAsset)) {
            await assignAsset(existingAsset.id, then)
          } else if (canReviewMedia) {
            await reviewAsset(existingAsset.id, 'approve_owned', then)
          } else {
            throw new Error('La imagen sincronizada esta pendiente de aprobacion por admin/media editor.')
          }
          await loadAssets()
          onChanged()
        }, then === 'hero' ? 'Imagen sincronizada publicada como principal.' : 'Imagen sincronizada agregada a la galería pública.')
        return
      }

      setImportingUrl(vehicle.imageUrl)
      setError('')
      setNotice('')
      try {
        const res = await fetch('/api/cms/vehicle-photos', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'import',
            vehicleId,
            url: vehicle.imageUrl,
            contextLink: vehicle.imageUrl,
            make: vehicle.brand,
            model: normalizeModel(vehicle.brand || '', vehicle.model || ''),
            year: vehicle.year ? String(vehicle.year) : '',
            trim: vehicle.trim,
            color: vehicle.exteriorColor,
            alt: vehicle.imageFilename || `${vehicle.brand || ''} ${vehicle.model || ''} ${vehicle.year || ''}`.trim(),
            fileName: vehicle.imageFilename,
            sourceProvider: 'supabase-storage',
            sourceType: 'dealer_photo',
            matchConfidence: 'exact_vehicle',
          }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          assetId?: number | string
          mediaId?: number | string
          error?: string
        }
        if (!res.ok || !data.ok || data.mediaId == null) {
          throw new Error(data.error || 'No se pudo importar la imagen sincronizada.')
        }
        if (data.assetId == null) throw new Error('No se pudo registrar la imagen sincronizada.')
        if (canReviewMedia) {
          await reviewAsset(data.assetId, 'approve_owned', then)
        }
        await loadAssets()
        onChanged()
        setNotice(
          canReviewMedia
            ? then === 'hero'
              ? 'Imagen sincronizada aprobada y publicada como principal.'
              : 'Imagen sincronizada aprobada y agregada a la galería pública.'
            : 'Imagen sincronizada importada para revisión. Un admin o editor de medios debe aprobarla antes de publicarla.',
        )
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setImportingUrl(null)
      }
    },
    [
      assignAsset,
      assets,
      canReviewMedia,
      loadAssets,
      onChanged,
      reviewAsset,
      withBusy,
      vehicle.brand,
      vehicle.exteriorColor,
      vehicle.imageFilename,
      vehicle.imageUrl,
      vehicle.model,
      vehicle.trim,
      vehicle.year,
      vehicleId,
    ],
  )

  const useLocalAsset = useCallback(
    async (asset: Asset, then: 'hero' | 'gallery' | 'reference') => {
      const id = mediaId(asset.media)
      if (id == null || asset.id == null) return
      await withBusy(async () => {
        if (then === 'hero' || then === 'gallery') {
          if (!canAssignPublicAsset(asset)) {
            throw new Error('Esta imagen todavia necesita aprobacion y derechos claros antes de publicarse.')
          }
          await assignAsset(asset.id, then)
        }
        else {
          setNotice('La referencia IA estará disponible más adelante.')
          return
        }
        await loadAssets()
        onChanged()
      }, then === 'hero' ? 'Imagen principal actualizada.' : then === 'gallery' ? 'Imagen agregada a la galería.' : undefined)
    },
    [withBusy, assignAsset, loadAssets, onChanged],
  )

  const saveCroppedImage = useCallback(
    async (blob: Blob, destination: 'hero' | 'gallery') => {
      if (!cropTarget) return
      await withBusy(async () => {
        const file = new File([blob], `crop-${vehicleId}-${Date.now()}.jpg`, { type: 'image/jpeg' })
        const media = await uploadMedia(file)
        const assetId = await recordAsset(media.id, 'ai_edited', destination === 'hero' ? 'vehicle_hero' : 'vehicle_gallery', {
          sourceProvider: 'browser_crop',
          sourceUrl: cropTarget.url,
          approvalStatus: canReviewMedia ? 'approved' : 'needs_review',
          rightsStatus: canReviewMedia ? 'owned' : 'unknown',
          notes: `Crop from media ${cropTarget.id}`,
        })
        if (canReviewMedia) {
          await assignAsset(assetId, destination)
        }
        await loadAssets()
        onChanged()
        setCropTarget(null)
      }, canReviewMedia
        ? destination === 'hero'
          ? 'Recorte aplicado como imagen principal.'
          : 'Recorte agregado a la galería pública.'
        : 'Recorte enviado a revisión antes de publicarse.')
    },
    [
      assignAsset,
      canReviewMedia,
      cropTarget,
      loadAssets,
      onChanged,
      recordAsset,
      uploadMedia,
      vehicleId,
      withBusy,
    ],
  )

  const syncedImageUrl = vehicle.imageUrl || undefined
  const heroMediaUrl = mediaUrl(vehicle.image)
  const heroUrl = heroMediaUrl
  const galleryImages = useMemo<GalleryPreviewImage[]>(
    () =>
      galleryItems
        .map((g, index): GalleryPreviewImage | null => {
          const url = mediaUrl(g.image)
          const id = mediaId(g.image)
          if (!url || id == null) return null
          return { id, url, label: g.alt || `Galería ${index + 1}`, index }
        })
        .filter(isGalleryPreviewImage),
    [galleryItems],
  )
  const heroId = mediaId(vehicle.image)
  const syncedAsset = visibleAssets.find(
    (asset) =>
      sourceIdentity(asset.sourceUrl) === sourceIdentity(syncedImageUrl) ||
      sourceIdentity(asset.title) === sourceIdentity(vehicle.imageFilename),
  )
  const syncedMediaId = mediaId(syncedAsset?.media)
  const galleryMediaIds = new Set(galleryPatchItems(galleryItems).map((item) => String(item.image)))
  const syncedIsHero = syncedMediaId != null && String(mediaId(vehicle.image)) === String(syncedMediaId)
  const syncedIsInGallery = syncedMediaId != null && galleryMediaIds.has(String(syncedMediaId))
  const syncedIsApproved = Boolean(syncedAsset && canAssignPublicAsset(syncedAsset))
  const canUseSyncedAsHero = Boolean(syncedImageUrl && !syncedIsHero)
  const canAddSyncedToGallery = Boolean(syncedImageUrl && !syncedIsInGallery)
  const showSyncedReference = Boolean(syncedImageUrl)
  const reviewAssets = visibleAssets.filter((asset) => mediaId(asset.media) != null && needsReviewAsset(asset))
  const approvedUnpublishedAssets = visibleAssets.filter(
    (asset) =>
      asset.id != null &&
      mediaId(asset.media) != null &&
      canAssignPublicAsset(asset) &&
      !assetIsHero(asset, heroId) &&
      !assetIsInGallery(asset, galleryMediaIds) &&
      !dismissedApprovedAssetIds.has(String(asset.id)),
  )
  const promotedAssetIds = new Set([
    ...reviewAssets.map((asset) => String(asset.id)),
    ...approvedUnpublishedAssets.map((asset) => String(asset.id)),
  ])
  const libraryAssets = visibleAssets.filter((asset) => !promotedAssetIds.has(String(asset.id)))
  const displayImage =
    previewImage ||
    (heroUrl
      ? {
          id: heroId ?? `hero-${vehicle.id}`,
          url: heroUrl,
          label: 'Imagen principal',
        }
      : null)
  const displayImageIsGalleryPreview = Boolean(previewImage)
  useEffect(() => {
    if (!previewImage?.id) return
    if (!galleryImages.some((image) => String(image.id) === String(previewImage.id))) {
      setPreviewImage(null)
    }
  }, [galleryImages, previewImage?.id])

  return (
    <div className="studio">
      <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleUpload} />

      {error ? <div className="builder__error">{error}</div> : null}
      {notice ? <div className="workspace__notice">{notice}</div> : null}

      {/* Current imagery + primary actions */}
      <div className="studio__current">
        {displayImage ? (
          <div className="studio__hero-frame">
            <img className="studio__hero" src={displayImage.url} alt={displayImage.label} />
            <span>{displayImage.label}</span>
            <button
              className="studio__crop-button"
              disabled={busy}
              onClick={() =>
                setCropTarget({
                  ...displayImage,
                  source: displayImageIsGalleryPreview ? 'gallery' : 'current',
                })
              }
              type="button"
            >
              Recortar
            </button>
            {!displayImageIsGalleryPreview && heroId != null ? (
              <button className="studio__clear-hero-button" disabled={busy} onClick={() => void clearHero()} type="button">
                Quitar como principal
              </button>
            ) : null}
            {displayImageIsGalleryPreview && heroUrl ? (
              <button className="studio__clear-hero-button" disabled={busy} onClick={() => setPreviewImage(null)} type="button">
                Ver principal
              </button>
            ) : null}
          </div>
        ) : (
          <EmptyState
            title="Sin imagen principal"
            message="Sube una foto propia o publica una imagen sincronizada aprobada."
          />
        )}
        <label className="studio__rights-confirm">
          <input
            checked={confirmDealerRights}
            onChange={(event) => setConfirmDealerRights(event.target.checked)}
            type="checkbox"
          />
          <span>
            <strong>Derechos de foto propia</strong>
            <span>La agencia confirma que puede publicar las fotos subidas manualmente.</span>
          </span>
        </label>
        <div className="studio__actions">
          <ActionButton
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setUploadTarget('hero')
              fileInputRef.current?.click()
            }}
          >
            Subir principal
          </ActionButton>
          <ActionButton
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setUploadTarget('gallery')
              fileInputRef.current?.click()
            }}
          >
            Subir a galería
          </ActionButton>
          <ActionButton variant="secondary" disabled={busy} onClick={() => setSearchOpen((v) => !v)}>
            {searchOpen ? 'Cerrar búsqueda' : 'Buscar candidatas'}
          </ActionButton>
          <ActionButton variant="primary" disabled={busy} onClick={() => setAiWizardOpen(true)}>
            {AI_IMAGE_WIZARD_ENABLED ? 'Crear con IA' : 'Crear con IA - proximamente'}
          </ActionButton>
        </div>
        {showSyncedReference ? (
          <div className="studio__synced-source">
            <img src={syncedImageUrl} alt={vehicle.imageFilename || 'Imagen importada'} />
            <div>
              <strong title={vehicle.imageFilename || vehicle.imagePath || undefined}>
                Imagen sincronizada pendiente de publicar
              </strong>
              <p>Se aprueba y se publica como principal o en la galería para aparecer en la web.</p>
            </div>
            <div className="studio__synced-actions">
              {syncedIsApproved && !syncedIsHero && !syncedIsInGallery ? (
                <StatusBadge tone="success">Aprobada sin publicar</StatusBadge>
              ) : null}
              {syncedIsHero ? <StatusBadge tone="success">Principal</StatusBadge> : null}
              {syncedIsInGallery ? <StatusBadge tone="success">En galería</StatusBadge> : null}
              {canUseSyncedAsHero ? (
                <ActionButton
                  variant="secondary"
                  disabled={busy || importingUrl === syncedImageUrl}
                  onClick={() => void importSyncedImage('hero')}
                >
                  {importingUrl === syncedImageUrl
                    ? 'Importando...'
                    : canReviewMedia
                      ? 'Aprobar y publicar como principal'
                      : 'Enviar a revisión como principal'}
                </ActionButton>
              ) : null}
              {canAddSyncedToGallery ? (
                <ActionButton
                  variant="secondary"
                  disabled={busy || importingUrl === syncedImageUrl}
                  onClick={() => void importSyncedImage('gallery')}
                >
                  {canReviewMedia ? 'Aprobar y publicar en galería' : 'Enviar a revisión para galería'}
                </ActionButton>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <VehicleAIImageWizard
        assets={visibleAssets}
        templates={templates}
        onChanged={() => {
          void loadAssets()
          onChanged()
        }}
        onTemplatesChanged={() => void loadTemplates()}
        onClose={() => setAiWizardOpen(false)}
        open={aiWizardOpen}
        vehicle={vehicle}
      />

      {galleryImages.length ? (
        <section className="studio__gallery-section">
          <div className="studio__section-head">
            <div>
              <h4>Galería pública</h4>
              <span>Orden visible en la ficha del vehiculo.</span>
            </div>
            <StatusBadge tone="success">{galleryImages.length}</StatusBadge>
          </div>
          <div className="studio__gallery">
            {galleryImages.map((image, index) => {
            const imageKey = String(image.id)
            const menuOpen = openGalleryMenu === imageKey

            return (
            <figure
              key={imageKey}
              className={`studio__gallery-item${String(previewImage?.id) === imageKey ? ' studio__gallery-item--active' : ''}${
                draggedGalleryIndex === index ? ' studio__gallery-item--dragging' : ''
              }${dragOverGalleryIndex === index && draggedGalleryIndex !== index ? ' studio__gallery-item--drop-target' : ''}${
                draggedGalleryIndex !== null ? ' studio__gallery-item--drag-active' : ''
              }${menuOpen ? ' studio__gallery-item--menu-open' : ''}`}
              draggable={!busy}
              onDragEnd={clearGalleryDrag}
              onDragEnter={() => setDragOverGalleryIndex(index)}
              onDragOver={(event) => {
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
              }}
              onDragStart={(event) => startGalleryDrag(event, index)}
              onDrop={(event) => {
                event.preventDefault()
                const transferIndex = event.dataTransfer.getData('text/plain')
                const fromIndex = draggedGalleryIndex ?? (transferIndex ? Number(transferIndex) : NaN)
                clearGalleryDrag()
                if (Number.isInteger(fromIndex)) void reorderGallery(fromIndex, index)
              }}
              onMouseLeave={() => setOpenGalleryMenu((current) => (current === imageKey ? null : current))}
            >
              <button
                aria-label={`Mover ${image.label}`}
                className="studio__gallery-drag-handle"
                disabled={busy}
                draggable={!busy}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                }}
                onDragStart={(event) => startGalleryDrag(event, index)}
                title="Arrastrar"
                type="button"
              />
              <span className="studio__gallery-index">{index + 1}</span>
              <button
                aria-label={`Ver ${image.label}`}
                className="studio__gallery-preview"
                onClick={() => setPreviewImage(image)}
                type="button"
              >
                <img draggable={false} src={image.url} alt={image.label} />
              </button>
              <div className="studio__gallery-menu">
                <button
                  aria-expanded={menuOpen}
                  aria-label={`Opciones de ${image.label}`}
                  className="studio__gallery-menu-trigger"
                  disabled={busy}
                  onClick={(event) => {
                    event.stopPropagation()
                    setOpenGalleryMenu(menuOpen ? null : imageKey)
                  }}
                  type="button"
                >
                  ...
                </button>
                <div className="studio__gallery-menu-popover">
                  <button
                    disabled={busy}
                    onClick={(event) => {
                      event.stopPropagation()
                      setOpenGalleryMenu(null)
                      setCropTarget({ ...image, source: 'gallery' })
                    }}
                    type="button"
                  >
                    Recortar
                  </button>
                  <button
                    className="studio__gallery-menu-danger"
                    disabled={busy}
                    onClick={(event) => {
                      event.stopPropagation()
                      void removeFromGallery(image.id as number | string)
                    }}
                    type="button"
                  >
                    Quitar de galería
                  </button>
                </div>
              </div>
            </figure>
              )
            })}
          </div>
        </section>
      ) : null}

      {/* Photo search (CarsXE) */}
      {searchOpen ? (
        <div className="vehicle-photo-search" role="dialog" aria-modal="true" aria-label="Buscar fotos del vehiculo">
          <button className="vehicle-photo-search__backdrop" onClick={() => setSearchOpen(false)} type="button" />
          <section className="vehicle-photo-search__panel">
            <header className="vehicle-photo-search__header">
              <div>
                <p>Buscar fotos</p>
                <h3>
                  {searchMake || 'Marca'} {searchModel || 'Modelo'} {searchYear || ''}
                </h3>
              </div>
              <button aria-label="Cerrar busqueda" onClick={() => setSearchOpen(false)} type="button">
                x
              </button>
            </header>
            <div className="vehicle-photo-search__body studio__wizard">
          <div className="studio__wizard-head">
            <h4>Buscar fotos del vehículo</h4>
            <span className="builder__muted">Fuente: CarsXE · por marca / modelo / año / color</span>
          </div>

          {searchUnavailable ? (
            <div className="workshop-editor__banner">
              La búsqueda de fotos no está configurada. Define <code>CARSXE_API_KEY</code> en el servidor para
              habilitarla.
            </div>
          ) : (
            <p className="builder__muted">
              La búsqueda consume créditos del plan, así que solo se ejecuta al pulsar “Buscar”. Los resultados se
              guardan en caché y las fotos que guardes quedan como copia local del vehículo para no repetir búsquedas.
            </p>
          )}

          <div className="studio__search-fields">
            <label className="builder__field">
              <span>Marca</span>
              <input value={searchMake} onChange={(e) => setSearchMake(e.target.value)} placeholder="Toyota" />
            </label>
            <label className="builder__field">
              <span>Modelo</span>
              <input value={searchModel} onChange={(e) => setSearchModel(e.target.value)} placeholder="Camry" />
            </label>
            <label className="builder__field">
              <span>Año</span>
              <input value={searchYear} onChange={(e) => setSearchYear(e.target.value)} placeholder="2023" />
            </label>
            <label className="builder__field">
              <span>Color</span>
              <input value={searchColor} onChange={(e) => setSearchColor(e.target.value)} placeholder="Blue" />
            </label>
          </div>

          <div className="vehicle-photo-search__tags">
            <span>matchKey</span>
            <strong>
              {[searchMake, searchModel, searchYear, vehicle.trim, searchColor].filter(Boolean).join(' / ') ||
                'Completa marca y modelo'}
            </strong>
          </div>

          <div className="studio__actions">
            <ActionButton
              variant="primary"
              disabled={busy || searchUnavailable || !searchMake || !searchModel}
              onClick={() => void runSearch(false)}
            >
              {busy ? 'Buscando…' : 'Buscar'}
            </ActionButton>
            {searchedOnce ? (
              <ActionButton
                variant="secondary"
                disabled={busy || searchUnavailable}
                onClick={() => void runSearch(true)}
              >
                Volver a buscar (ignorar caché)
              </ActionButton>
            ) : null}
            {searchedOnce && searchCached ? <StatusBadge tone="info">Resultados en caché</StatusBadge> : null}
          </div>

          {localMatches.length ? (
            <div className="studio__library studio__library--suggestions">
              <div className="studio__wizard-head">
                <h4>Ya tenemos imágenes para este vehículo</h4>
                <StatusBadge tone="success">{cacheSource === 'local' ? 'Sin llamada API' : localMatches.length}</StatusBadge>
              </div>
              <div className="studio__grid">
                {localMatches.map((asset) => {
                  const url = mediaUrl(asset.media)
                  const assetMediaId = mediaId(asset.media)
                  if (!url || assetMediaId == null) return null
                  return (
                    <div key={asset.id} className="studio__output">
                      <img src={url} alt={asset.title || ''} />
                      <span className="builder__muted studio__dim">
                        {matchConfidenceLabel(asset.matchConfidence, 'Coincidencia por modelo/año/trim/color')}
                      </span>
                      <div className="studio__output-actions">
                        <button type="button" disabled={busy} onClick={() => void useLocalAsset(asset, 'hero')}>
                          {canAssignPublicAsset(asset) ? 'Publicar principal' : 'Pendiente'}
                        </button>
                        <button type="button" disabled={busy} onClick={() => void useLocalAsset(asset, 'gallery')}>
                          {canAssignPublicAsset(asset) ? 'Publicar en galería' : 'Enviar a revisión'}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            setCropTarget({
                              id: assetMediaId,
                              url,
                              label: asset.title || 'Imagen',
                              source: 'local',
                            })
                          }
                        >
                          Recortar
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}

          {searchedOnce && candidates.length === 0 && localMatches.length === 0 && !busy ? (
            <EmptyState title="Sin resultados" message="Prueba con otro modelo, año o sin color." />
          ) : null}

          {candidates.length ? (
            <div className="studio__grid">
              {candidates.map((candidate) => {
                const importing = importingUrl === candidate.link
                return (
                  <div key={candidate.link} className="studio__output">
                    <img src={candidate.thumbnail} alt="Candidata" />
                    {candidate.width ? (
                      <span className="builder__muted studio__dim">
                        {candidate.width}×{candidate.height}
                      </span>
                    ) : null}
                    <div className="studio__output-actions">
                      <button type="button" disabled={busy || importing} onClick={() => void importCandidate(candidate, 'hero')}>
                        {importing ? '...' : 'Enviar a revisión como principal'}
                      </button>
                      <button type="button" disabled={busy || importing} onClick={() => void importCandidate(candidate, 'gallery')}>
                        Enviar a revisión para galería
                      </button>
                      <button type="button" disabled={busy || importing} onClick={() => void importCandidate(candidate)}>
                        Guardar candidata
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {reviewAssets.length ? (
        <div className="studio__review-queue">
          <div className="studio__wizard-head">
            <h4>Imágenes pendientes de revisión</h4>
            <StatusBadge tone="warning">{reviewAssets.length}</StatusBadge>
          </div>
          <div className="studio__review-grid">
            {reviewAssets.map((asset) => {
              const url = mediaUrl(asset.media)
              if (!url) return null
              const target = intendedTarget(asset)
              return (
                <article className="studio__review-card" key={asset.id}>
                  <img src={url} alt={asset.title || 'Imagen pendiente'} />
                  <div className="studio__review-meta">
                    <strong>{assetSourceLabel(asset)}</strong>
                    <span>{matchConfidenceLabel(asset.matchConfidence, 'Coincidencia por revisar')}</span>
                    <span>{assetApprovalLabel(asset)} - {assetRightsLabel(asset)}</span>
                    <span>{USAGE_LABELS[asset.usage || ''] || 'Uso por definir'}</span>
                    <StatusBadge tone={assetPublicationTone(asset, heroId, galleryMediaIds)}>
                      {assetPublicationLabel(asset, heroId, galleryMediaIds)}
                    </StatusBadge>
                  </div>
                  {canReviewMedia ? (
                    <div className="studio__output-actions studio__review-actions">
                      {target ? (
                        <button
                          className="studio__primary-review-action"
                          disabled={busy}
                          onClick={() =>
                            void withBusy(async () => {
                              await reviewAsset(asset.id, 'approve_owned', target)
                              await loadAssets()
                              onChanged()
                            }, target === 'hero' ? 'Imagen aprobada y publicada como principal.' : 'Imagen aprobada y publicada en galería.')
                          }
                          type="button"
                        >
                          {target === 'hero' ? 'Aprobar y publicar como principal' : 'Aprobar y publicar en galería'}
                        </button>
                      ) : null}
                      <button
                        disabled={busy}
                        onClick={() =>
                          void withBusy(async () => {
                            await reviewAsset(asset.id, 'approve_owned')
                            await loadAssets()
                            onChanged()
                          }, 'Imagen aprobada para biblioteca. Aun no esta publicada.')
                        }
                        type="button"
                      >
                        Aprobar solo para biblioteca
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          void withBusy(async () => {
                            await reviewAsset(asset.id, 'approve_licensed')
                            await loadAssets()
                            onChanged()
                          }, 'Imagen aprobada con licencia. Aun no esta publicada.')
                        }
                        type="button"
                      >
                        Aprobar con licencia
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          void withBusy(async () => {
                            await reviewAsset(asset.id, 'reject')
                            await loadAssets()
                            onChanged()
                          }, 'Imagen rechazada.')
                        }
                        type="button"
                      >
                        Rechazar
                      </button>
                    </div>
                  ) : (
                    <p className="builder__muted studio__dim">
                      Pendiente de aprobacion por admin/media editor.
                    </p>
                  )}
                </article>
              )
            })}
          </div>
        </div>
      ) : null}

      {approvedUnpublishedAssets.length ? (
        <div className="studio__approved-queue">
          <div className="studio__wizard-head">
            <div>
              <h4>Aprobadas sin publicar</h4>
              <span className="builder__muted">
                Estas imagenes ya tienen derechos aprobados, pero todavia no aparecen en la web.
              </span>
            </div>
            <StatusBadge tone="warning">{approvedUnpublishedAssets.length}</StatusBadge>
          </div>
          <div className="studio__review-grid">
            {approvedUnpublishedAssets.map((asset) => {
              const url = mediaUrl(asset.media)
              if (!url) return null
              return (
                <article className="studio__review-card studio__review-card--approved" key={asset.id}>
                  <img src={url} alt={asset.title || 'Imagen aprobada'} />
                  <div className="studio__review-meta">
                    <strong>{assetSourceLabel(asset)}</strong>
                    <span>
                      {matchConfidenceLabel(asset.matchConfidence, 'Lista para publicar')} · {assetRightsLabel(asset)}
                    </span>
                  </div>
                  <div className="studio__output-actions studio__review-actions">
                    <button
                      className="studio__primary-review-action"
                      disabled={busy}
                      onClick={() =>
                        void withBusy(async () => {
                          await assignAsset(asset.id, 'gallery')
                          await loadAssets()
                          onChanged()
                        }, 'Imagen publicada en galería.')
                      }
                      type="button"
                    >
                      Publicar en galería
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void withBusy(async () => {
                          await assignAsset(asset.id, 'hero')
                          await loadAssets()
                          onChanged()
                        }, 'Imagen publicada como principal.')
                      }
                      type="button"
                    >
                      Publicar como principal
                    </button>
                    <button
                      className="studio__link-action"
                      disabled={busy}
                      onClick={() => {
                        setDismissedApprovedAssetIds((current) => {
                          const next = new Set(current)
                          next.add(String(asset.id))
                          return next
                        })
                        setNotice('Imagen mantenida en biblioteca. No se publicó en la web.')
                      }}
                      type="button"
                    >
                      Mantener en biblioteca
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      ) : null}

      {/* Reusable per-vehicle context */}
      {libraryAssets.length ? (
        <div className="studio__library">
          <div className="studio__wizard-head">
            <h4>Biblioteca y sugerencias</h4>
            <StatusBadge tone="neutral">{libraryAssets.length}</StatusBadge>
          </div>
          <div className="studio__grid">
            {libraryAssets.map((asset) => {
              const url = mediaUrl(asset.media)
              const id = mediaId(asset.media)
              if (!url || id == null) return null
              const isPublicHero = assetIsHero(asset, heroId)
              const isPublicGallery = assetIsInGallery(asset, galleryMediaIds)
              return (
                <div key={asset.id} className="studio__output">
                  <img src={url} alt={asset.title || ''} />
                  <span className="builder__muted studio__dim" title={assetApprovalLabel(asset)}>
                    {assetSourceLabel(asset)} · {assetRightsLabel(asset)}
                  </span>
                  <StatusBadge tone={assetPublicationTone(asset, heroId, galleryMediaIds)}>
                    {assetPublicationLabel(asset, heroId, galleryMediaIds)}
                  </StatusBadge>
                  <div className="studio__output-actions">
                    {!isPublicHero ? (
                      <button type="button" disabled={busy} onClick={() => void useLocalAsset(asset, 'hero')}>
                        {canAssignPublicAsset(asset) ? 'Publicar principal' : 'Pendiente'}
                      </button>
                    ) : null}
                    {!isPublicGallery ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void useLocalAsset(asset, 'gallery')}
                    >
                      {canAssignPublicAsset(asset) ? 'Publicar en galería' : 'Enviar a revisión'}
                    </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setCropTarget({ id, url, label: asset.title || 'Imagen', source: 'library' })}
                    >
                      Recortar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {cropTarget ? (
        <CropImageModal
          busy={busy}
          image={cropTarget}
          onClose={() => setCropTarget(null)}
          onSave={(blob, destination) => void saveCroppedImage(blob, destination)}
        />
      ) : null}
    </div>
  )
}

function CropImageModal({
  busy,
  image,
  onClose,
  onSave,
}: {
  busy: boolean
  image: CropTarget
  onClose: () => void
  onSave: (blob: Blob, destination: 'hero' | 'gallery') => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [zoom, setZoom] = useState(1)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [error, setError] = useState('')

  const draw = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    await new Promise<void>((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const canvasRatio = canvas.width / canvas.height
        const imageRatio = img.naturalWidth / img.naturalHeight
        const baseWidth = imageRatio > canvasRatio ? canvas.height * imageRatio : canvas.width
        const baseHeight = imageRatio > canvasRatio ? canvas.height : canvas.width / imageRatio
        const drawWidth = baseWidth * zoom
        const drawHeight = baseHeight * zoom
        const maxShiftX = Math.max(0, (drawWidth - canvas.width) / 2)
        const maxShiftY = Math.max(0, (drawHeight - canvas.height) / 2)
        const x = (canvas.width - drawWidth) / 2 + (offsetX / 100) * maxShiftX
        const y = (canvas.height - drawHeight) / 2 + (offsetY / 100) * maxShiftY

        ctx.fillStyle = '#f3f5f7'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, x, y, drawWidth, drawHeight)
        resolve()
      }
      img.onerror = () => reject(new Error('No se pudo cargar la imagen para recortar.'))
      img.src = image.url
    })
  }, [image.url, offsetX, offsetY, zoom])

  useEffect(() => {
    setError('')
    void draw().catch((err) => setError(err instanceof Error ? err.message : 'Error al preparar recorte.'))
  }, [draw])

  const save = useCallback(
    async (destination: 'hero' | 'gallery') => {
      const canvas = canvasRef.current
      if (!canvas) return
      try {
        await draw()
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((nextBlob) => {
            if (!nextBlob) reject(new Error('No se pudo generar el recorte.'))
            else resolve(nextBlob)
          }, 'image/jpeg', 0.92)
        })
        onSave(blob, destination)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo guardar el recorte.')
      }
    },
    [draw, onSave],
  )

  return (
    <div className="studio-crop" role="dialog" aria-modal="true" aria-label="Recortar imagen">
      <button className="studio-crop__backdrop" onClick={onClose} type="button" />
      <section className="studio-crop__panel">
        <header className="studio-crop__header">
          <div>
            <p>Editar imagen</p>
            <h3>{image.label}</h3>
          </div>
          <button aria-label="Cerrar recorte" onClick={onClose} type="button">
            x
          </button>
        </header>
        <div className="studio-crop__body">
          <canvas ref={canvasRef} width={1200} height={900} />
          <div className="studio-crop__controls">
            <label className="builder__field">
              <span>Zoom</span>
              <input
                max="2.5"
                min="1"
                onChange={(event) => setZoom(Number(event.target.value))}
                step="0.05"
                type="range"
                value={zoom}
              />
            </label>
            <label className="builder__field">
              <span>Horizontal</span>
              <input
                max="100"
                min="-100"
                onChange={(event) => setOffsetX(Number(event.target.value))}
                step="1"
                type="range"
                value={offsetX}
              />
            </label>
            <label className="builder__field">
              <span>Vertical</span>
              <input
                max="100"
                min="-100"
                onChange={(event) => setOffsetY(Number(event.target.value))}
                step="1"
                type="range"
                value={offsetY}
              />
            </label>
          </div>
        </div>
        {error ? <div className="builder__error">{error}</div> : null}
        <footer className="studio-crop__footer">
          <ActionButton variant="secondary" disabled={busy} onClick={onClose}>
            Cancelar
          </ActionButton>
          <ActionButton variant="secondary" disabled={busy} onClick={() => void save('gallery')}>
            Guardar en galería
          </ActionButton>
          <ActionButton variant="primary" disabled={busy} onClick={() => void save('hero')}>
            Usar como principal
          </ActionButton>
        </footer>
      </section>
    </div>
  )
}

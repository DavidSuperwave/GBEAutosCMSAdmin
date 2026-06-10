'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ActionButton, EmptyState, StatusBadge } from '../admin-ui/kit'
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
  gallery?: Array<{ image?: MediaRef; alt?: string | null }> | null
}

type Asset = {
  id: number | string
  title?: string
  sourceType?: string
  approvalStatus?: string
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

type Output = { image?: MediaRef; url?: string }

type Job = {
  id: number | string
  outputs?: Output[]
  status?: string
  error?: string
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
}

/** Strip a leading brand from the model ("Mazda CX-50" -> "CX-50"). */
function normalizeModel(brand: string, model: string): string {
  const m = (model || '').trim()
  const b = (brand || '').trim()
  if (b && m.toLowerCase().startsWith(`${b.toLowerCase()} `)) return m.slice(b.length).trim()
  return m
}

const PRESETS: Array<{ value: string; label: string }> = [
  { value: 'vehicle_hero', label: 'Hero de listado' },
  { value: 'clean_dealership_bg', label: 'Fondo de agencia limpio' },
  { value: 'transparent_bg', label: 'Fondo transparente' },
  { value: 'logo_overlay', label: 'Logo sobrepuesto' },
  { value: 'homepage_banner', label: 'Banner de homepage' },
  { value: 'social_ad', label: 'Anuncio para redes' },
  { value: 'promo_banner', label: 'Promo banner' },
  { value: 'seminuevo_gallery_cover', label: 'Portada galería seminuevo' },
  { value: 'new_car_representative', label: 'Imagen representativa auto nuevo' },
]

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

export default function VehicleImageStudio({
  vehicle,
  onChanged,
}: {
  vehicle: VehicleLite
  onChanged: () => void
}) {
  const vehicleId = vehicle.id
  const fileInputRef = useRef<HTMLInputElement>(null)
  const refInputRef = useRef<HTMLInputElement>(null)

  const [assets, setAssets] = useState<Asset[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [aiOpen] = useState(false)
  const [aiUnavailable, setAiUnavailable] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [aiWizardOpen, setAiWizardOpen] = useState(false)

  // Wizard state
  const [preset, setPreset] = useState('vehicle_hero')
  const [prompt, setPrompt] = useState('')
  const [reference, setReference] = useState<{ id: number | string; url?: string } | null>(null)
  const [job, setJob] = useState<Job | null>(null)
  const [uploadTarget, setUploadTarget] = useState<'hero' | 'gallery'>('hero')

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

  const vehicleContext = useMemo(
    () => ({
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      trim: vehicle.trim,
      color: vehicle.exteriorColor,
    }),
    [vehicle.brand, vehicle.model, vehicle.year, vehicle.trim, vehicle.exteriorColor],
  )

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
    () =>
      assets.filter((asset) => {
        if (asset.matchKey && asset.matchKey !== vehicleMatchKey) return false
        if (asset.make && normalizeToken(asset.make) !== normalizeToken(vehicle.brand)) return false
        return !mentionsOtherMake([asset.title, asset.make, asset.model].filter(Boolean).join(' '), vehicle.brand)
      }),
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
      await fetch('/api/vehicle-media-assets', {
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
      }).catch(() => {})
    },
    [vehicleId, vehicle.brand, vehicle.model, vehicle.year, vehicle.trim, vehicle.exteriorColor, vehicleMatchKey],
  )

  const setHero = useCallback(
    async (media: number | string) => {
      const res = await fetch(`/api/vehicles/${vehicleId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: media, imageStatus: 'approved' }),
      })
      if (!res.ok) throw new Error((await res.text()).slice(0, 160))
    },
    [vehicleId],
  )

  const addToGallery = useCallback(
    async (media: number | string) => {
      const existing = (vehicle.gallery || [])
        .map((g) => mediaId(g.image))
        .filter((x): x is number | string => x != null)
        .map((image) => ({ image }))
      const res = await fetch(`/api/vehicles/${vehicleId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gallery: [...existing, { image: media }] }),
      })
      if (!res.ok) throw new Error((await res.text()).slice(0, 160))
    },
    [vehicleId, vehicle.gallery],
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

  const removeFromGallery = useCallback(
    async (media: number | string) => {
      await withBusy(async () => {
        const gallery = (vehicle.gallery || [])
          .filter((g) => String(mediaId(g.image)) !== String(media))
          .map((g) => {
            const image = mediaId(g.image)
            return image == null ? null : { image, alt: g.alt }
          })
          .filter((g): g is { image: number | string; alt: string | null | undefined } => g !== null)
        const res = await fetch(`/api/vehicles/${vehicleId}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gallery }),
        })
        if (!res.ok) throw new Error((await res.text()).slice(0, 160))
        if (String(previewImage?.id) === String(media)) setPreviewImage(null)
        onChanged()
      }, 'Imagen eliminada de la galeria.')
    },
    [onChanged, previewImage?.id, vehicle.gallery, vehicleId, withBusy],
  )

  // ---- Upload actions ----------------------------------------------------
  const handleUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (file) {
        await withBusy(async () => {
          const media = await uploadMedia(file)
          if (uploadTarget === 'hero') await setHero(media.id)
          else await addToGallery(media.id)
          await recordAsset(media.id, 'uploaded', uploadTarget === 'hero' ? 'vehicle_hero' : 'vehicle_gallery')
          await loadAssets()
          onChanged()
        }, uploadTarget === 'hero' ? 'Imagen principal actualizada.' : 'Imagen agregada a la galería.')
      }
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [withBusy, uploadMedia, uploadTarget, setHero, addToGallery, recordAsset, loadAssets, onChanged],
  )

  const handleReferenceUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (file) {
        await withBusy(async () => {
          const media = await uploadMedia(file)
          await recordAsset(media.id, 'uploaded')
          setReference({ id: media.id, url: media.url })
          await loadAssets()
        }, 'Referencia adjuntada.')
      }
      if (refInputRef.current) refInputRef.current.value = ''
    },
    [withBusy, uploadMedia, recordAsset, loadAssets],
  )

  // ---- AI wizard ---------------------------------------------------------
  const ensureJob = useCallback(async (): Promise<Job> => {
    const body = {
      title: `${vehicle.brand || ''} ${vehicle.model || ''} ${vehicle.year || ''}`.trim() || 'Imagen IA',
      linkedVehicle: vehicleId,
      vehicleContext,
      promptPreset: preset,
      prompt,
      saveDestination: 'vehicle_hero',
      inputImages: reference ? [{ image: reference.id }] : [],
    }
    if (job?.id) {
      const res = await fetch(`/api/workshop-jobs/${job.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.text()).slice(0, 160))
      return (await res.json()).doc as Job
    }
    const res = await fetch('/api/workshop-jobs', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error((await res.text()).slice(0, 160))
    const created = (await res.json()).doc as Job
    setJob(created)
    return created
  }, [job, vehicleId, vehicle.brand, vehicle.model, vehicle.year, vehicleContext, preset, prompt, reference])

  const generate = useCallback(async () => {
    await withBusy(async () => {
      setAiUnavailable(false)
      const ensured = await ensureJob()
      const res = await fetch('/api/cms/workshop/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: ensured.id }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; configured?: boolean; error?: string }
      if (res.status === 501 || data.configured === false) {
        setAiUnavailable(true)
      } else if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Falló la generación.')
      }
      const fresh = await fetch(`/api/workshop-jobs/${ensured.id}?depth=2`, { credentials: 'include' })
      if (fresh.ok) setJob((await fresh.json()) as Job)
    })
  }, [withBusy, ensureJob])

  const pickTemplate = useCallback((t: Template) => {
    if (t.preset) setPreset(t.preset)
    setPrompt(t.prompt || '')
    const url = mediaUrl(t.referenceImage)
    const refId = mediaId(t.referenceImage)
    setReference(refId != null ? { id: refId, url } : null)
  }, [])

  const saveTemplate = useCallback(async () => {
    const name = window.prompt('Nombre de la plantilla:')
    if (!name) return
    await withBusy(async () => {
      await fetch('/api/image-templates', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, preset, prompt, referenceImage: reference?.id }),
      })
      await loadTemplates()
    }, 'Plantilla guardada.')
  }, [withBusy, preset, prompt, reference, loadTemplates])

  const saveOutput = useCallback(
    async (output: Output, target: 'hero' | 'gallery') => {
      const id = mediaId(output.image)
      if (id == null) {
        setError('Este resultado es solo una URL temporal. Configura el proveedor de IA para guardar el archivo.')
        return
      }
      await withBusy(async () => {
        if (target === 'hero') await setHero(id)
        else await addToGallery(id)
        await recordAsset(id, 'ai_generated', target === 'hero' ? 'vehicle_hero' : 'vehicle_gallery')
        await loadAssets()
        onChanged()
      }, target === 'hero' ? 'Imagen principal actualizada.' : 'Imagen agregada a la galería.')
    },
    [withBusy, setHero, addToGallery, recordAsset, loadAssets, onChanged],
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
          mediaId?: number | string
          mediaUrl?: string
          error?: string
        }
        if (!res.ok || !data.ok || data.mediaId == null) {
          throw new Error(data.error || 'No se pudo guardar la imagen.')
        }
        if (then === 'hero') await setHero(data.mediaId)
        else if (then === 'gallery') await addToGallery(data.mediaId)
        else if (then === 'reference') {
          setReference({ id: data.mediaId, url: data.mediaUrl })
          window.location.href = `/admin/media-workspace?vehicleId=${encodeURIComponent(String(vehicleId))}&referenceId=${encodeURIComponent(String(data.mediaId))}`
        }
        await loadAssets()
        onChanged()
        setNotice(
          then === 'hero'
            ? 'Imagen principal actualizada.'
            : then === 'gallery'
              ? 'Imagen agregada a la galería.'
              : then === 'reference'
                ? 'Imagen lista como referencia para el asistente IA.'
                : 'Imagen guardada en la biblioteca del vehículo.',
        )
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setImportingUrl(null)
      }
    },
    [vehicleId, vehicle.trim, searchColor, searchMake, searchModel, searchYear, setHero, addToGallery, loadAssets, onChanged],
  )

  const useLocalAsset = useCallback(
    async (asset: Asset, then: 'hero' | 'gallery' | 'reference') => {
      const id = mediaId(asset.media)
      const url = mediaUrl(asset.media)
      if (id == null) return
      await withBusy(async () => {
        if (then === 'hero') await setHero(id)
        else if (then === 'gallery') await addToGallery(id)
        else {
          window.location.href = `/admin/media-workspace?vehicleId=${encodeURIComponent(String(vehicleId))}&referenceId=${encodeURIComponent(String(id))}`
          return
        }
        await recordAsset(id, 'representative', then === 'hero' ? 'vehicle_hero' : 'vehicle_gallery', {
          sourceProvider: asset.sourceType || 'local',
          matchConfidence: asset.matchConfidence || 'same_trim_color',
          approvalStatus: 'needs_review',
        })
        await loadAssets()
        onChanged()
      }, then === 'hero' ? 'Imagen principal actualizada.' : then === 'gallery' ? 'Imagen agregada a la galería.' : undefined)
      if (then === 'reference' && url) setReference({ id, url })
    },
    [vehicleId, withBusy, setHero, addToGallery, recordAsset, loadAssets, onChanged],
  )

  const heroUrl = mediaUrl(vehicle.image)
  const galleryImages = useMemo(
    () =>
      (vehicle.gallery || [])
        .map((g, index) => {
          const url = mediaUrl(g.image)
          const id = mediaId(g.image)
          if (!url || id == null) return null
          return { id, url, label: g.alt || `Galeria ${index + 1}` }
        })
        .filter((item): item is PreviewImage => item !== null),
    [vehicle.gallery],
  )
  const displayImage = previewImage || (heroUrl ? { url: heroUrl, label: 'Imagen principal' } : null)
  const outputs = job?.outputs || []

  useEffect(() => {
    if (!previewImage?.id) return
    if (!galleryImages.some((image) => String(image.id) === String(previewImage.id))) {
      setPreviewImage(null)
    }
  }, [galleryImages, previewImage?.id])

  return (
    <div className="studio">
      <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleUpload} />
      <input ref={refInputRef} type="file" accept="image/*" hidden onChange={handleReferenceUpload} />

      {error ? <div className="builder__error">{error}</div> : null}
      {notice ? <div className="workspace__notice">{notice}</div> : null}

      {/* Current imagery + primary actions */}
      <div className="studio__current">
        {displayImage ? (
          <div className="studio__hero-frame">
            <img className="studio__hero" src={displayImage.url} alt={displayImage.label} />
            <span>{displayImage.label}</span>
          </div>
        ) : (
          <EmptyState title="Sin imagen principal" message="Sube una imagen o créala con IA." />
        )}
        <div className="studio__actions">
          <ActionButton
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setUploadTarget('hero')
              fileInputRef.current?.click()
            }}
          >
            Subir imagen principal
          </ActionButton>
          <ActionButton
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setUploadTarget('gallery')
              fileInputRef.current?.click()
            }}
          >
            Agregar a galería
          </ActionButton>
          <ActionButton variant="secondary" disabled={busy} onClick={() => setSearchOpen((v) => !v)}>
            {searchOpen ? 'Cerrar búsqueda' : 'Buscar fotos'}
          </ActionButton>
          <ActionButton variant="primary" disabled={busy} onClick={() => setAiWizardOpen(true)}>
            Crear con IA
          </ActionButton>
        </div>
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
        <div className="studio__gallery">
          {galleryImages.map((image) => (
            <figure
              key={String(image.id)}
              className={`studio__gallery-item${String(previewImage?.id) === String(image.id) ? ' studio__gallery-item--active' : ''}`}
            >
              <button
                aria-label={`Ver ${image.label}`}
                className="studio__gallery-preview"
                onClick={() => setPreviewImage(image)}
                type="button"
              >
                <img src={image.url} alt={image.label} />
              </button>
              <button
                aria-label={`Eliminar ${image.label}`}
                className="studio__gallery-delete"
                disabled={busy}
                onClick={() => void removeFromGallery(image.id as number | string)}
                type="button"
              >
                Eliminar
              </button>
            </figure>
          ))}
        </div>
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
                  if (!url) return null
                  return (
                    <div key={asset.id} className="studio__output">
                      <img src={url} alt={asset.title || ''} />
                      <span className="builder__muted studio__dim">
                        {asset.matchConfidence || 'Coincidencia por modelo/año/trim/color'}
                      </span>
                      <div className="studio__output-actions">
                        <button type="button" disabled={busy} onClick={() => void useLocalAsset(asset, 'hero')}>
                          Principal
                        </button>
                        <button type="button" disabled={busy} onClick={() => void useLocalAsset(asset, 'gallery')}>
                          Galería
                        </button>
                        <button type="button" disabled={busy} onClick={() => void useLocalAsset(asset, 'reference')}>
                          Usar en IA
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
                        {importing ? '…' : 'Principal'}
                      </button>
                      <button type="button" disabled={busy || importing} onClick={() => void importCandidate(candidate, 'gallery')}>
                        Galería
                      </button>
                      <button type="button" disabled={busy || importing} onClick={() => void importCandidate(candidate, 'reference')}>
                        Usar en IA
                      </button>
                      <button type="button" disabled={busy || importing} onClick={() => void importCandidate(candidate)}>
                        Guardar
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

      {/* AI wizard */}
      {aiOpen ? (
        <div className="studio__wizard">
          <div className="studio__wizard-head">
            <h4>Asistente de imagen con IA</h4>
            <span className="builder__muted">
              {vehicleContext.brand} {vehicleContext.model} {vehicleContext.year}
              {vehicleContext.color ? ` · ${vehicleContext.color}` : ''}
            </span>
          </div>

          {aiUnavailable ? (
            <div className="workshop-editor__banner">
              La generación con IA no está configurada. Define <code>AI_IMAGE_API_KEY</code> en el servidor para
              habilitarla. Puedes preparar el trabajo, adjuntar una referencia y guardar plantillas mientras tanto.
            </div>
          ) : null}

          <label className="builder__field">
            <span>¿Qué tipo de imagen quieres crear?</span>
            <select className="builder__select" value={preset} onChange={(e) => setPreset(e.target.value)}>
              {PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          {templates.length ? (
            <div className="studio__templates">
              <span className="builder__muted">Plantillas guardadas:</span>
              <div className="studio__chips">
                {templates.map((t) => (
                  <button key={t.id} type="button" className="studio__chip" onClick={() => pickTemplate(t)}>
                    {t.name || 'Plantilla'}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <label className="builder__field">
            <span>Prompt / instrucciones</span>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ej. Sedán plateado en estudio, fondo blanco, ángulo 3/4 frontal…"
            />
          </label>

          <div className="studio__reference">
            {reference?.url ? <img src={reference.url} alt="Referencia" /> : null}
            <ActionButton variant="secondary" disabled={busy} onClick={() => refInputRef.current?.click()}>
              {reference ? 'Cambiar referencia / plantilla' : 'Subir referencia / plantilla'}
            </ActionButton>
            {reference ? (
              <ActionButton variant="secondary" disabled={busy} onClick={() => setReference(null)}>
                Quitar referencia
              </ActionButton>
            ) : null}
          </div>

          <div className="studio__actions">
            <ActionButton variant="primary" disabled={busy} onClick={() => void generate()}>
              {busy ? 'Procesando…' : 'Generar'}
            </ActionButton>
            <ActionButton variant="secondary" disabled={busy} onClick={() => void saveTemplate()}>
              Guardar como plantilla
            </ActionButton>
          </div>

          {outputs.length ? (
            <div className="studio__outputs">
              <span className="builder__muted">Resultados</span>
              <div className="studio__grid">
                {outputs.map((output, i) => {
                  const url = mediaUrl(output.image) || output.url
                  if (!url) return null
                  return (
                    <div key={i} className="studio__output">
                      <img src={url} alt={`Resultado ${i + 1}`} />
                      <div className="studio__output-actions">
                        <button type="button" disabled={busy} onClick={() => void saveOutput(output, 'hero')}>
                          Usar como principal
                        </button>
                        <button type="button" disabled={busy} onClick={() => void saveOutput(output, 'gallery')}>
                          A galería
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Reusable per-vehicle context */}
      {visibleAssets.length ? (
        <div className="studio__library">
          <div className="studio__wizard-head">
            <h4>Biblioteca y sugerencias</h4>
            <StatusBadge tone="neutral">{visibleAssets.length}</StatusBadge>
          </div>
          <div className="studio__grid">
            {visibleAssets.map((asset) => {
              const url = mediaUrl(asset.media)
              const id = mediaId(asset.media)
              if (!url || id == null) return null
              return (
                <div key={asset.id} className="studio__output">
                  <img src={url} alt={asset.title || ''} />
                  <div className="studio__output-actions">
                    <button type="button" disabled={busy} onClick={() => void withBusy(async () => {
                      await setHero(id)
                      onChanged()
                    }, 'Imagen principal actualizada.')}>
                      Usar como principal
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void withBusy(async () => {
                        await addToGallery(id)
                        onChanged()
                      }, 'Imagen agregada a la galería.')}
                    >
                      A galería
                    </button>
                    <button type="button" disabled={busy} onClick={() => setReference({ id, url })}>
                      Como referencia
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

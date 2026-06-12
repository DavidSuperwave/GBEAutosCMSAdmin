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

type CropTarget = PreviewImage & {
  source?: string
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

  const [assets, setAssets] = useState<Asset[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [aiWizardOpen, setAiWizardOpen] = useState(false)
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
  const [galleryItems, setGalleryItems] = useState(() => vehicle.gallery || [])
  const [cropTarget, setCropTarget] = useState<CropTarget | null>(null)

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
      const existing = galleryItems
        .map((g) => mediaId(g.image))
        .filter((x): x is number | string => x != null)
        .map((image) => ({ image }))
      const nextGallery = [...existing, { image: media }]
      const res = await fetch(`/api/vehicles/${vehicleId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gallery: nextGallery }),
      })
      if (!res.ok) throw new Error((await res.text()).slice(0, 160))
      setGalleryItems(nextGallery)
    },
    [galleryItems, vehicleId],
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
        const gallery = galleryItems
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
        setGalleryItems(gallery)
        if (String(previewImage?.id) === String(media)) setPreviewImage(null)
        onChanged()
      }, 'Imagen eliminada de la galeria.')
    },
    [galleryItems, onChanged, previewImage?.id, vehicleId, withBusy],
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
        await loadAssets()
        onChanged()
        setNotice(
          then === 'hero'
            ? 'Imagen principal actualizada.'
            : then === 'gallery'
              ? 'Imagen agregada a la galería.'
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
    [vehicleId, vehicle.trim, searchColor, searchMake, searchModel, searchYear, setHero, addToGallery, loadAssets, onChanged],
  )

  const useLocalAsset = useCallback(
    async (asset: Asset, then: 'hero' | 'gallery' | 'reference') => {
      const id = mediaId(asset.media)
      if (id == null) return
      await withBusy(async () => {
        if (then === 'hero') await setHero(id)
        else if (then === 'gallery') await addToGallery(id)
        else {
          setNotice('La referencia IA estará disponible más adelante.')
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
    },
    [vehicleId, withBusy, setHero, addToGallery, recordAsset, loadAssets, onChanged],
  )

  const saveCroppedImage = useCallback(
    async (blob: Blob, destination: 'hero' | 'gallery') => {
      if (!cropTarget) return
      await withBusy(async () => {
        const file = new File([blob], `crop-${vehicleId}-${Date.now()}.jpg`, { type: 'image/jpeg' })
        const media = await uploadMedia(file)
        if (destination === 'hero') await setHero(media.id)
        else await addToGallery(media.id)
        await recordAsset(media.id, 'ai_edited', destination === 'hero' ? 'vehicle_hero' : 'vehicle_gallery', {
          sourceProvider: 'browser_crop',
          sourceUrl: cropTarget.url,
          approvalStatus: 'approved',
          rightsStatus: 'owned',
          notes: `Crop from media ${cropTarget.id}`,
        })
        await loadAssets()
        onChanged()
        setCropTarget(null)
      }, destination === 'hero' ? 'Recorte aplicado como imagen principal.' : 'Recorte agregado a la galeria.')
    },
    [
      addToGallery,
      cropTarget,
      loadAssets,
      onChanged,
      recordAsset,
      setHero,
      uploadMedia,
      vehicleId,
      withBusy,
    ],
  )

  const heroUrl = mediaUrl(vehicle.image)
  const galleryImages = useMemo(
    () =>
      galleryItems
        .map((g, index) => {
          const url = mediaUrl(g.image)
          const id = mediaId(g.image)
          if (!url || id == null) return null
          return { id, url, label: g.alt || `Galeria ${index + 1}` }
        })
        .filter((item): item is PreviewImage => item !== null),
    [galleryItems],
  )
  const heroId = mediaId(vehicle.image)
  const displayImage =
    previewImage || (heroUrl && heroId != null ? { id: heroId, url: heroUrl, label: 'Imagen principal' } : null)
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
              onClick={() => setCropTarget({ ...displayImage, source: 'current' })}
              type="button"
            >
              Recortar
            </button>
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
              <button
                aria-label={`Recortar ${image.label}`}
                className="studio__gallery-crop"
                disabled={busy}
                onClick={() => setCropTarget({ ...image, source: 'gallery' })}
                type="button"
              >
                Recortar
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
                  const assetMediaId = mediaId(asset.media)
                  if (!url || assetMediaId == null) return null
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
                        {importing ? '…' : 'Principal'}
                      </button>
                      <button type="button" disabled={busy || importing} onClick={() => void importCandidate(candidate, 'gallery')}>
                        Galería
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
            Guardar en galeria
          </ActionButton>
          <ActionButton variant="primary" disabled={busy} onClick={() => void save('hero')}>
            Usar como principal
          </ActionButton>
        </footer>
      </section>
    </div>
  )
}

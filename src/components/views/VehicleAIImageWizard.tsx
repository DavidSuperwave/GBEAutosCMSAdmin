'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ActionButton, EmptyState, StatusBadge } from '../admin-ui/kit'
import {
  ChatContainerContent,
  ChatContainerRoot,
  ChatContainerScrollAnchor,
  Image as PromptKitImage,
  Message as PromptKitMessage,
  MessageAction,
  MessageActions,
  MessageContent,
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
  ThinkingBar,
} from '../prompt-kit'
import { buildVehicleImageMatchKey, normalizeVehicleModel } from '../../services/vehicleImageMatching'

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
  approvalStatus?: string
  media?: MediaRef
}

type Template = {
  id: number | string
  name?: string
  preset?: string
  prompt?: string
  referenceImage?: MediaRef
  description?: string
}

type JobMessage = {
  role?: 'user' | 'assistant' | 'system'
  content?: string
  createdAt?: string
  turnId?: string
}

type Output = {
  image?: MediaRef
  url?: string
  selected?: boolean
  turnId?: string
}

type Job = {
  id: number | string
  title?: string
  prompt?: string
  promptPreset?: string
  styleTemplate?: number | string | Template | null
  styleName?: string
  stylePrompt?: string
  styleReferenceUrl?: string
  status?: string
  error?: string
  messages?: JobMessage[]
  inputImages?: Array<{ image?: MediaRef }>
  outputs?: Output[]
}

type CandidateImage = {
  id: string
  label: string
  detail: string
  mediaId?: number | string
  url?: string
  source: 'hero' | 'sync' | 'gallery' | 'asset' | 'upload'
}

type StyleChoice = {
  type: 'template' | 'studio' | 'custom'
  label: string
  description?: string
  prompt?: string
  preset?: string
  url?: string
  mediaId?: number | string
  templateId?: number | string
}

type ChatReference = {
  id: number | string
  label: string
  url?: string
}

type ChatFile = {
  id: string
  canRename?: boolean
  label: string
  mediaId?: number | string
  meta: string
  output?: Output
  outputIndex?: number
  url?: string
}

const BUNDLED_STUDIO_URL = '/admin-ai/studio-turntable-reference.jpg'
const BUNDLED_STUDIO_PROMPT =
  'Clean indoor dealership turntable studio: neutral gray/white curved wall, glossy circular floor, soft overhead agency lighting, realistic reflections.'
const DEFAULT_GENERATION_PROMPT =
  'Create a clean indoor dealership turntable studio image. Preserve the exact vehicle identity and make the license plate unreadable with no visible text.'
const DEFAULT_STUDIO_STYLE: StyleChoice = {
  type: 'studio',
  label: 'Estudio turntable',
  description: 'Fondo gris/blanco, piso circular, luz de agencia.',
  prompt: BUNDLED_STUDIO_PROMPT,
  preset: 'clean_dealership_bg',
  url: BUNDLED_STUDIO_URL,
}

function mediaId(ref: MediaRef): number | string | undefined {
  if (ref == null) return undefined
  if (typeof ref === 'object') return ref.id
  return ref
}

function mediaUrl(ref: MediaRef): string | undefined {
  if (ref && typeof ref === 'object') return ref.thumbnailURL || ref.url
  return undefined
}

function mediaAlt(ref: MediaRef): string | undefined {
  if (ref && typeof ref === 'object') return ref.alt
  return undefined
}

function vehicleTitle(vehicle: VehicleLite): string {
  return `${vehicle.brand || ''} ${vehicle.model || ''} ${vehicle.year || ''}`.trim() || `Vehiculo ${vehicle.id}`
}

function uniqueCandidates(candidates: CandidateImage[]): CandidateImage[] {
  const seen = new Set<string>()
  return candidates.filter((candidate) => {
    const key = String(candidate.mediaId || candidate.url || candidate.id)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function templateToStyle(template: Template): StyleChoice {
  const name = template.name || 'Estilo guardado'
  const isBundledStudioName = name.trim().toLowerCase() === DEFAULT_STUDIO_STYLE.label.trim().toLowerCase()
  const referenceUrl = mediaUrl(template.referenceImage)
  return {
    type: 'template',
    label: name,
    description: template.description || template.prompt || 'Prompt guardado como estilo.',
    prompt: template.prompt || '',
    preset: template.preset || 'clean_dealership_bg',
    mediaId: mediaId(template.referenceImage),
    url: referenceUrl || (isBundledStudioName ? DEFAULT_STUDIO_STYLE.url : undefined),
    templateId: template.id,
  }
}

function templateDedupeKey(styleChoice: StyleChoice): string {
  return [
    styleChoice.type === 'studio' ? 'studio' : 'template',
    (styleChoice.label || '').trim().toLowerCase(),
    (styleChoice.prompt || '').trim().toLowerCase(),
  ].join('|')
}

function dedupeStyles(styles: StyleChoice[]): StyleChoice[] {
  const map = new Map<string, StyleChoice>()
  styles.forEach((styleChoice) => {
    const key = templateDedupeKey(styleChoice)
    const existing = map.get(key)
    if (!existing) {
      map.set(key, styleChoice)
      return
    }
    const existingHasImage = Boolean(existing.url || existing.mediaId)
    const nextHasImage = Boolean(styleChoice.url || styleChoice.mediaId)
    if (!existingHasImage && nextHasImage) map.set(key, styleChoice)
    else if (existingHasImage === nextHasImage && Number(styleChoice.templateId || 0) > Number(existing.templateId || 0)) map.set(key, styleChoice)
  })
  return Array.from(map.values())
}

function jobDedupeKey(job: Job): string {
  return [
    (job.styleName || job.title || '').trim().toLowerCase(),
    (job.stylePrompt || '').trim().toLowerCase(),
  ].join('|')
}

function dedupeJobs(jobs: Job[]): Job[] {
  const seen = new Set<string>()
  return jobs.filter((job) => {
    const key = jobDedupeKey(job)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function outputKey(output: Output, index: number): string {
  return String(mediaId(output.image) || output.url || index)
}

function outputUrl(output: Output): string | undefined {
  return mediaUrl(output.image) || output.url
}

function createTurnId(): string {
  return `turn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function extractDoc<T>(value: unknown): T {
  if (value && typeof value === 'object' && 'doc' in value) {
    return (value as { doc: T }).doc
  }
  return value as T
}

function compactPayload<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== '')) as T
}

async function loadCanvasImage(url: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const image = new window.Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('No se pudo preparar la imagen para recortar.'))
    image.src = url
  })
}

type ImageEditorProps = {
  busy: boolean
  cropAspect: 'free' | '16:9' | '4:3' | '1:1'
  cropZoom: number
  onClose: () => void
  onCropAspectChange: (aspect: 'free' | '16:9' | '4:3' | '1:1') => void
  onCropImport: (target: 'hero' | 'gallery') => void
  onCropZoomChange: (zoom: number) => void
  onImportOriginal: (target: 'hero' | 'gallery') => void
  onUseReference: () => void
  output: Output
  title: string
}

function ImageEditorModal({
  busy,
  cropAspect,
  cropZoom,
  onClose,
  onCropAspectChange,
  onCropImport,
  onCropZoomChange,
  onImportOriginal,
  onUseReference,
  output,
  title,
}: ImageEditorProps) {
  const url = outputUrl(output)
  if (!url) return null

  return (
    <div className="vehicle-ai-editor" role="dialog" aria-modal="true" aria-label="Editar imagen generada">
      <button className="vehicle-ai-editor__backdrop" onClick={onClose} type="button" />
      <section className="vehicle-ai-editor__panel">
        <header className="vehicle-ai-editor__header">
          <div>
            <p>Resultado generado</p>
            <h3>{title}</h3>
          </div>
          <button aria-label="Cerrar editor" onClick={onClose} type="button">
            x
          </button>
        </header>
        <div className="vehicle-ai-editor__body">
          <div className="vehicle-ai-editor__preview">
            <PromptKitImage alt={title} src={url} />
            <span style={{ transform: `scale(${cropZoom})` }} />
          </div>
          <aside className="vehicle-ai-editor__tools">
            <label>
              <span>Recorte</span>
              <div className="vehicle-ai-editor__segments">
                {(['free', '16:9', '4:3', '1:1'] as const).map((aspect) => (
                  <button
                    className={cropAspect === aspect ? 'is-active' : ''}
                    key={aspect}
                    onClick={() => onCropAspectChange(aspect)}
                    type="button"
                  >
                    {aspect === 'free' ? 'Libre' : aspect}
                  </button>
                ))}
              </div>
            </label>
            <label>
              <span>Zoom de recorte</span>
              <input
                max="2"
                min="1"
                onChange={(event) => onCropZoomChange(Number(event.target.value))}
                step="0.05"
                type="range"
                value={cropZoom}
              />
            </label>
            <div className="vehicle-ai-editor__actions">
              <button disabled={busy} onClick={() => onCropImport('gallery')} type="button">
                Recortar a galeria
              </button>
              <button disabled={busy} onClick={() => onCropImport('hero')} type="button">
                Recortar principal
              </button>
              <button disabled={busy} onClick={() => onImportOriginal('gallery')} type="button">
                Original a galeria
              </button>
              <button disabled={busy} onClick={() => onImportOriginal('hero')} type="button">
                Original principal
              </button>
              <button disabled={busy} onClick={onUseReference} type="button">
                Usar como referencia
              </button>
            </div>
          </aside>
        </div>
      </section>
    </div>
  )
}

type StyleTemplateModalProps = {
  busy: boolean
  description: string
  name: string
  onClose: () => void
  onDescriptionChange: (value: string) => void
  onNameChange: (value: string) => void
  onPromptChange: (value: string) => void
  onSave: () => void
  onSaveAndGenerate: () => void
  prompt: string
  style: StyleChoice
}

function StyleTemplateModal({
  busy,
  description,
  name,
  onClose,
  onDescriptionChange,
  onNameChange,
  onPromptChange,
  onSave,
  onSaveAndGenerate,
  prompt,
  style,
}: StyleTemplateModalProps) {
  return (
    <div className="vehicle-ai-style-modal" role="dialog" aria-modal="true" aria-label="Crear plantilla de imagen">
      <button className="vehicle-ai-style-modal__backdrop" onClick={onClose} type="button" />
      <section className="vehicle-ai-style-modal__panel">
        <header className="vehicle-ai-style-modal__header">
          <div>
            <p>Plantilla reutilizable</p>
            <h3>{style.templateId ? 'Editar plantilla' : 'Crear plantilla'}</h3>
          </div>
          <button aria-label="Cerrar plantilla" disabled={busy} onClick={onClose} type="button">
            x
          </button>
        </header>
        <div className="vehicle-ai-style-modal__body">
          <div className="vehicle-ai-style-modal__preview">
            {style.url ? <PromptKitImage src={style.url} alt="" /> : <div className="vehicle-ai-style-modal__empty-preview">Imagen</div>}
          </div>
          <div className="vehicle-ai-style-modal__form">
            <label>
              <span>Nombre de la plantilla</span>
              <input disabled={busy} onChange={(event) => onNameChange(event.target.value)} value={name} />
            </label>
            <label>
              <span>Descripcion</span>
              <input disabled={busy} onChange={(event) => onDescriptionChange(event.target.value)} value={description} />
            </label>
            <label>
              <span>Prompt guardado</span>
              <textarea disabled={busy} onChange={(event) => onPromptChange(event.target.value)} rows={8} value={prompt} />
            </label>
          </div>
        </div>
        <footer className="vehicle-ai-style-modal__footer">
          <button disabled={busy} onClick={onSave} type="button">
            Guardar cambios
          </button>
          <button disabled={busy} onClick={onSaveAndGenerate} type="button">
            Generar
          </button>
        </footer>
      </section>
    </div>
  )
}

export default function VehicleAIImageWizard({
  assets,
  onChanged,
  onClose,
  onTemplatesChanged,
  open,
  templates,
  vehicle,
}: {
  assets: Asset[]
  onChanged: () => void
  onClose: () => void
  onTemplatesChanged?: () => void
  open: boolean
  templates: Template[]
  vehicle: VehicleLite
}) {
  const sourceUploadInputRef = useRef<HTMLInputElement>(null)
  const customStyleInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState(0)
  const [selectedSourceId, setSelectedSourceId] = useState<string>('')
  const [uploadedSources, setUploadedSources] = useState<CandidateImage[]>([])
  const [style, setStyle] = useState<StyleChoice>(DEFAULT_STUDIO_STYLE)
  const [editingStyle, setEditingStyle] = useState<StyleChoice | null>(null)
  const [editingTemplateId, setEditingTemplateId] = useState<number | string | undefined>(undefined)
  const [styleDraftName, setStyleDraftName] = useState(DEFAULT_STUDIO_STYLE.label)
  const [styleDraftPrompt, setStyleDraftPrompt] = useState(DEFAULT_STUDIO_STYLE.prompt || '')
  const [styleDraftDescription, setStyleDraftDescription] = useState(DEFAULT_STUDIO_STYLE.description || '')
  const [jobs, setJobs] = useState<Job[]>([])
  const [activeJob, setActiveJob] = useState<Job | null>(null)
  const [prompt, setPrompt] = useState('')
  const [optimisticMessages, setOptimisticMessages] = useState<JobMessage[]>([])
  const [pendingTurnId, setPendingTurnId] = useState('')
  const [chatReferences, setChatReferences] = useState<ChatReference[]>([])
  const [busy, setBusy] = useState(false)
  const [generationState, setGenerationState] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedOutputs, setSelectedOutputs] = useState<Set<string>>(new Set())
  const [previewFile, setPreviewFile] = useState<ChatFile | null>(null)
  const [editingOutput, setEditingOutput] = useState<{ index: number; output: Output } | null>(null)
  const [styleModalOpen, setStyleModalOpen] = useState(false)
  const [filesOpen, setFilesOpen] = useState(false)
  const [renamingFileId, setRenamingFileId] = useState('')
  const [renameDraft, setRenameDraft] = useState('')
  const [cropAspect, setCropAspect] = useState<'free' | '16:9' | '4:3' | '1:1'>('16:9')
  const [cropZoom, setCropZoom] = useState(1)

  const effectiveStyle = style

  const styleOptions = useMemo(() => {
    const saved = dedupeStyles(templates.map(templateToStyle))
    const hasSavedBundledStudio = saved.some(
      (item) => item.label.trim().toLowerCase() === DEFAULT_STUDIO_STYLE.label.trim().toLowerCase(),
    )
    return hasSavedBundledStudio ? saved : [DEFAULT_STUDIO_STYLE, ...saved]
  }, [templates])

  const sourceImages = useMemo(() => {
    const candidates: CandidateImage[] = []
    const heroId = mediaId(vehicle.image)
    const heroUrl = mediaUrl(vehicle.image)
    const syncedImageUrl = vehicle.imageUrl || undefined
    if (syncedImageUrl) {
      const syncedMatchesHero = Boolean(heroId != null && heroUrl === syncedImageUrl)
      candidates.push({
        id: syncedMatchesHero ? `hero-${heroId}` : `synced-${vehicle.id}`,
        label: syncedMatchesHero ? 'Imagen principal' : 'Imagen sincronizada CMS',
        detail: vehicle.imageFilename || 'Imagen activa del CMS',
        mediaId: syncedMatchesHero ? heroId : undefined,
        url: syncedImageUrl,
        source: syncedMatchesHero ? 'hero' : 'sync',
      })
    } else if (heroId != null) {
      candidates.push({
        id: `hero-${heroId}`,
        label: 'Imagen principal',
        detail: 'Referencia del vehículo',
        mediaId: heroId,
        url: heroUrl,
        source: 'hero',
      })
    }
    ;(vehicle.gallery || []).forEach((item, index) => {
      const id = mediaId(item.image)
      if (id == null) return
      candidates.push({
        id: `gallery-${id}`,
        label: `Galeria ${index + 1}`,
        detail: item.alt || 'Imagen importada',
        mediaId: id,
        url: mediaUrl(item.image),
        source: 'gallery',
      })
    })
    assets.forEach((asset) => {
      const id = mediaId(asset.media)
      if (id == null) return
      candidates.push({
        id: `asset-${asset.id}-${id}`,
        label: asset.title || 'Biblioteca',
        detail: asset.sourceType || asset.approvalStatus || 'Asset del vehículo',
        mediaId: id,
        url: mediaUrl(asset.media),
        source: 'asset',
      })
    })
    return uniqueCandidates([...uploadedSources, ...candidates])
  }, [assets, uploadedSources, vehicle.gallery, vehicle.id, vehicle.image, vehicle.imageFilename, vehicle.imageUrl])

  const selectedSource = sourceImages.find((image) => image.id === selectedSourceId) || sourceImages[0]
  const outputs = activeJob?.outputs || []
  const displayedJobs = useMemo(() => dedupeJobs(jobs), [jobs])
  const persistedMessages = activeJob?.messages || []
  const visibleMessages = useMemo(() => {
    const persistedTurnIds = new Set(persistedMessages.map((message) => message.turnId).filter(Boolean))
    const pending = optimisticMessages.filter((message) => !message.turnId || !persistedTurnIds.has(message.turnId))
    return [...persistedMessages, ...pending]
  }, [optimisticMessages, persistedMessages])
  const outputsByTurn = useMemo(() => {
    const grouped = new Map<string, Array<{ output: Output; index: number }>>()
    const legacy: Array<{ output: Output; index: number }> = []
    outputs.forEach((output, index) => {
      if (!output.turnId) {
        legacy.push({ output, index })
        return
      }
      const current = grouped.get(output.turnId) || []
      current.push({ output, index })
      grouped.set(output.turnId, current)
    })
    return { grouped, legacy }
  }, [outputs])
  const legacyOutputInsertionIndex = useMemo(() => {
    const firstTurnIndex = visibleMessages.findIndex((message) => Boolean(message.turnId))
    return firstTurnIndex === -1 ? visibleMessages.length : firstTurnIndex
  }, [visibleMessages])
  const chatRailLocked = Boolean(activeJob || optimisticMessages.length || pendingTurnId)

  const attachedFiles = useMemo<ChatFile[]>(() => {
    const files: ChatFile[] = []
    if (selectedSource) {
      files.push({
        id: `source-${selectedSource.id}`,
        label: selectedSource.label,
        mediaId: selectedSource.mediaId,
        meta: selectedSource.mediaId == null ? 'Importar a Media para generar' : 'Vehiculo base',
        url: selectedSource.url,
      })
    }
    if (effectiveStyle.url || effectiveStyle.mediaId || effectiveStyle.prompt) {
      files.push({
        id: `style-${effectiveStyle.templateId || effectiveStyle.mediaId || effectiveStyle.label}`,
        label: effectiveStyle.label,
        mediaId: effectiveStyle.mediaId,
        meta: effectiveStyle.type === 'template' ? 'Estilo + prompt' : 'Estilo',
        url: effectiveStyle.url,
      })
    }
    chatReferences.forEach((reference) => {
      files.push({
        id: `chat-ref-${reference.id}`,
        canRename: true,
        label: reference.label,
        mediaId: reference.id,
        meta: 'Referencia de chat',
        url: reference.url,
      })
    })
    outputs.forEach((output, index) => {
      const url = outputUrl(output)
      if (!url) return
      files.push({
        id: `output-${outputKey(output, index)}`,
        canRename: mediaId(output.image) != null,
        label: mediaAlt(output.image) || `Resultado ${index + 1}`,
        mediaId: mediaId(output.image),
        meta: output.selected ? 'Seleccionado' : 'Generado',
        output,
        outputIndex: index,
        url,
      })
    })
    return files
  }, [chatReferences, effectiveStyle, outputs, selectedSource])

  useEffect(() => {
    if (!open) return
    document.body.classList.add('vehicle-ai-wizard-is-open')
    return () => document.body.classList.remove('vehicle-ai-wizard-is-open')
  }, [open])

  useEffect(() => {
    if (!open || selectedSourceId || sourceImages.length === 0) return
    setSelectedSourceId(sourceImages[0].id)
  }, [open, selectedSourceId, sourceImages])

  useEffect(() => {
    if (!open || style.type !== 'studio' || !styleOptions.length) return
    const first = styleOptions[0]
    if (first.type === 'template') setStyle(first)
  }, [open, style.type, styleOptions])

  const openStyleEditor = useCallback((nextStyle: StyleChoice, templateId: number | string | undefined = nextStyle.templateId) => {
    setEditingStyle(nextStyle)
    setEditingTemplateId(templateId)
    setStyleDraftName(nextStyle.label)
    setStyleDraftPrompt(nextStyle.prompt || '')
    setStyleDraftDescription(nextStyle.description || '')
    setStyleModalOpen(true)
  }, [])

  const closeStyleEditor = useCallback(() => {
    if (busy) return
    setStyleModalOpen(false)
    setEditingStyle(null)
    setEditingTemplateId(undefined)
  }, [busy])

  const loadJobs = useCallback(async () => {
    if (!open) return
    const res = await fetch(
      `/api/workshop-jobs?where[linkedVehicle][equals]=${encodeURIComponent(String(vehicle.id))}&depth=2&limit=25&sort=-updatedAt`,
      { credentials: 'include' },
    )
    if (!res.ok) return
    const data = (await res.json()) as { docs?: Job[] }
    const docs = data.docs || []
    setJobs(docs)
    setActiveJob((current) => {
      if (!current) return null
      return docs.find((job) => String(job.id) === String(current.id)) || current
    })
  }, [open, vehicle.id])

  const fetchJob = useCallback(async (jobId: number | string): Promise<Job | null> => {
    const fresh = await fetch(`/api/workshop-jobs/${jobId}?depth=2`, { credentials: 'include' })
    if (!fresh.ok) return null
    return extractDoc<Job>(await fresh.json())
  }, [])

  useEffect(() => {
    void loadJobs()
  }, [loadJobs])

  const uploadMedia = useCallback(async (file: Blob | File, alt?: string): Promise<{ id: number | string; url?: string }> => {
    const filename = file instanceof File ? file.name : alt || 'vehicle-ai-edit.jpg'
    const fd = new FormData()
    fd.append('file', file, filename)
    fd.append('_payload', JSON.stringify({ alt: alt || filename }))
    const res = await fetch('/api/media', { method: 'POST', credentials: 'include', body: fd })
    if (!res.ok) throw new Error((await res.text()).slice(0, 180))
    const data = (await res.json()) as { doc?: { id: number | string; url?: string } }
    if (!data.doc?.id) throw new Error('No se pudo guardar la imagen.')
    return { id: data.doc.id, url: data.doc.url }
  }, [])

  const recordAsset = useCallback(
    async (media: number | string, usage: 'vehicle_hero' | 'vehicle_gallery' | 'reference' = 'reference') => {
      await fetch('/api/vehicle-media-assets', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${vehicleTitle(vehicle)} IA`,
          vehicle: vehicle.id,
          media,
          sourceType: usage === 'reference' ? 'uploaded' : 'ai_generated',
          sourceProvider: usage === 'reference' ? 'admin-upload' : 'openrouter:grok-imagine-image-quality',
          usage,
          approvalStatus: usage === 'vehicle_hero' ? 'approved' : 'needs_review',
          rightsStatus: 'owned',
          matchConfidence: usage === 'reference' ? 'manual_reference' : 'generated',
          matchKey: buildVehicleImageMatchKey({
            brand: vehicle.brand,
            model: vehicle.model,
            year: vehicle.year,
            trim: vehicle.trim,
            exteriorColor: vehicle.exteriorColor,
          }),
          make: vehicle.brand,
          model: normalizeVehicleModel(vehicle.brand, vehicle.model),
          year: vehicle.year,
          trim: vehicle.trim,
          exteriorColor: vehicle.exteriorColor,
        }),
      }).catch(() => {})
    },
    [vehicle],
  )

  const handleSourceUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      setBusy(true)
      setError('')
      setNotice('')
      try {
        const media = await uploadMedia(file, file.name)
        await recordAsset(media.id, 'reference')
        const candidate: CandidateImage = {
          id: `upload-${media.id}`,
          label: file.name,
          detail: 'Referencia subida para este chat',
          mediaId: media.id,
          url: media.url || URL.createObjectURL(file),
          source: 'upload',
        }
        setUploadedSources((current) => [candidate, ...current])
        setSelectedSourceId(candidate.id)
        setNotice('Imagen de referencia lista.')
        onChanged()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo subir la imagen.')
      } finally {
        setBusy(false)
        if (sourceUploadInputRef.current) sourceUploadInputRef.current.value = ''
      }
    },
    [onChanged, recordAsset, uploadMedia],
  )

  const handleCustomStyleUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      setBusy(true)
      setError('')
      setNotice('')
      try {
        const media = await uploadMedia(file, file.name)
        await recordAsset(media.id, 'reference')
        const nextStyle: StyleChoice = {
          type: 'custom',
          label: file.name,
          description: 'Referencia personalizada subida para este chat.',
          prompt: 'Use this custom image as style/background reference only.',
          mediaId: media.id,
          url: media.url || URL.createObjectURL(file),
        }
        openStyleEditor(nextStyle, undefined)
        setNotice('Imagen de plantilla lista. Agrega el prompt y guarda para reutilizarla.')
        onChanged()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo subir la referencia.')
      } finally {
        setBusy(false)
        if (customStyleInputRef.current) customStyleInputRef.current.value = ''
      }
    },
    [onChanged, openStyleEditor, recordAsset, uploadMedia],
  )

  const createJobBody = useCallback(
    async (
      nextPrompt: string,
      styleForJob: StyleChoice = effectiveStyle,
      options?: { appendToActiveJob?: boolean; baseMessages?: JobMessage[]; turnId?: string },
    ) => {
      if (!selectedSource) throw new Error('Selecciona una imagen del vehículo.')
      if (selectedSource.mediaId == null) {
        throw new Error('Importa la imagen sincronizada a Media antes de generar con IA.')
      }
      const inputMap = new Map<string, { image: number | string }>()
      const addInput = (id?: number | string) => {
        if (id == null) return
        inputMap.set(String(id), { image: id })
      }
      addInput(selectedSource.mediaId)
      chatReferences.forEach((reference) => addInput(reference.id))

      const appendToActiveJob = options?.appendToActiveJob ?? true
      const existingMessages = options?.baseMessages || (appendToActiveJob ? activeJob?.messages || [] : [])
      const messages = [
        ...existingMessages,
        { role: 'user' as const, content: nextPrompt, createdAt: new Date().toISOString(), turnId: options?.turnId },
      ]
      return compactPayload({
        title: `${vehicleTitle(vehicle)} - ${styleForJob.label}`,
        jobType: 'vehicle_image',
        linkedVehicle: vehicle.id,
        inputImages: Array.from(inputMap.values()),
        vehicleContext: compactPayload({
          brand: vehicle.brand,
          model: vehicle.model,
          year: vehicle.year,
          color: vehicle.exteriorColor,
        }),
        aspectRatio: '16:9',
        promptPreset: styleForJob.preset || 'clean_dealership_bg',
        prompt: nextPrompt,
        messages,
        saveDestination: 'vehicle_gallery',
        styleTemplate: styleForJob.templateId,
        styleName: styleForJob.label,
        stylePrompt: styleForJob.prompt || '',
        styleReferenceUrl: styleForJob.url,
      })
    },
    [activeJob?.messages, chatReferences, effectiveStyle, selectedSource, vehicle],
  )

  const runGeneration = useCallback(
    async (
      nextPrompt: string,
      styleForJob: StyleChoice = effectiveStyle,
      options?: { createNewJob?: boolean; jobId?: number | string; baseMessages?: JobMessage[]; turnId?: string },
    ) => {
      const turnId = options?.turnId || createTurnId()
      const optimisticMessage: JobMessage = {
        role: 'user',
        content: nextPrompt,
        createdAt: new Date().toISOString(),
        turnId,
      }
      const createNewJob = Boolean(options?.createNewJob)
      const jobData = await createJobBody(nextPrompt, styleForJob, {
        appendToActiveJob: !createNewJob,
        baseMessages: options?.baseMessages,
        turnId,
      })
      setPrompt('')
      setStep(2)
      setPendingTurnId(turnId)
      setOptimisticMessages((current) =>
        current.some((message) => message.turnId === turnId) ? current : [...current, optimisticMessage],
      )
      setGenerationState('Generando imagen')
      try {
        const res = await fetch('/api/cms/workshop/generate', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: options?.jobId || (createNewJob ? undefined : activeJob?.id), jobData }),
        })
        const data = (await res.json().catch(() => ({}))) as { configured?: boolean; error?: string; jobId?: number | string }
        if (res.status === 501 || data.configured === false) {
          setNotice('Chat guardado. Configura OPENROUTER_API_KEY o AI_IMAGE_API_KEY para generar.')
        } else if (!res.ok) {
          throw new Error(data.error || 'No se pudo generar la imagen.')
        } else {
          setNotice('Imagen generada y guardada en resultados.')
        }
        setGenerationState('Actualizando chat')
        const fresh = data.jobId ? await fetchJob(data.jobId) : null
        if (fresh) {
          setActiveJob(fresh)
          setOptimisticMessages((current) => current.filter((message) => message.turnId !== turnId))
        }
        await loadJobs()
      } catch (error) {
        setOptimisticMessages((current) => current.filter((message) => message.turnId !== turnId))
        throw error
      } finally {
        setPendingTurnId((current) => (current === turnId ? '' : current))
      }
    },
    [activeJob?.id, createJobBody, effectiveStyle, fetchJob, loadJobs],
  )

  const submitPrompt = useCallback(async (overridePrompt?: string, styleForJob: StyleChoice = effectiveStyle) => {
    const nextPrompt =
      overridePrompt?.trim() ||
      prompt.trim() ||
      DEFAULT_GENERATION_PROMPT
    setBusy(true)
    setGenerationState('Guardando prompt')
    setError('')
    setNotice('')
    try {
      await runGeneration(nextPrompt, styleForJob)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar la imagen.')
    } finally {
      setBusy(false)
      setGenerationState('')
    }
  }, [effectiveStyle, prompt, runGeneration])

  const persistStyleTemplate = useCallback(async (): Promise<StyleChoice> => {
    const targetStyle = editingStyle || style
    const name = styleDraftName.trim() || targetStyle.label
    if (!name) {
      throw new Error('Escribe un nombre para guardar el estilo.')
    }
    const body = {
      name,
      preset: targetStyle.preset || 'clean_dealership_bg',
      prompt: styleDraftPrompt,
      referenceImage: targetStyle.mediaId,
      description: styleDraftDescription,
    }
    const url = editingTemplateId ? `/api/image-templates/${editingTemplateId}` : '/api/image-templates'
    const res = await fetch(url, {
      method: editingTemplateId ? 'PATCH' : 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error((await res.text()).slice(0, 180))
    const saved = templateToStyle(extractDoc<Template>(await res.json()))
    return {
      ...saved,
      mediaId: saved.mediaId || targetStyle.mediaId,
      type: saved.mediaId ? saved.type : targetStyle.type,
      url: saved.url || targetStyle.url,
    }
  }, [editingStyle, editingTemplateId, style, styleDraftDescription, styleDraftName, styleDraftPrompt])

  const saveStyleTemplate = useCallback(async () => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const saved = await persistStyleTemplate()
      setStyle(saved)
      setStyleModalOpen(false)
      setEditingStyle(null)
      setEditingTemplateId(undefined)
      setNotice('Estilo guardado y listo para usar en el chat.')
      onTemplatesChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el estilo.')
    } finally {
      setBusy(false)
    }
  }, [onTemplatesChanged, persistStyleTemplate])

  const findMatchingStyleJob = useCallback(
    (styleForJob: StyleChoice) =>
      jobs.find((job) => {
        const jobTemplateId = typeof job.styleTemplate === 'object' ? job.styleTemplate?.id : job.styleTemplate
        if (styleForJob.templateId && jobTemplateId && String(styleForJob.templateId) === String(jobTemplateId)) return true
        return (
          (job.styleName || '').trim().toLowerCase() === styleForJob.label.trim().toLowerCase() &&
          (job.stylePrompt || '').trim().toLowerCase() === (styleForJob.prompt || '').trim().toLowerCase()
        )
      }),
    [jobs],
  )

  const saveStyleAndGenerate = useCallback(async () => {
    setBusy(true)
    setGenerationState('Guardando plantilla')
    setError('')
    setNotice('')
    try {
      const saved = await persistStyleTemplate()
      setStyle(saved)
      const targetJob = findMatchingStyleJob(saved)
      setActiveJob(targetJob || null)
      setSelectedOutputs(new Set())
      setChatReferences([])
      setOptimisticMessages([])
      setPendingTurnId('')
      setFilesOpen(false)
      setStyleModalOpen(false)
      setEditingStyle(null)
      setEditingTemplateId(undefined)
      setStep(2)
      onTemplatesChanged?.()
      const nextPrompt =
        saved.prompt ||
        DEFAULT_GENERATION_PROMPT
      setGenerationState('Guardando prompt')
      await runGeneration(nextPrompt, saved, {
        createNewJob: !targetJob,
        jobId: targetJob?.id,
        baseMessages: targetJob?.messages || [],
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar y generar la imagen.')
    } finally {
      setBusy(false)
      setGenerationState('')
    }
  }, [findMatchingStyleJob, onTemplatesChanged, persistStyleTemplate, runGeneration])

  const startStyleChat = useCallback(
    async (nextStyle: StyleChoice) => {
      setBusy(true)
      setGenerationState('Preparando chat')
      setError('')
      setNotice('')
      try {
        const targetJob = findMatchingStyleJob(nextStyle)
        setStyle(nextStyle)
        setActiveJob(targetJob || null)
        setSelectedOutputs(new Set())
        setChatReferences([])
        setOptimisticMessages([])
        setFilesOpen(false)
        setStep(2)
        await runGeneration(nextStyle.prompt || DEFAULT_GENERATION_PROMPT, nextStyle, {
          createNewJob: !targetJob,
          jobId: targetJob?.id,
          baseMessages: targetJob?.messages || [],
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo iniciar el chat con este estilo.')
      } finally {
        setBusy(false)
        setGenerationState('')
      }
    },
    [findMatchingStyleJob, runGeneration],
  )

  const addToGallery = useCallback(
    async (media: number | string) => {
      const existing = (vehicle.gallery || [])
        .map((g) => mediaId(g.image))
        .filter((x): x is number | string => x != null)
        .map((image) => ({ image }))
      const alreadyExists = existing.some((item) => String(item.image) === String(media))
      const gallery = alreadyExists ? existing : [...existing, { image: media }]
      const res = await fetch(`/api/vehicles/${vehicle.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gallery }),
      })
      if (!res.ok) throw new Error((await res.text()).slice(0, 180))
    },
    [vehicle.gallery, vehicle.id],
  )

  const setHero = useCallback(
    async (media: number | string) => {
      const res = await fetch(`/api/vehicles/${vehicle.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: media, imageStatus: 'approved' }),
      })
      if (!res.ok) throw new Error((await res.text()).slice(0, 180))
    },
    [vehicle.id],
  )

  const importOutput = useCallback(
    async (output: Output, target: 'hero' | 'gallery') => {
      const id = mediaId(output.image)
      if (id == null) {
        setError('Este resultado no tiene una imagen guardada en Media.')
        return
      }
      setBusy(true)
      setError('')
      setNotice('')
      try {
        if (target === 'hero') await setHero(id)
        else await addToGallery(id)
        await recordAsset(id, target === 'hero' ? 'vehicle_hero' : 'vehicle_gallery')
        setNotice(target === 'hero' ? 'Imagen principal actualizada.' : 'Imagen agregada a la galeria.')
        onChanged()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo importar la imagen.')
      } finally {
        setBusy(false)
      }
    },
    [addToGallery, onChanged, recordAsset, setHero],
  )

  const cropAndImportOutput = useCallback(
    async (output: Output, target: 'hero' | 'gallery') => {
      const url = outputUrl(output)
      if (!url) {
        setError('Este resultado no tiene imagen para recortar.')
        return
      }
      setBusy(true)
      setError('')
      setNotice('')
      try {
        const image = await loadCanvasImage(url)
        const aspectValue =
          cropAspect === '16:9' ? 16 / 9 : cropAspect === '4:3' ? 4 / 3 : cropAspect === '1:1' ? 1 : image.naturalWidth / image.naturalHeight
        let cropWidth = image.naturalWidth / cropZoom
        let cropHeight = cropWidth / aspectValue
        if (cropHeight > image.naturalHeight / cropZoom) {
          cropHeight = image.naturalHeight / cropZoom
          cropWidth = cropHeight * aspectValue
        }
        const sourceX = (image.naturalWidth - cropWidth) / 2
        const sourceY = (image.naturalHeight - cropHeight) / 2
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(cropWidth)
        canvas.height = Math.round(cropHeight)
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('No se pudo abrir el editor de imagen.')
        ctx.drawImage(image, sourceX, sourceY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height)
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((nextBlob) => (nextBlob ? resolve(nextBlob) : reject(new Error('No se pudo guardar el recorte.'))), 'image/jpeg', 0.94)
        })
        const media = await uploadMedia(blob, `${vehicleTitle(vehicle)} recorte IA.jpg`)
        if (target === 'hero') await setHero(media.id)
        else await addToGallery(media.id)
        await recordAsset(media.id, target === 'hero' ? 'vehicle_hero' : 'vehicle_gallery')
        setEditingOutput(null)
        setNotice(target === 'hero' ? 'Recorte guardado como principal.' : 'Recorte agregado a la galeria.')
        onChanged()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo recortar la imagen.')
      } finally {
        setBusy(false)
      }
    },
    [addToGallery, cropAspect, cropZoom, onChanged, recordAsset, setHero, uploadMedia, vehicle],
  )

  const importSelectedToGallery = useCallback(async () => {
    const chosen = outputs.filter((output, index) => selectedOutputs.has(outputKey(output, index)))
    if (!chosen.length) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      for (const output of chosen) {
        const id = mediaId(output.image)
        if (id == null) continue
        await addToGallery(id)
        await recordAsset(id, 'vehicle_gallery')
      }
      setSelectedOutputs(new Set())
      setNotice(`${chosen.length} imagen(es) agregada(s) a la galeria.`)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron importar las imagenes.')
    } finally {
      setBusy(false)
    }
  }, [addToGallery, onChanged, outputs, recordAsset, selectedOutputs])

  const useOutputAsReference = useCallback((output: Output, index: number) => {
    const id = mediaId(output.image)
    if (id == null) {
      setError('Este resultado aun no esta guardado como media.')
      return
    }
    setChatReferences((current) => [
      ...current,
      { id, label: `Resultado ${index + 1}`, url: outputUrl(output) },
    ])
    setEditingOutput(null)
    setNotice('Resultado agregado como referencia para la siguiente version.')
  }, [])

  const renameChatFile = useCallback(
    async (file: ChatFile) => {
      const id = file.mediaId
      const nextName = renameDraft.trim()
      if (id == null || !nextName) return
      setBusy(true)
      setError('')
      setNotice('')
      try {
        const res = await fetch(`/api/media/${id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ alt: nextName }),
        })
        if (!res.ok) throw new Error((await res.text()).slice(0, 180))
        setChatReferences((current) =>
          current.map((reference) => (String(reference.id) === String(id) ? { ...reference, label: nextName } : reference)),
        )
        setUploadedSources((current) =>
          current.map((source) => (String(source.mediaId) === String(id) ? { ...source, label: nextName } : source)),
        )
        if (activeJob?.id) {
          const fresh = await fetchJob(activeJob.id)
          if (fresh) setActiveJob(fresh)
        }
        await loadJobs()
        setRenamingFileId('')
        setRenameDraft('')
        setNotice('Nombre de archivo actualizado.')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo renombrar el archivo.')
      } finally {
        setBusy(false)
      }
    },
    [activeJob?.id, fetchJob, loadJobs, onChanged, renameDraft],
  )

  const applyJobContext = useCallback((job: Job) => {
    const firstInput = job.inputImages?.[0]?.image
    const firstId = mediaId(firstInput)
    if (firstId != null) {
      const candidate: CandidateImage = {
        id: `job-${job.id}-${firstId}`,
        label: 'Referencia del chat',
        detail: 'Imagen usada en este chat',
        mediaId: firstId,
        url: mediaUrl(firstInput),
        source: 'upload',
      }
      setUploadedSources((current) =>
        current.some((item) => String(item.mediaId) === String(firstId)) ? current : [candidate, ...current],
      )
      setSelectedSourceId(candidate.id)
    }

    const template = job.styleTemplate && typeof job.styleTemplate === 'object' ? job.styleTemplate : null
    if (job.styleName || job.stylePrompt || job.styleReferenceUrl || template) {
      setStyle({
        type: template ? 'template' : 'custom',
        label: job.styleName || template?.name || 'Estilo guardado',
        description: template?.description || job.stylePrompt || 'Estilo usado por este chat.',
        prompt: job.stylePrompt || template?.prompt || '',
        preset: job.promptPreset || template?.preset || 'clean_dealership_bg',
        templateId: template?.id || (typeof job.styleTemplate === 'number' || typeof job.styleTemplate === 'string' ? job.styleTemplate : undefined),
        mediaId: mediaId(template?.referenceImage),
        url: mediaUrl(template?.referenceImage) || job.styleReferenceUrl,
      })
    }

    const styleId = mediaId(template?.referenceImage)
    const references = (job.inputImages || [])
      .slice(1)
      .map((input, index): ChatReference | null => {
        const id = mediaId(input.image)
        if (id == null || String(id) === String(styleId)) return null
        const url = mediaUrl(input.image)
        const label = mediaAlt(input.image) || `Referencia ${index + 1}`
        return url ? { id, label, url } : { id, label }
      })
      .filter((reference): reference is ChatReference => reference !== null)
    setChatReferences(references)
  }, [])

  const startNewChat = useCallback(() => {
    setActiveJob(null)
    setChatReferences([])
    setOptimisticMessages([])
    setPendingTurnId('')
    setPrompt('')
    setSelectedOutputs(new Set())
    setError('')
    setNotice('')
    setPreviewFile(null)
    setEditingOutput(null)
    setFilesOpen(false)
    setRenamingFileId('')
    setRenameDraft('')
    setStep(0)
  }, [])

  const renderOutputMessage = (output: Output, index: number) => {
    const id = outputKey(output, index)
    const url = outputUrl(output)
    if (!url) return null
    return (
      <PromptKitMessage key={`output-${id}`} role="assistant" className="vehicle-ai-wizard__result-message">
        <MessageContent>
          <article className={selectedOutputs.has(id) ? 'vehicle-ai-wizard__result is-selected' : 'vehicle-ai-wizard__result'}>
            <button
              aria-label="Seleccionar resultado"
              className="vehicle-ai-wizard__output-check"
              onClick={() =>
                setSelectedOutputs((prev) => {
                  const next = new Set(prev)
                  if (next.has(id)) next.delete(id)
                  else next.add(id)
                  return next
                })
              }
              type="button"
            />
            <button
              aria-label={`Editar resultado ${index + 1}`}
              className="vehicle-ai-wizard__result-image"
              onClick={() => {
                setCropAspect('16:9')
                setCropZoom(1)
                setEditingOutput({ index, output })
              }}
              type="button"
            >
              <PromptKitImage src={url} alt={`Resultado ${index + 1}`} />
            </button>
            <MessageActions className="vehicle-ai-wizard__result-actions">
              <MessageAction disabled={busy} onClick={() => void importOutput(output, 'gallery')}>
                Galeria
              </MessageAction>
              <MessageAction disabled={busy} onClick={() => void importOutput(output, 'hero')}>
                Principal
              </MessageAction>
              <MessageAction disabled={busy} onClick={() => useOutputAsReference(output, index)}>
                Referencia
              </MessageAction>
            </MessageActions>
          </article>
        </MessageContent>
      </PromptKitMessage>
    )
  }

  if (!open) return null

  return (
    <div className="vehicle-ai-wizard vehicle-ai-wizard--studio" role="dialog" aria-modal="true" aria-label="Crear imagen con IA">
      <button className="vehicle-ai-wizard__backdrop" onClick={onClose} type="button" />
      <div className="vehicle-ai-wizard__panel">
        <header className="vehicle-ai-wizard__header">
          <div>
            <p>Crear con IA</p>
            <h2>{vehicleTitle(vehicle)}</h2>
          </div>
          <button aria-label="Cerrar" onClick={onClose} type="button">
            x
          </button>
        </header>

        <div className="vehicle-ai-wizard__body">
          <aside className="vehicle-ai-wizard__rail">
            {['Imagen', 'Estilo', 'Chat'].map((label, index) => (
              <button
                key={label}
                className={`vehicle-ai-wizard__step${step === index ? ' vehicle-ai-wizard__step--active' : ''}${index < step ? ' vehicle-ai-wizard__step--done' : ''}`}
                disabled={chatRailLocked}
                onClick={() => {
                  if (chatRailLocked) return
                  setStep(index)
                }}
                title={chatRailLocked ? 'Inicia un nuevo chat para cambiar imagen o estilo.' : undefined}
                type="button"
              >
                <span>{index + 1}</span>
                {label}
              </button>
            ))}

            <div className="vehicle-ai-wizard__context">
              <strong>
                {vehicle.brand || 'Marca'} {vehicle.model || ''}
              </strong>
              <span>{vehicle.year || 's/ano'} {vehicle.exteriorColor ? `- ${vehicle.exteriorColor}` : ''}</span>
              {selectedSource?.url ? <PromptKitImage src={selectedSource.url} alt="" /> : null}
            </div>

            <div className="vehicle-ai-wizard__jobs">
              <span>Chats</span>
              <button className={!activeJob ? 'vehicle-ai-wizard__job vehicle-ai-wizard__job--active' : 'vehicle-ai-wizard__job'} onClick={startNewChat} type="button">
                Nuevo chat
              </button>
              {displayedJobs.map((job) => (
                <button
                  key={job.id}
                  className={`vehicle-ai-wizard__job${String(activeJob?.id) === String(job.id) ? ' vehicle-ai-wizard__job--active' : ''}`}
                  onClick={() => {
                    setActiveJob(job)
                    applyJobContext(job)
                    setStep(2)
                    setPrompt('')
                    setOptimisticMessages([])
                    setPendingTurnId('')
                    setSelectedOutputs(new Set())
                  }}
                  type="button"
                >
                  <strong>{job.styleName || job.title || `Trabajo ${job.id}`}</strong>
                  <small>{job.status || 'draft'}</small>
                </button>
              ))}
            </div>
          </aside>

          <main className="vehicle-ai-wizard__main">
            {error ? <div className="vehicle-ai-wizard__alert vehicle-ai-wizard__alert--error">{error}</div> : null}
            {notice ? <div className="vehicle-ai-wizard__alert">{notice}</div> : null}

            {step === 0 ? (
              <section className="vehicle-ai-wizard__section">
                <div className="vehicle-ai-wizard__section-head">
                  <h3>Selecciona imagen base</h3>
                  <ActionButton disabled={busy} onClick={() => sourceUploadInputRef.current?.click()} variant="primary">
                    Subir referencia
                  </ActionButton>
                </div>
                <input ref={sourceUploadInputRef} accept="image/*" hidden onChange={handleSourceUpload} type="file" />
                {sourceImages.length ? (
                  <div className="vehicle-ai-wizard__card-grid">
                    {sourceImages.map((image) => (
                      <button
                        key={image.id}
                        className={`vehicle-ai-wizard__image-card${selectedSourceId === image.id ? ' vehicle-ai-wizard__image-card--selected' : ''}`}
                        onClick={() => setSelectedSourceId(image.id)}
                        type="button"
                      >
                        {image.url ? <PromptKitImage src={image.url} alt="" /> : <div />}
                        <strong>{image.label}</strong>
                        <span>{image.detail}</span>
                        {image.mediaId == null ? <em>Importar a Media para generar</em> : null}
                      </button>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="Sin imagenes" message="Sube una imagen principal, agrega una a la galeria o usa Subir referencia." />
                )}
              </section>
            ) : null}

            {step === 1 ? (
              <section className="vehicle-ai-wizard__section vehicle-ai-wizard__section--style">
                <div className="vehicle-ai-wizard__section-head">
                  <div>
                    <h3>Plantillas de imagen</h3>
                    <span>Guarda una imagen de referencia con prompt para reutilizarla en otros vehículos.</span>
                  </div>
                </div>
                <input ref={customStyleInputRef} accept="image/*" hidden onChange={handleCustomStyleUpload} type="file" />
                <div className="vehicle-ai-wizard__card-grid vehicle-ai-wizard__card-grid--two">
                  <button
                    className="vehicle-ai-wizard__image-card vehicle-ai-wizard__image-card--create"
                    disabled={busy}
                    onClick={() => customStyleInputRef.current?.click()}
                    type="button"
                  >
                    <div className="vehicle-ai-wizard__upload-card">
                      <span>+</span>
                    </div>
                    <strong>Crear plantilla</strong>
                    <span>Sube una foto de ejemplo, escribe el prompt y genera el primer resultado.</span>
                  </button>
                  {styleOptions.map((option) => (
                    <button
                      key={`${option.type}-${option.templateId || option.label}`}
                      className={`vehicle-ai-wizard__image-card${style.label === option.label && style.templateId === option.templateId ? ' vehicle-ai-wizard__image-card--selected' : ''}`}
                      disabled={busy || !selectedSource?.mediaId}
                      onClick={() => {
                        void startStyleChat(option)
                      }}
                      type="button"
                    >
                      {option.url ? <PromptKitImage src={option.url} alt="" /> : <div className="vehicle-ai-wizard__upload-card">Estilo</div>}
                      <strong>{option.label}</strong>
                      <span>{option.description || 'Prompt guardado como estilo.'}</span>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {step === 2 ? (
              <section className="vehicle-ai-wizard__chat">
                <div className="vehicle-ai-wizard__chat-stage">
                  <div className="vehicle-ai-wizard__chat-topbar">
                    <div>
                      <h3>{activeJob ? activeJob.styleName || 'Chat guardado' : 'Nuevo chat'}</h3>
                      <span>{effectiveStyle.label} - {selectedSource?.label || 'Sin imagen base'}</span>
                    </div>
                    <div className="vehicle-ai-wizard__chat-actions">
                      <ActionButton disabled={busy || selectedOutputs.size === 0} onClick={() => void importSelectedToGallery()} variant="primary">
                        Importar seleccionadas
                      </ActionButton>
                      <button
                        className="vehicle-ai-wizard__files-toggle"
                        onClick={() => setFilesOpen((current) => !current)}
                        type="button"
                      >
                        Archivos <span>{attachedFiles.length}</span>
                      </button>
                    </div>
                  </div>

                  <ChatContainerRoot className="vehicle-ai-wizard__chat-scroll">
                    <ChatContainerContent>
                      <PromptKitMessage role="system" className="vehicle-ai-wizard__setup-message">
                        <MessageContent>
                          <div className="vehicle-ai-wizard__prompt-card">
                            {selectedSource?.url ? (
                              <figure>
                                <PromptKitImage src={selectedSource.url} alt="" />
                                <figcaption>Vehiculo base</figcaption>
                              </figure>
                            ) : null}
                            {effectiveStyle.url ? (
                              <figure>
                                <PromptKitImage src={effectiveStyle.url} alt="" />
                                <figcaption>Estilo</figcaption>
                              </figure>
                            ) : null}
                            <p>{effectiveStyle.prompt || 'Estilo listo para inyectarse en el prompt.'}</p>
                          </div>
                        </MessageContent>
                      </PromptKitMessage>

                      {!visibleMessages.length && outputsByTurn.legacy.map(({ output, index }) => renderOutputMessage(output, index))}

                      {visibleMessages.map((message, index) => (
                        <React.Fragment key={`${message.turnId || message.createdAt || index}-${index}`}>
                          {index === legacyOutputInsertionIndex
                            ? outputsByTurn.legacy.map(({ output, index: outputIndex }) => renderOutputMessage(output, outputIndex))
                            : null}
                          <PromptKitMessage role={message.role || 'user'}>
                            <MessageContent>
                              <p>{message.content}</p>
                            </MessageContent>
                          </PromptKitMessage>
                          {message.turnId
                            ? outputsByTurn.grouped
                                .get(message.turnId)
                                ?.map(({ output, index: outputIndex }) => renderOutputMessage(output, outputIndex))
                            : null}
                          {generationState && message.turnId === pendingTurnId ? (
                            <PromptKitMessage role="assistant">
                              <MessageContent>
                                <ThinkingBar text={generationState} />
                              </MessageContent>
                            </PromptKitMessage>
                          ) : null}
                        </React.Fragment>
                      ))}

                      {visibleMessages.length && legacyOutputInsertionIndex === visibleMessages.length
                        ? outputsByTurn.legacy.map(({ output, index }) => renderOutputMessage(output, index))
                        : null}

                      {generationState && pendingTurnId && !visibleMessages.some((message) => message.turnId === pendingTurnId) ? (
                        <PromptKitMessage role="assistant">
                          <MessageContent>
                            <ThinkingBar text={generationState} />
                          </MessageContent>
                        </PromptKitMessage>
                      ) : null}

                      {activeJob?.error ? <div className="vehicle-ai-wizard__alert vehicle-ai-wizard__alert--error">{activeJob.error}</div> : null}
                      <ChatContainerScrollAnchor />
                    </ChatContainerContent>
                  </ChatContainerRoot>

                  <PromptInput
                    className="vehicle-ai-wizard__composer"
                    isLoading={Boolean(generationState)}
                    onSubmit={() => void submitPrompt()}
                    onValueChange={setPrompt}
                    value={prompt}
                  >
                    <PromptInputTextarea placeholder="Pide otra version o ajusta detalles..." />
                    <PromptInputActions>
                      <PromptInputAction tooltip={activeJob ? 'Enviar' : 'Generar'}>
                        <button disabled={busy || !selectedSource?.mediaId} type="submit">
                          {activeJob ? 'Enviar' : 'Generar'}
                        </button>
                      </PromptInputAction>
                    </PromptInputActions>
                  </PromptInput>
                </div>

                {filesOpen ? <button aria-label="Cerrar archivos" className="vehicle-ai-wizard__files-scrim" onClick={() => setFilesOpen(false)} type="button" /> : null}
                <aside className={`vehicle-ai-wizard__files${filesOpen ? ' vehicle-ai-wizard__files--open' : ''}`}>
                  <div className="vehicle-ai-wizard__files-head">
                    <div>
                      <strong>Archivos del chat</strong>
                      <span>{attachedFiles.length} en este diseno</span>
                    </div>
                    <button aria-label="Cerrar archivos" onClick={() => setFilesOpen(false)} type="button">
                      x
                    </button>
                  </div>
                  {attachedFiles.length ? (
                    attachedFiles.map((file) => {
                      const isRenaming = renamingFileId === file.id
                      return (
                        <article key={file.id} className="vehicle-ai-wizard__file">
                          <button
                            className="vehicle-ai-wizard__file-preview"
                            onClick={() => {
                              if (file.output && typeof file.outputIndex === 'number') {
                                setCropAspect('16:9')
                                setCropZoom(1)
                                setEditingOutput({ index: file.outputIndex, output: file.output })
                              } else {
                                setPreviewFile(file)
                              }
                            }}
                            type="button"
                          >
                            {file.url ? <PromptKitImage src={file.url} alt="" /> : <span className="vehicle-ai-wizard__file-icon">IMG</span>}
                          </button>
                          <div className="vehicle-ai-wizard__file-copy">
                            {isRenaming ? (
                              <input
                                autoFocus
                                disabled={busy}
                                onChange={(event) => setRenameDraft(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') void renameChatFile(file)
                                  if (event.key === 'Escape') {
                                    setRenamingFileId('')
                                    setRenameDraft('')
                                  }
                                }}
                                value={renameDraft}
                              />
                            ) : (
                              <strong>{file.label}</strong>
                            )}
                            <span>{file.meta}</span>
                            <div className="vehicle-ai-wizard__file-actions">
                              {isRenaming ? (
                                <>
                                  <button disabled={busy || !renameDraft.trim()} onClick={() => void renameChatFile(file)} type="button">
                                    Guardar
                                  </button>
                                  <button
                                    disabled={busy}
                                    onClick={() => {
                                      setRenamingFileId('')
                                      setRenameDraft('')
                                    }}
                                    type="button"
                                  >
                                    Cancelar
                                  </button>
                                </>
                              ) : (
                                <>
                                  {file.canRename ? (
                                    <button
                                      disabled={busy}
                                      onClick={() => {
                                        setRenamingFileId(file.id)
                                        setRenameDraft(file.label)
                                      }}
                                      type="button"
                                    >
                                      Renombrar
                                    </button>
                                  ) : null}
                                  {file.output ? (
                                    <button disabled={busy} onClick={() => void importOutput(file.output as Output, 'gallery')} type="button">
                                      A galeria
                                    </button>
                                  ) : null}
                                </>
                              )}
                            </div>
                          </div>
                        </article>
                      )
                    })
                  ) : (
                    <p className="vehicle-ai-wizard__files-empty">No hay archivos adjuntos.</p>
                  )}
                </aside>
              </section>
            ) : null}
          </main>
        </div>

        <footer className="vehicle-ai-wizard__footer">
          <StatusBadge tone={selectedSource?.mediaId ? 'success' : 'warning'}>
            {selectedSource?.mediaId ? 'Imagen lista' : selectedSource ? 'Importar a Media' : 'Falta imagen'}
          </StatusBadge>
          <div>
            <ActionButton disabled={step <= 0 || busy} onClick={() => setStep((current) => Math.max(0, current - 1))} variant="secondary">
              Anterior
            </ActionButton>
            {step < 2 ? (
              <ActionButton disabled={(step === 0 && !selectedSource?.mediaId) || busy} onClick={() => setStep((current) => Math.min(2, current + 1))} variant="primary">
                Siguiente
              </ActionButton>
            ) : null}
            <ActionButton onClick={onClose} variant="secondary">
              Cerrar
            </ActionButton>
          </div>
        </footer>
      </div>

      {previewFile?.url ? (
        <div className="vehicle-ai-preview" role="dialog" aria-modal="true" aria-label="Vista previa de archivo">
          <button className="vehicle-ai-preview__backdrop" onClick={() => setPreviewFile(null)} type="button" />
          <section className="vehicle-ai-preview__panel">
            <header>
              <div>
                <p>{previewFile.meta}</p>
                <h3>{previewFile.label}</h3>
              </div>
              <button aria-label="Cerrar vista previa" onClick={() => setPreviewFile(null)} type="button">
                x
              </button>
            </header>
            <PromptKitImage src={previewFile.url} alt={previewFile.label} />
          </section>
        </div>
      ) : null}

      {styleModalOpen ? (
        <StyleTemplateModal
          busy={busy}
          description={styleDraftDescription}
          name={styleDraftName}
          onClose={closeStyleEditor}
          onDescriptionChange={setStyleDraftDescription}
          onNameChange={setStyleDraftName}
          onPromptChange={setStyleDraftPrompt}
          onSave={() => void saveStyleTemplate()}
          onSaveAndGenerate={() => void saveStyleAndGenerate()}
          prompt={styleDraftPrompt}
          style={editingStyle || style}
        />
      ) : null}

      {editingOutput ? (
        <ImageEditorModal
          busy={busy}
          cropAspect={cropAspect}
          cropZoom={cropZoom}
          onClose={() => setEditingOutput(null)}
          onCropAspectChange={setCropAspect}
          onCropImport={(target) => void cropAndImportOutput(editingOutput.output, target)}
          onCropZoomChange={setCropZoom}
          onImportOriginal={(target) => void importOutput(editingOutput.output, target)}
          onUseReference={() => useOutputAsReference(editingOutput.output, editingOutput.index)}
          output={editingOutput.output}
          title={`Resultado ${editingOutput.index + 1}`}
        />
      ) : null}
    </div>
  )
}

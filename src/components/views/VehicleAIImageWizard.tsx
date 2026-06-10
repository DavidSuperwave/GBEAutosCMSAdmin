'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ActionButton, EmptyState, StatusBadge } from '../admin-ui/kit'
import {
  ChatContainerContent,
  ChatContainerRoot,
  ChatContainerScrollAnchor,
  FileUpload,
  FileUploadContent,
  FileUploadTrigger,
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
}

type Output = {
  image?: MediaRef
  url?: string
  selected?: boolean
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
  mediaId: number | string
  url?: string
  source: 'hero' | 'gallery' | 'asset' | 'upload'
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

function mediaId(ref: MediaRef): number | string | undefined {
  if (ref == null) return undefined
  if (typeof ref === 'object') return ref.id
  return ref
}

function mediaUrl(ref: MediaRef): string | undefined {
  if (ref && typeof ref === 'object') return ref.thumbnailURL || ref.url
  return undefined
}

function vehicleTitle(vehicle: VehicleLite): string {
  return `${vehicle.brand || ''} ${vehicle.model || ''} ${vehicle.year || ''}`.trim() || `Vehiculo ${vehicle.id}`
}

function uniqueCandidates(candidates: CandidateImage[]): CandidateImage[] {
  const seen = new Set<string>()
  return candidates.filter((candidate) => {
    const key = String(candidate.mediaId)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function templateToStyle(template: Template): StyleChoice {
  return {
    type: 'template',
    label: template.name || 'Estilo guardado',
    description: template.description || template.prompt || 'Prompt guardado como estilo.',
    prompt: template.prompt || '',
    preset: template.preset || 'clean_dealership_bg',
    mediaId: mediaId(template.referenceImage),
    url: mediaUrl(template.referenceImage),
    templateId: template.id,
  }
}

function outputKey(output: Output, index: number): string {
  return String(mediaId(output.image) || output.url || index)
}

function outputUrl(output: Output): string | undefined {
  return mediaUrl(output.image) || output.url
}

function extractDoc<T>(value: unknown): T {
  if (value && typeof value === 'object' && 'doc' in value) {
    return (value as { doc: T }).doc
  }
  return value as T
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
  const [style, setStyle] = useState<StyleChoice>({
    type: 'studio',
    label: 'Estudio turntable',
    description: 'Fondo gris/blanco, piso circular, luz de agencia.',
    prompt: BUNDLED_STUDIO_PROMPT,
    preset: 'clean_dealership_bg',
    url: BUNDLED_STUDIO_URL,
  })
  const [styleDraftName, setStyleDraftName] = useState(style.label)
  const [styleDraftPrompt, setStyleDraftPrompt] = useState(style.prompt || '')
  const [styleDraftDescription, setStyleDraftDescription] = useState(style.description || '')
  const [jobs, setJobs] = useState<Job[]>([])
  const [activeJob, setActiveJob] = useState<Job | null>(null)
  const [prompt, setPrompt] = useState('')
  const [chatReferences, setChatReferences] = useState<ChatReference[]>([])
  const [busy, setBusy] = useState(false)
  const [generationState, setGenerationState] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedOutputs, setSelectedOutputs] = useState<Set<string>>(new Set())
  const [previewFile, setPreviewFile] = useState<ChatFile | null>(null)
  const [editingOutput, setEditingOutput] = useState<{ index: number; output: Output } | null>(null)
  const [cropAspect, setCropAspect] = useState<'free' | '16:9' | '4:3' | '1:1'>('16:9')
  const [cropZoom, setCropZoom] = useState(1)

  const effectiveStyle = useMemo(
    () => ({
      ...style,
      description: styleDraftDescription,
      label: styleDraftName.trim() || style.label,
      prompt: styleDraftPrompt,
    }),
    [style, styleDraftDescription, styleDraftName, styleDraftPrompt],
  )

  const styleOptions = useMemo(() => {
    const saved = templates.map(templateToStyle)
    return saved.length
      ? saved
      : [
          {
            type: 'studio' as const,
            label: 'Estudio turntable',
            description: 'Fondo gris/blanco, piso circular, luz de agencia.',
            prompt: BUNDLED_STUDIO_PROMPT,
            preset: 'clean_dealership_bg',
            url: BUNDLED_STUDIO_URL,
          },
        ]
  }, [templates])

  const sourceImages = useMemo(() => {
    const candidates: CandidateImage[] = []
    const heroId = mediaId(vehicle.image)
    if (heroId != null) {
      candidates.push({
        id: `hero-${heroId}`,
        label: 'Imagen principal',
        detail: 'Referencia del vehiculo',
        mediaId: heroId,
        url: mediaUrl(vehicle.image),
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
        detail: asset.sourceType || asset.approvalStatus || 'Asset del vehiculo',
        mediaId: id,
        url: mediaUrl(asset.media),
        source: 'asset',
      })
    })
    return uniqueCandidates([...uploadedSources, ...candidates])
  }, [assets, uploadedSources, vehicle.gallery, vehicle.image])

  const selectedSource = sourceImages.find((image) => image.id === selectedSourceId) || sourceImages[0]
  const outputs = activeJob?.outputs || []

  const attachedFiles = useMemo<ChatFile[]>(() => {
    const files: ChatFile[] = []
    if (selectedSource) {
      files.push({
        id: `source-${selectedSource.mediaId}`,
        label: selectedSource.label,
        mediaId: selectedSource.mediaId,
        meta: 'Vehiculo base',
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
        label: `Resultado ${index + 1}`,
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

  useEffect(() => {
    setStyleDraftName(style.label)
    setStyleDraftPrompt(style.prompt || '')
    setStyleDraftDescription(style.description || '')
  }, [style])

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
        setStyle({
          type: 'custom',
          label: file.name,
          description: 'Referencia personalizada subida para este chat.',
          prompt: 'Use this custom image as style/background reference only.',
          mediaId: media.id,
          url: media.url || URL.createObjectURL(file),
        })
        setNotice('Estilo personalizado listo. Edita el prompt antes de usarlo si necesitas mas control.')
        onChanged()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo subir la referencia.')
      } finally {
        setBusy(false)
        if (customStyleInputRef.current) customStyleInputRef.current.value = ''
      }
    },
    [onChanged, recordAsset, uploadMedia],
  )

  const handleChatReferenceFiles = useCallback(
    async (files: File[]) => {
      const imageFiles = files.filter((file) => file.type.startsWith('image/'))
      if (!imageFiles.length) return
      setBusy(true)
      setError('')
      setNotice('')
      try {
        const added: ChatReference[] = []
        for (const file of imageFiles) {
          const media = await uploadMedia(file, file.name)
          await recordAsset(media.id, 'reference')
          added.push({ id: media.id, label: file.name, url: media.url || URL.createObjectURL(file) })
        }
        setChatReferences((current) => [...current, ...added])
        setNotice(`${added.length} referencia(s) agregada(s) al chat.`)
        onChanged()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo adjuntar la imagen.')
      } finally {
        setBusy(false)
      }
    },
    [onChanged, recordAsset, uploadMedia],
  )

  const createJobBody = useCallback(
    async (nextPrompt: string) => {
      if (!selectedSource) throw new Error('Selecciona una imagen del vehiculo.')
      const inputMap = new Map<string, { image: number | string }>()
      const addInput = (id?: number | string) => {
        if (id == null) return
        inputMap.set(String(id), { image: id })
      }
      addInput(selectedSource.mediaId)
      addInput(effectiveStyle.mediaId)
      chatReferences.forEach((reference) => addInput(reference.id))

      const messages = [
        ...(activeJob?.messages || []),
        { role: 'user' as const, content: nextPrompt, createdAt: new Date().toISOString() },
      ]
      return {
        title: `${vehicleTitle(vehicle)} - ${effectiveStyle.label}`,
        linkedVehicle: vehicle.id,
        inputImages: Array.from(inputMap.values()),
        vehicleContext: {
          brand: vehicle.brand,
          model: vehicle.model,
          year: vehicle.year,
          color: vehicle.exteriorColor,
        },
        promptPreset: effectiveStyle.preset || 'clean_dealership_bg',
        prompt: nextPrompt,
        messages,
        saveDestination: 'vehicle_gallery',
        styleTemplate: effectiveStyle.templateId,
        styleName: effectiveStyle.label,
        stylePrompt: effectiveStyle.prompt || '',
        styleReferenceUrl: effectiveStyle.type === 'studio' ? effectiveStyle.url : undefined,
      }
    },
    [activeJob?.messages, chatReferences, effectiveStyle, selectedSource, vehicle],
  )

  const ensureJob = useCallback(
    async (nextPrompt: string): Promise<Job> => {
      const body = await createJobBody(nextPrompt)
      if (activeJob?.id) {
        const res = await fetch(`/api/workshop-jobs/${activeJob.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error((await res.text()).slice(0, 180))
        return extractDoc<Job>(await res.json())
      }
      const res = await fetch('/api/workshop-jobs', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.text()).slice(0, 180))
      return extractDoc<Job>(await res.json())
    },
    [activeJob?.id, createJobBody],
  )

  const submitPrompt = useCallback(async () => {
    const nextPrompt =
      prompt.trim() ||
      'Create a clean indoor dealership turntable studio image. Preserve the exact vehicle identity and make the license plate unreadable with no visible text.'
    setBusy(true)
    setGenerationState('Guardando prompt')
    setError('')
    setNotice('')
    try {
      const job = await ensureJob(nextPrompt)
      setActiveJob(job)
      setPrompt('')
      setStep(2)
      setGenerationState('Generando imagen')
      const res = await fetch('/api/cms/workshop/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id }),
      })
      const data = (await res.json().catch(() => ({}))) as { configured?: boolean; error?: string }
      if (res.status === 501 || data.configured === false) {
        setNotice('Chat guardado. Configura OPENROUTER_API_KEY o AI_IMAGE_API_KEY para generar.')
      } else if (!res.ok) {
        throw new Error(data.error || 'No se pudo generar la imagen.')
      } else {
        setNotice('Imagen generada y guardada en resultados.')
      }
      setGenerationState('Actualizando chat')
      const fresh = await fetchJob(job.id)
      if (fresh) setActiveJob(fresh)
      await loadJobs()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar la imagen.')
    } finally {
      setBusy(false)
      setGenerationState('')
    }
  }, [ensureJob, fetchJob, loadJobs, prompt])

  const saveStyleTemplate = useCallback(async () => {
    const name = styleDraftName.trim() || style.label
    if (!name) {
      setError('Escribe un nombre para guardar el estilo.')
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const body = {
        name,
        preset: effectiveStyle.preset || 'clean_dealership_bg',
        prompt: styleDraftPrompt,
        referenceImage: effectiveStyle.mediaId,
        description: styleDraftDescription,
      }
      const url = style.templateId ? `/api/image-templates/${style.templateId}` : '/api/image-templates'
      const res = await fetch(url, {
        method: style.templateId ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.text()).slice(0, 180))
      const saved = templateToStyle(extractDoc<Template>(await res.json()))
      setStyle(saved)
      setNotice('Estilo guardado y listo para usar en el chat.')
      onTemplatesChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el estilo.')
    } finally {
      setBusy(false)
    }
  }, [effectiveStyle, onTemplatesChanged, style.label, style.templateId, styleDraftDescription, styleDraftName, styleDraftPrompt])

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
        return url ? { id, label: `Referencia ${index + 1}`, url } : { id, label: `Referencia ${index + 1}` }
      })
      .filter((reference): reference is ChatReference => reference !== null)
    setChatReferences(references)
  }, [])

  const startNewChat = useCallback(() => {
    setActiveJob(null)
    setChatReferences([])
    setPrompt('')
    setSelectedOutputs(new Set())
    setError('')
    setNotice('')
    setPreviewFile(null)
    setEditingOutput(null)
    setStep(0)
  }, [])

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
                onClick={() => setStep(index)}
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
              {jobs.map((job) => (
                <button
                  key={job.id}
                  className={`vehicle-ai-wizard__job${String(activeJob?.id) === String(job.id) ? ' vehicle-ai-wizard__job--active' : ''}`}
                  onClick={() => {
                    setActiveJob(job)
                    applyJobContext(job)
                    setStep(2)
                    setPrompt('')
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
                  <h3>Elige estilo</h3>
                  <ActionButton disabled={busy} onClick={() => customStyleInputRef.current?.click()} variant="secondary">
                    Subir estilo
                  </ActionButton>
                </div>
                <input ref={customStyleInputRef} accept="image/*" hidden onChange={handleCustomStyleUpload} type="file" />
                <div className="vehicle-ai-wizard__style-layout">
                  <div className="vehicle-ai-wizard__card-grid vehicle-ai-wizard__card-grid--two">
                    {styleOptions.map((option) => (
                      <button
                        key={`${option.type}-${option.templateId || option.label}`}
                        className={`vehicle-ai-wizard__image-card${style.label === option.label && style.templateId === option.templateId ? ' vehicle-ai-wizard__image-card--selected' : ''}`}
                        onClick={() => setStyle(option)}
                        type="button"
                      >
                        {option.url ? <PromptKitImage src={option.url} alt="" /> : <div className="vehicle-ai-wizard__upload-card">Estilo</div>}
                        <strong>{option.label}</strong>
                        <span>{option.description || 'Prompt guardado como estilo.'}</span>
                      </button>
                    ))}
                    {style.type === 'custom' ? (
                      <button className="vehicle-ai-wizard__image-card vehicle-ai-wizard__image-card--selected" onClick={() => customStyleInputRef.current?.click()} type="button">
                        {style.url ? <PromptKitImage src={style.url} alt="" /> : <div className="vehicle-ai-wizard__upload-card">+</div>}
                        <strong>{style.label}</strong>
                        <span>{style.description}</span>
                      </button>
                    ) : null}
                  </div>
                  <aside className="vehicle-ai-wizard__style-editor">
                    <label>
                      <span>Nombre del estilo</span>
                      <input onChange={(event) => setStyleDraftName(event.target.value)} value={styleDraftName} />
                    </label>
                    <label>
                      <span>Descripcion</span>
                      <input onChange={(event) => setStyleDraftDescription(event.target.value)} value={styleDraftDescription} />
                    </label>
                    <label>
                      <span>Prompt embebido</span>
                      <textarea
                        onChange={(event) => setStyleDraftPrompt(event.target.value)}
                        rows={8}
                        value={styleDraftPrompt}
                      />
                    </label>
                    <div className="vehicle-ai-wizard__style-actions">
                      <button disabled={busy} onClick={() => setStep(2)} type="button">
                        Usar en chat
                      </button>
                      <button disabled={busy} onClick={() => void saveStyleTemplate()} type="button">
                        Guardar estilo
                      </button>
                    </div>
                  </aside>
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
                    <ActionButton disabled={busy || selectedOutputs.size === 0} onClick={() => void importSelectedToGallery()} variant="primary">
                      Importar seleccionadas
                    </ActionButton>
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

                      {(activeJob?.messages || []).map((message, index) => (
                        <PromptKitMessage key={`${message.createdAt || index}-${index}`} role={message.role || 'user'}>
                          <MessageContent>
                            <p>{message.content}</p>
                          </MessageContent>
                        </PromptKitMessage>
                      ))}

                      {generationState ? (
                        <PromptKitMessage role="assistant">
                          <MessageContent>
                            <ThinkingBar text={generationState} />
                          </MessageContent>
                        </PromptKitMessage>
                      ) : null}

                      {activeJob?.error ? <div className="vehicle-ai-wizard__alert vehicle-ai-wizard__alert--error">{activeJob.error}</div> : null}

                      {outputs.map((output, index) => {
                        const id = outputKey(output, index)
                        const url = outputUrl(output)
                        if (!url) return null
                        return (
                          <PromptKitMessage key={id} role="assistant" className="vehicle-ai-wizard__result-message">
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
                      })}

                      {!activeJob && !outputs.length ? (
                        <div className="vehicle-ai-wizard__empty-chat">
                          <strong>Listo para generar</strong>
                          <span>Escribe una instruccion o genera con el estilo seleccionado.</span>
                        </div>
                      ) : null}
                      <ChatContainerScrollAnchor />
                    </ChatContainerContent>
                  </ChatContainerRoot>

                  <FileUpload accept="image/*" disabled={busy} multiple onFilesAdded={(files) => void handleChatReferenceFiles(files)}>
                    <PromptInput
                      className="vehicle-ai-wizard__composer"
                      isLoading={Boolean(generationState)}
                      onSubmit={() => void submitPrompt()}
                      onValueChange={setPrompt}
                      value={prompt}
                    >
                      <PromptInputTextarea placeholder="Pide otra version, sube una referencia o ajusta detalles..." />
                      <PromptInputActions>
                        <PromptInputAction tooltip="Adjuntar imagen">
                          <FileUploadTrigger asChild>
                            <button aria-label="Adjuntar imagen" disabled={busy} type="button">
                              +
                            </button>
                          </FileUploadTrigger>
                        </PromptInputAction>
                        <PromptInputAction tooltip={activeJob ? 'Enviar' : 'Generar'}>
                          <button disabled={busy || !selectedSource} type="submit">
                            {generationState ? 'Pensando' : activeJob ? 'Enviar' : 'Generar'}
                          </button>
                        </PromptInputAction>
                      </PromptInputActions>
                    </PromptInput>
                    <FileUploadContent>
                      {chatReferences.length ? <span>{chatReferences.length} referencia(s) en este chat</span> : <span>Arrastra imagenes aqui para adjuntarlas</span>}
                    </FileUploadContent>
                  </FileUpload>
                </div>

                <aside className="vehicle-ai-wizard__files">
                  <div className="vehicle-ai-wizard__files-head">
                    <strong>Files in chat</strong>
                    <span>{attachedFiles.length}</span>
                  </div>
                  {attachedFiles.length ? (
                    attachedFiles.map((file) => (
                      <button
                        key={file.id}
                        className="vehicle-ai-wizard__file"
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
                        <div>
                          <strong>{file.label}</strong>
                          <span>{file.meta}</span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <p className="vehicle-ai-wizard__files-empty">No hay archivos adjuntos.</p>
                  )}
                </aside>
              </section>
            ) : null}
          </main>
        </div>

        <footer className="vehicle-ai-wizard__footer">
          <StatusBadge tone={selectedSource ? 'success' : 'warning'}>{selectedSource ? 'Imagen lista' : 'Falta imagen'}</StatusBadge>
          <div>
            <ActionButton disabled={step <= 0 || busy} onClick={() => setStep((current) => Math.max(0, current - 1))} variant="secondary">
              Anterior
            </ActionButton>
            {step < 2 ? (
              <ActionButton disabled={(step === 0 && !selectedSource) || busy} onClick={() => setStep((current) => Math.min(2, current + 1))} variant="primary">
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

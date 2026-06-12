'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ActionButton, AdminPageHeader, EmptyState, StatusBadge } from '../admin-ui/kit'
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

type MediaRef =
  | { id?: number | string; url?: string; thumbnailURL?: string; alt?: string }
  | number
  | string
  | null
  | undefined

type Vehicle = {
  id: number | string
  brand?: string
  model?: string
  year?: number
  trim?: string
  exteriorColor?: string
  image?: MediaRef
}

type Message = {
  role?: 'user' | 'assistant' | 'system'
  content?: string
  createdAt?: string
  turnId?: string
}

type Output = {
  image?: MediaRef
  selected?: boolean
  turnId?: string
  url?: string
}

type Job = {
  aspectRatio?: string
  error?: string
  id: number | string
  inputImages?: Array<{ image?: MediaRef }>
  jobType?: 'vehicle_image' | 'marketing_asset'
  messages?: Message[]
  outputs?: Output[]
  prompt?: string
  promptPreset?: string
  status?: string
  styleName?: string
  title?: string
}

type Reference = {
  id: number | string
  label: string
  source?: 'query' | 'upload' | 'output'
  url?: string
}

type Preset = {
  description: string
  label: string
  value: string
}

const PRESETS: Preset[] = [
  { label: 'Banner homepage', value: 'homepage_banner', description: 'Hero horizontal con espacio para titular y CTA.' },
  { label: 'Promo banner', value: 'promo_banner', description: 'Promoción comercial con espacio para oferta.' },
  { label: 'Anuncio redes', value: 'social_ad', description: 'Composición directa para campañas sociales.' },
  { label: 'Fondo limpio', value: 'clean_dealership_bg', description: 'Visual pulido con lenguaje de agencia.' },
  { label: 'Logo / marca', value: 'logo_overlay', description: 'Asset preparado para superposición de marca.' },
]

const ASPECT_RATIOS = [
  { label: '16:9', value: '16:9' },
  { label: '1:1', value: '1:1' },
  { label: '9:16', value: '9:16' },
  { label: '4:3', value: '4:3' },
]

function createTurnId(): string {
  return `turn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function extractDoc<T>(value: unknown): T {
  if (value && typeof value === 'object' && 'doc' in value) {
    return (value as { doc: T }).doc
  }
  return value as T
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

function outputUrl(output: Output): string | undefined {
  return mediaUrl(output.image) || output.url
}

function readParam(name: string): string {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get(name) || ''
}

function vehicleTitle(vehicle: Vehicle | null): string {
  if (!vehicle) return ''
  return `${vehicle.brand || ''} ${vehicle.model || ''} ${vehicle.year || ''}`.trim() || `Vehículo ${vehicle.id}`
}

function compactPayload<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== '')) as T
}

function jobTitleFromPrompt(prompt: string, preset: string): string {
  const presetLabel = PRESETS.find((item) => item.value === preset)?.label || 'Marketing'
  const snippet = prompt.trim().replace(/\s+/g, ' ').slice(0, 54)
  return snippet ? `${presetLabel} - ${snippet}` : `Nuevo chat de ${presetLabel.toLowerCase()}`
}

export default function MediaWorkspaceManager() {
  const uploadInputRef = useRef<HTMLInputElement>(null)

  const [vehicleId, setVehicleId] = useState('')
  const [referenceId, setReferenceId] = useState('')
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [references, setReferences] = useState<Reference[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [activeJob, setActiveJob] = useState<Job | null>(null)
  const [prompt, setPrompt] = useState('')
  const [preset, setPreset] = useState('homepage_banner')
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [generationState, setGenerationState] = useState('')
  const [notice, setNotice] = useState('')
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([])
  const [pendingTurnId, setPendingTurnId] = useState('')

  useEffect(() => {
    setVehicleId(readParam('vehicleId'))
    setReferenceId(readParam('referenceId'))
  }, [])

  const selectedPreset = PRESETS.find((item) => item.value === preset) || PRESETS[0]

  const loadVehicle = useCallback(async () => {
    if (!vehicleId) return
    const res = await fetch(`/api/vehicles/${vehicleId}?depth=1`, { credentials: 'include' })
    if (res.ok) setVehicle((await res.json()) as Vehicle)
  }, [vehicleId])

  const loadReference = useCallback(async () => {
    if (!referenceId) return
    const res = await fetch(`/api/media/${referenceId}`, { credentials: 'include' })
    if (!res.ok) return
    const media = (await res.json()) as MediaRef
    const id = mediaId(media)
    if (id == null) return
    setReferences((current) =>
      current.some((item) => String(item.id) === String(id))
        ? current
        : [{ id, label: mediaAlt(media) || 'Referencia inicial', source: 'query', url: mediaUrl(media) }, ...current],
    )
  }, [referenceId])

  const loadJobs = useCallback(async () => {
    const where = vehicleId
      ? `where[and][0][jobType][equals]=marketing_asset&where[and][1][linkedVehicle][equals]=${encodeURIComponent(vehicleId)}&`
      : 'where[jobType][equals]=marketing_asset&'
    const res = await fetch(`/api/workshop-jobs?${where}depth=2&limit=25&sort=-updatedAt`, {
      credentials: 'include',
    })
    if (!res.ok) return
    const data = (await res.json()) as { docs?: Job[] }
    const docs = data.docs || []
    setJobs(docs)
    setActiveJob((current) => {
      if (!current) return docs[0] || null
      return docs.find((job) => String(job.id) === String(current.id)) || current
    })
  }, [vehicleId])

  const fetchJob = useCallback(async (jobId: number | string): Promise<Job | null> => {
    const res = await fetch(`/api/workshop-jobs/${jobId}?depth=2`, { credentials: 'include' })
    if (!res.ok) return null
    return extractDoc<Job>(await res.json())
  }, [])

  useEffect(() => {
    void loadVehicle()
    void loadReference()
    void loadJobs()
  }, [loadVehicle, loadReference, loadJobs])

  const visibleMessages = useMemo(() => {
    const persisted = activeJob?.messages || []
    const persistedTurnIds = new Set(persisted.map((message) => message.turnId).filter(Boolean))
    const pending = optimisticMessages.filter((message) => !message.turnId || !persistedTurnIds.has(message.turnId))
    return [...persisted, ...pending]
  }, [activeJob?.messages, optimisticMessages])

  const outputsByTurn = useMemo(() => {
    const grouped = new Map<string, Array<{ index: number; output: Output }>>()
    const legacy: Array<{ index: number; output: Output }> = []
    ;(activeJob?.outputs || []).forEach((output, index) => {
      if (!output.turnId) {
        legacy.push({ index, output })
        return
      }
      const current = grouped.get(output.turnId) || []
      current.push({ index, output })
      grouped.set(output.turnId, current)
    })
    return { grouped, legacy }
  }, [activeJob?.outputs])

  async function uploadMedia(file: File): Promise<Reference> {
    const fd = new FormData()
    fd.append('file', file, file.name)
    fd.append('_payload', JSON.stringify({ alt: file.name }))
    const res = await fetch('/api/media', { method: 'POST', credentials: 'include', body: fd })
    if (!res.ok) throw new Error((await res.text()).slice(0, 180))
    const data = (await res.json()) as { doc?: { id?: number | string; url?: string; thumbnailURL?: string; alt?: string } }
    if (!data.doc?.id) throw new Error('No se pudo guardar la imagen.')
    return {
      id: data.doc.id,
      label: data.doc.alt || file.name,
      source: 'upload',
      url: data.doc.thumbnailURL || data.doc.url || URL.createObjectURL(file),
    }
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const reference = await uploadMedia(file)
      setReferences((current) => [reference, ...current])
      setNotice('Referencia agregada al chat.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir la referencia.')
    } finally {
      setBusy(false)
      if (uploadInputRef.current) uploadInputRef.current.value = ''
    }
  }

  function startNewChat() {
    setActiveJob(null)
    setPrompt('')
    setError('')
    setNotice('')
    setGenerationState('')
    setOptimisticMessages([])
    setPendingTurnId('')
  }

  function removeReference(id: number | string) {
    setReferences((current) => current.filter((item) => String(item.id) !== String(id)))
  }

  function addOutputAsReference(output: Output, index: number) {
    const id = mediaId(output.image)
    if (id == null) {
      setError('Este resultado aún no está guardado como media.')
      return
    }
    setReferences((current) =>
      current.some((item) => String(item.id) === String(id))
        ? current
        : [
            {
              id,
              label: mediaAlt(output.image) || `Resultado ${index + 1}`,
              source: 'output',
              url: outputUrl(output),
            },
            ...current,
          ],
    )
    setNotice('Resultado agregado como referencia para la siguiente generación.')
  }

  const createJobData = useCallback(
    (nextPrompt: string, turnId: string) => {
      const existingMessages = activeJob?.messages || []
      const messages = [
        ...existingMessages,
        { role: 'user' as const, content: nextPrompt, createdAt: new Date().toISOString(), turnId },
      ]
      const inputImages = references.map((reference) => ({ image: reference.id }))

      return compactPayload({
        title: activeJob?.title || jobTitleFromPrompt(nextPrompt, preset),
        jobType: 'marketing_asset',
        linkedVehicle: vehicleId || undefined,
        inputImages,
        vehicleContext: vehicle
          ? compactPayload({
              brand: vehicle.brand,
              model: vehicle.model,
              year: vehicle.year,
              color: vehicle.exteriorColor,
            })
          : undefined,
        promptPreset: preset,
        aspectRatio,
        prompt: nextPrompt,
        messages,
        saveDestination: 'media_library',
        styleName: selectedPreset.label,
        stylePrompt: selectedPreset.description,
      })
    },
    [activeJob?.messages, activeJob?.title, aspectRatio, preset, references, selectedPreset.description, selectedPreset.label, vehicle, vehicleId],
  )

  async function submitPrompt() {
    const nextPrompt = prompt.trim()
    if (!nextPrompt || busy) return
    const turnId = createTurnId()
    const optimisticMessage: Message = { role: 'user', content: nextPrompt, createdAt: new Date().toISOString(), turnId }
    setBusy(true)
    setGenerationState('Preparando generación')
    setError('')
    setNotice('')
    setPrompt('')
    setPendingTurnId(turnId)
    setOptimisticMessages((current) => [...current, optimisticMessage])
    try {
      const res = await fetch('/api/cms/workshop/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: activeJob?.id, jobData: createJobData(nextPrompt, turnId) }),
      })
      const data = (await res.json().catch(() => ({}))) as { configured?: boolean; error?: string; jobId?: number | string }
      if (res.status === 501 || data.configured === false) {
        setNotice('Chat guardado. Configura OPENROUTER_API_KEY o AI_IMAGE_API_KEY para generar imágenes.')
      } else if (!res.ok) {
        throw new Error(data.error || 'No se pudo generar la imagen.')
      } else {
        setNotice('Imagen generada y guardada en Media.')
      }
      const fresh = data.jobId ? await fetchJob(data.jobId) : activeJob?.id ? await fetchJob(activeJob.id) : null
      if (fresh) {
        setActiveJob(fresh)
        setOptimisticMessages((current) => current.filter((message) => message.turnId !== turnId))
      }
      setGenerationState('Actualizando chat')
      await loadJobs()
    } catch (err) {
      setOptimisticMessages((current) => current.filter((message) => message.turnId !== turnId))
      setError(err instanceof Error ? err.message : 'No se pudo guardar el chat.')
    } finally {
      setBusy(false)
      setGenerationState('')
      setPendingTurnId('')
    }
  }

  function renderOutput(output: Output, index: number) {
    const url = outputUrl(output)
    if (!url) return null
    return (
      <PromptKitMessage className="media-workspace__result-message" key={`${output.turnId || 'output'}-${index}`} role="assistant">
        <MessageContent>
          <article className="media-workspace__result">
            <PromptKitImage alt={`Resultado ${index + 1}`} src={url} />
            <MessageActions>
              <MessageAction onClick={() => addOutputAsReference(output, index)}>Usar como referencia</MessageAction>
              <MessageAction onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}>Abrir</MessageAction>
            </MessageActions>
          </article>
        </MessageContent>
      </PromptKitMessage>
    )
  }

  const linkedVehicleTitle = vehicleTitle(vehicle)

  return (
    <div className="admin-kit-shell media-workspace media-workspace--marketing">
      <AdminPageHeader
        title="Espacio multimedia"
        subtitle="Crea banners, promociones, anuncios y contenido visual con chat, referencias opcionales y resultados guardados en Media."
        actions={
          vehicleId ? (
            <ActionButton href={`/admin/collections/vehicles/${vehicleId}/workspace`} variant="secondary">
              Volver al vehículo
            </ActionButton>
          ) : null
        }
      />

      {error ? <div className="builder__error">{error}</div> : null}
      {notice ? <div className="workspace__notice">{notice}</div> : null}

      <div className="media-workspace__layout">
        <aside className="media-workspace__sidebar">
          <button
            className={`media-workspace__new-chat${!activeJob ? ' media-workspace__new-chat--active' : ''}`}
            onClick={startNewChat}
            type="button"
          >
            Nuevo chat
          </button>

          <section className="media-workspace__rail-section">
            <span>Contexto</span>
            {linkedVehicleTitle ? (
              <div className="media-workspace__context-card">
                {mediaUrl(vehicle?.image) ? <PromptKitImage alt="" src={mediaUrl(vehicle?.image) as string} /> : null}
                <strong>{linkedVehicleTitle}</strong>
                <small>{vehicle?.trim || vehicle?.exteriorColor || 'Vehículo opcional'}</small>
              </div>
            ) : (
              <p>Genera contenido de marketing con contexto opcional.</p>
            )}
          </section>

          <section className="media-workspace__rail-section">
            <span>Imágenes de referencia</span>
            <input ref={uploadInputRef} accept="image/*" hidden onChange={handleUpload} type="file" />
            <button className="media-workspace__upload" disabled={busy} onClick={() => uploadInputRef.current?.click()} type="button">
              Subir imagen
            </button>
            {references.length ? (
              <div className="media-workspace__references">
                {references.map((reference) => (
                  <article key={reference.id} className="media-workspace__reference">
                    {reference.url ? <PromptKitImage alt="" src={reference.url} /> : <span>IMG</span>}
                    <div>
                      <strong>{reference.label}</strong>
                      <small>{reference.source === 'output' ? 'Resultado' : 'Referencia'}</small>
                    </div>
                    <button aria-label="Quitar referencia" onClick={() => removeReference(reference.id)} type="button">
                      x
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <p>Opcional. Sube fotos, fondos o resultados para guiar la generación.</p>
            )}
          </section>

          <section className="media-workspace__rail-section media-workspace__rail-section--jobs">
            <span>Chats recientes</span>
            {jobs.length ? (
              jobs.map((job) => (
                <button
                  key={job.id}
                  className={`media-workspace__job${String(activeJob?.id) === String(job.id) ? ' media-workspace__job--active' : ''}`}
                  onClick={() => {
                    setActiveJob(job)
                    setPrompt('')
                    setOptimisticMessages([])
                    setPendingTurnId('')
                    setPreset(job.promptPreset || 'homepage_banner')
                    setAspectRatio(job.aspectRatio || '16:9')
                  }}
                  type="button"
                >
                  <strong>{job.title || `Chat ${job.id}`}</strong>
                  <span>{job.status || 'draft'}</span>
                </button>
              ))
            ) : (
              <p>Los nuevos chats de marketing aparecerán aquí.</p>
            )}
          </section>
        </aside>

        <main className="media-workspace__chat">
          <div className="media-workspace__chat-topbar">
            <div>
              <p>Generación</p>
              <h3>{activeJob?.title || 'Nuevo chat creativo'}</h3>
              <span>{selectedPreset.label} · {aspectRatio} · Galería en Media</span>
            </div>
            <StatusBadge tone={references.length ? 'success' : 'neutral'}>
              {references.length ? `${references.length} referencia(s)` : 'Texto libre'}
            </StatusBadge>
          </div>

          <div className="media-workspace__preset-bar">
            <label>
              <span>Formato</span>
              <select value={preset} onChange={(event) => setPreset(event.target.value)}>
                {PRESETS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Proporción</span>
              <select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value)}>
                {ASPECT_RATIOS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <p>{selectedPreset.description}</p>
          </div>

          <section className="media-workspace__chat-stage">
            <ChatContainerRoot className="media-workspace__chat-scroll">
              <ChatContainerContent>
                {!visibleMessages.length && !outputsByTurn.legacy.length ? (
                  <div className="media-workspace__empty-chat">
                    <EmptyState
                      title="Crea banners, promos o anuncios"
                      message="Escribe un prompt para generar un banner de homepage, pieza social, promo visual o creativo general. Puedes subir referencias, pero no son obligatorias."
                    />
                  </div>
                ) : null}

                {!visibleMessages.length ? outputsByTurn.legacy.map(({ output, index }) => renderOutput(output, index)) : null}

                {visibleMessages.map((message, index) => (
                  <React.Fragment key={`${message.turnId || message.createdAt || index}-${index}`}>
                    <PromptKitMessage role={message.role || 'user'}>
                      <MessageContent>
                        <p>{message.content}</p>
                      </MessageContent>
                    </PromptKitMessage>
                    {message.turnId
                      ? outputsByTurn.grouped.get(message.turnId)?.map(({ output, index: outputIndex }) => renderOutput(output, outputIndex))
                      : null}
                    {message.turnId === pendingTurnId && generationState ? (
                      <PromptKitMessage role="assistant">
                        <MessageContent>
                          <ThinkingBar text={generationState} />
                        </MessageContent>
                      </PromptKitMessage>
                    ) : null}
                  </React.Fragment>
                ))}

                {visibleMessages.length ? outputsByTurn.legacy.map(({ output, index }) => renderOutput(output, index)) : null}
                {activeJob?.error ? <div className="vehicle-ai-wizard__alert vehicle-ai-wizard__alert--error">{activeJob.error}</div> : null}
                <ChatContainerScrollAnchor />
              </ChatContainerContent>
            </ChatContainerRoot>

            <PromptInput
              className="media-workspace__composer"
              isLoading={Boolean(generationState)}
              onSubmit={() => void submitPrompt()}
              onValueChange={setPrompt}
              value={prompt}
            >
              <PromptInputTextarea placeholder="Describe el banner, promoción, público, estilo visual, texto que debe quedar como espacio, colores o referencias..." />
              <PromptInputActions>
                <PromptInputAction tooltip="Subir referencia">
                  <button disabled={busy} onClick={() => uploadInputRef.current?.click()} type="button">
                    +
                  </button>
                </PromptInputAction>
                <PromptInputAction tooltip="Generar">
                  <button disabled={busy || !prompt.trim()} type="submit">
                    {busy ? 'Generando' : 'Generar'}
                  </button>
                </PromptInputAction>
              </PromptInputActions>
            </PromptInput>
          </section>
        </main>
      </div>
    </div>
  )
}

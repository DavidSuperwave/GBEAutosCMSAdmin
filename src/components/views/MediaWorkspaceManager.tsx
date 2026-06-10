'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { ActionButton, AdminPageHeader, EmptyState } from '../admin-ui/kit'

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
}

type Job = {
  id: number | string
  title?: string
  prompt?: string
  promptPreset?: string
  status?: string
  error?: string
  messages?: Message[]
  outputs?: Array<{ image?: MediaRef; url?: string; selected?: boolean }>
}

function mediaUrl(ref: MediaRef): string | undefined {
  if (ref && typeof ref === 'object') return ref.thumbnailURL || ref.url
  return undefined
}

function readParam(name: string): string {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get(name) || ''
}

export default function MediaWorkspaceManager() {
  const [vehicleId, setVehicleId] = useState('')
  const [referenceId, setReferenceId] = useState('')
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [reference, setReference] = useState<MediaRef>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [activeJob, setActiveJob] = useState<Job | null>(null)
  const [prompt, setPrompt] = useState('')
  const [preset, setPreset] = useState('vehicle_hero')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    setVehicleId(readParam('vehicleId'))
    setReferenceId(readParam('referenceId'))
  }, [])

  const vehicleTitle = useMemo(() => {
    if (!vehicle) return 'Sin vehículo'
    return `${vehicle.brand || ''} ${vehicle.model || ''} ${vehicle.year || ''}`.trim() || `Vehículo ${vehicle.id}`
  }, [vehicle])

  const loadVehicle = useCallback(async () => {
    if (!vehicleId) return
    const res = await fetch(`/api/vehicles/${vehicleId}?depth=1`, { credentials: 'include' })
    if (res.ok) setVehicle((await res.json()) as Vehicle)
  }, [vehicleId])

  const loadReference = useCallback(async () => {
    if (!referenceId) return
    const res = await fetch(`/api/media/${referenceId}`, { credentials: 'include' })
    if (res.ok) setReference((await res.json()) as MediaRef)
  }, [referenceId])

  const loadJobs = useCallback(async () => {
    const where = vehicleId ? `where[linkedVehicle][equals]=${encodeURIComponent(vehicleId)}&` : ''
    const res = await fetch(`/api/workshop-jobs?${where}depth=1&limit=25&sort=-updatedAt`, {
      credentials: 'include',
    })
    if (!res.ok) return
    const data = (await res.json()) as { docs?: Job[] }
    setJobs(data.docs || [])
    setActiveJob((current) => current || data.docs?.[0] || null)
  }, [vehicleId])

  useEffect(() => {
    void loadVehicle()
    void loadReference()
    void loadJobs()
  }, [loadVehicle, loadReference, loadJobs])

  async function ensureJob(nextPrompt: string): Promise<Job> {
    const messages = [
      ...(activeJob?.messages || []),
      { role: 'user', content: nextPrompt, createdAt: new Date().toISOString() },
    ]
    const body = {
      title: vehicleTitle === 'Sin vehículo' ? 'Nuevo chat de imagen' : vehicleTitle,
      linkedVehicle: vehicleId || undefined,
      inputImages: referenceId ? [{ image: referenceId }] : [],
      vehicleContext: vehicle
        ? {
            brand: vehicle.brand,
            model: vehicle.model,
            year: vehicle.year,
            color: vehicle.exteriorColor,
          }
        : undefined,
      promptPreset: preset,
      prompt: nextPrompt,
      messages,
      saveDestination: 'vehicle_hero',
    }
    if (activeJob?.id) {
      const res = await fetch(`/api/workshop-jobs/${activeJob.id}`, {
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
    return (await res.json()).doc as Job
  }

  async function submitPrompt() {
    const nextPrompt = prompt.trim()
    if (!nextPrompt) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const job = await ensureJob(nextPrompt)
      setActiveJob(job)
      setPrompt('')
      const res = await fetch('/api/cms/workshop/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id }),
      })
      const data = (await res.json().catch(() => ({}))) as { configured?: boolean; error?: string }
      if (res.status === 501 || data.configured === false) {
        setNotice('Chat guardado. La generación se habilitará cuando AI_IMAGE_API_KEY esté configurada.')
      } else if (!res.ok) {
        throw new Error(data.error || 'No se pudo generar la imagen.')
      } else {
        setNotice('Generación enviada.')
      }
      await loadJobs()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el chat.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-kit-shell media-workspace">
      <AdminPageHeader
        title="Media Workspace"
        subtitle="Crea imágenes por vehículo con referencias, prompts y trabajos guardados."
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
          <div className="media-workspace__context">
            <strong>{vehicleTitle}</strong>
            <span>{vehicle?.trim || vehicle?.exteriorColor || 'Contexto de generación'}</span>
          </div>
          {jobs.length ? (
            jobs.map((job) => (
              <button
                key={job.id}
                type="button"
                className={`media-workspace__job${activeJob?.id === job.id ? ' media-workspace__job--active' : ''}`}
                onClick={() => setActiveJob(job)}
              >
                <strong>{job.title || `Trabajo ${job.id}`}</strong>
                <span>{job.status || 'draft'}</span>
              </button>
            ))
          ) : (
            <EmptyState title="Sin chats" message="Escribe un prompt para crear el primer trabajo." />
          )}
        </aside>

        <main className="media-workspace__chat">
          <div className="media-workspace__preview">
            {mediaUrl(vehicle?.image) ? <img src={mediaUrl(vehicle?.image)} alt="" /> : null}
            {mediaUrl(reference) ? <img src={mediaUrl(reference)} alt="Referencia" /> : null}
          </div>

          <div className="media-workspace__messages">
            {(activeJob?.messages || []).length ? (
              activeJob?.messages?.map((message, index) => (
                <div key={`${message.createdAt || index}-${index}`} className={`media-workspace__message media-workspace__message--${message.role || 'user'}`}>
                  <span>{message.role || 'user'}</span>
                  <p>{message.content}</p>
                </div>
              ))
            ) : (
              <EmptyState title="Nuevo chat de imagen" message="Describe el resultado que quieres crear para este vehículo." />
            )}
          </div>

          {activeJob?.error ? <div className="workshop-editor__banner">{activeJob.error}</div> : null}

          {activeJob?.outputs?.length ? (
            <div className="media-workspace__outputs">
              {activeJob.outputs.map((output, index) => {
                const url = mediaUrl(output.image) || output.url
                return url ? <img key={index} src={url} alt={`Resultado ${index + 1}`} /> : null
              })}
            </div>
          ) : null}

          <div className="media-workspace__composer">
            <select className="builder__select" value={preset} onChange={(event) => setPreset(event.target.value)}>
              <option value="vehicle_hero">Hero de listado</option>
              <option value="transparent_bg">Fondo transparente</option>
              <option value="clean_dealership_bg">Fondo de agencia limpio</option>
              <option value="homepage_banner">Banner de homepage</option>
              <option value="social_ad">Anuncio para redes</option>
            </select>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Describe la imagen, ángulo, fondo, iluminación y uso..."
              rows={3}
            />
            <button className="admin-kit-btn admin-kit-btn--primary" disabled={busy || !prompt.trim()} onClick={() => void submitPrompt()} type="button">
              {busy ? 'Guardando...' : 'Enviar'}
            </button>
          </div>
        </main>
      </div>
    </div>
  )
}

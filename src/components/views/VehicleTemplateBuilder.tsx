'use client'

import React, { useCallback, useEffect, useState } from 'react'

import { ActionButton, AdminPageHeader, InspectorPanel, PreviewFrame } from '../admin-ui/kit'

const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000'

type VehicleDetailTemplate = {
  showGallery?: boolean
  showPurchaseCard?: boolean
  showQuickSpecs?: boolean
  showDescription?: boolean
  showFeatures?: boolean
  showSimilarVehicles?: boolean
  showMobileCta?: boolean
  ctaHeading?: string
  ctaBody?: string
}

type Templates = {
  seminuevos?: { title?: string; intro?: string; showLocationPrompt?: boolean } | null
  vehicleDetail?: VehicleDetailTemplate | null
}

type VehicleDetailVisibilityKey = Exclude<keyof VehicleDetailTemplate, 'ctaHeading' | 'ctaBody'>

const DETAIL_VISIBILITY_FIELDS: Array<{ key: VehicleDetailVisibilityKey; label: string }> = [
  { key: 'showGallery', label: 'Mostrar galería principal' },
  { key: 'showPurchaseCard', label: 'Mostrar tarjeta de contacto' },
  { key: 'showQuickSpecs', label: 'Mostrar resumen de specs' },
  { key: 'showDescription', label: 'Mostrar descripcion' },
  { key: 'showFeatures', label: 'Mostrar caracteristicas' },
  { key: 'showSimilarVehicles', label: 'Mostrar vehículos similares' },
  { key: 'showMobileCta', label: 'Mostrar CTA movil WhatsApp' },
]

export default function VehicleTemplateBuilder() {
  const [templates, setTemplates] = useState<Templates>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [previewTarget, setPreviewTarget] = useState<'detail' | 'listing'>('listing')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/globals/site-config?depth=0', { credentials: 'include' })
      if (!res.ok) throw new Error('No se pudo cargar la configuracion.')
      const data = (await res.json()) as { templates?: Templates }
      setTemplates(data.templates || {})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/globals/site-config', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templates }),
      })
      if (!res.ok) {
        const detail = await res.text()
        throw new Error(`No se pudo guardar. ${detail.slice(0, 180)}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar.')
    } finally {
      setSaving(false)
    }
  }, [templates])

  const detail = templates.vehicleDetail || {}
  const seminuevos = templates.seminuevos || {}
  const previewUrl = previewTarget === 'detail' ? `${FRONTEND_URL}/seminuevos` : `${FRONTEND_URL}/seminuevos`

  return (
    <div className="admin-kit-shell builder">
      <AdminPageHeader
        title="Plantilla de páginas de vehículo"
        subtitle="Controles globales que aplican a la página de detalle de cada vehículo y a la página de listado de seminuevos."
        actions={
          <ActionButton onClick={() => void save()} variant="primary" disabled={loading || saving}>
            {saving ? 'Guardando...' : 'Guardar plantilla'}
          </ActionButton>
        }
      />

      {error ? <div className="builder__error">{error}</div> : null}

      <div className="builder__grid">
        <div className="builder__col builder__col--list">
          <InspectorPanel title="Página de detalle de vehículo">
            {DETAIL_VISIBILITY_FIELDS.map((field) => (
              <label className="builder__field builder__field--check" key={field.key}>
                <input
                  type="checkbox"
                  checked={detail[field.key] ?? true}
                  onChange={(event) =>
                    setTemplates((current) => ({
                      ...current,
                      vehicleDetail: { ...current.vehicleDetail, [field.key]: event.target.checked },
                    }))
                  }
                />
                <span>{field.label}</span>
              </label>
            ))}
            <label className="builder__field">
              <span>CTA titulo</span>
              <input
                type="text"
                value={detail.ctaHeading || ''}
                onChange={(event) =>
                  setTemplates((current) => ({
                    ...current,
                    vehicleDetail: { ...current.vehicleDetail, ctaHeading: event.target.value },
                  }))
                }
              />
            </label>
            <label className="builder__field">
              <span>CTA texto</span>
              <textarea
                rows={3}
                value={detail.ctaBody || ''}
                onChange={(event) =>
                  setTemplates((current) => ({
                    ...current,
                    vehicleDetail: { ...current.vehicleDetail, ctaBody: event.target.value },
                  }))
                }
              />
            </label>
          </InspectorPanel>

          <InspectorPanel title="Página de listado (seminuevos)">
            <label className="builder__field">
              <span>Titulo</span>
              <input
                type="text"
                value={seminuevos.title || ''}
                onChange={(event) =>
                  setTemplates((current) => ({
                    ...current,
                    seminuevos: { ...current.seminuevos, title: event.target.value },
                  }))
                }
              />
            </label>
            <label className="builder__field">
              <span>Introduccion</span>
              <textarea
                rows={3}
                value={seminuevos.intro || ''}
                onChange={(event) =>
                  setTemplates((current) => ({
                    ...current,
                    seminuevos: { ...current.seminuevos, intro: event.target.value },
                  }))
                }
              />
            </label>
            <label className="builder__field builder__field--check">
              <input
                type="checkbox"
                checked={Boolean(seminuevos.showLocationPrompt)}
                onChange={(event) =>
                  setTemplates((current) => ({
                    ...current,
                    seminuevos: { ...current.seminuevos, showLocationPrompt: event.target.checked },
                  }))
                }
              />
              <span>Pedir ubicación al visitante</span>
            </label>
            <p className="builder__muted">
              El contenido por vehículo se edita en la pestaña Página del espacio de trabajo de cada vehículo.
            </p>
          </InspectorPanel>
        </div>

        <div className="builder__col builder__col--preview" style={{ gridColumn: 'span 2' }}>
          <PreviewFrame
            url={previewUrl}
            device={device}
            height={680}
            toolbar={
              <>
                <button
                  type="button"
                  className={previewTarget === 'listing' ? 'is-active' : ''}
                  onClick={() => setPreviewTarget('listing')}
                >
                  Listado
                </button>
                <button
                  type="button"
                  className={previewTarget === 'detail' ? 'is-active' : ''}
                  onClick={() => setPreviewTarget('detail')}
                >
                  Detalle
                </button>
                <span className="builder__sep" />
                <button
                  type="button"
                  className={device === 'desktop' ? 'is-active' : ''}
                  onClick={() => setDevice('desktop')}
                >
                  Escritorio
                </button>
                <button
                  type="button"
                  className={device === 'mobile' ? 'is-active' : ''}
                  onClick={() => setDevice('mobile')}
                >
                  Movil
                </button>
              </>
            }
          />
        </div>
      </div>
    </div>
  )
}

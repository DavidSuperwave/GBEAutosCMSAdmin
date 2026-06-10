'use client'

import React, { useCallback, useEffect, useState } from 'react'

import { ActionButton, AdminPageHeader, InspectorPanel, PreviewFrame } from '../admin-ui/kit'

const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000'

type Templates = {
  seminuevos?: { title?: string; intro?: string; showLocationPrompt?: boolean } | null
  vehicleDetail?: { showSimilarVehicles?: boolean; ctaHeading?: string; ctaBody?: string } | null
}

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
      if (!res.ok) throw new Error('No se pudo cargar la configuración.')
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
          <>
            <ActionButton href="/admin/globals/site-config" variant="secondary">
              Edición a detalle
            </ActionButton>
            <ActionButton onClick={() => void save()} variant="primary" disabled={loading || saving}>
              {saving ? 'Guardando…' : 'Guardar plantilla'}
            </ActionButton>
          </>
        }
      />

      {error ? <div className="builder__error">{error}</div> : null}

      <div className="builder__grid">
        <div className="builder__col builder__col--list">
          <InspectorPanel title="Página de detalle de vehículo">
            <label className="builder__field builder__field--check">
              <input
                type="checkbox"
                checked={Boolean(detail.showSimilarVehicles)}
                onChange={(e) =>
                  setTemplates((t) => ({
                    ...t,
                    vehicleDetail: { ...t.vehicleDetail, showSimilarVehicles: e.target.checked },
                  }))
                }
              />
              <span>Mostrar vehículos similares</span>
            </label>
            <label className="builder__field">
              <span>CTA · Título</span>
              <input
                type="text"
                value={detail.ctaHeading || ''}
                onChange={(e) =>
                  setTemplates((t) => ({
                    ...t,
                    vehicleDetail: { ...t.vehicleDetail, ctaHeading: e.target.value },
                  }))
                }
              />
            </label>
            <label className="builder__field">
              <span>CTA · Texto</span>
              <textarea
                rows={3}
                value={detail.ctaBody || ''}
                onChange={(e) =>
                  setTemplates((t) => ({
                    ...t,
                    vehicleDetail: { ...t.vehicleDetail, ctaBody: e.target.value },
                  }))
                }
              />
            </label>
          </InspectorPanel>

          <InspectorPanel title="Página de listado (seminuevos)">
            <label className="builder__field">
              <span>Título</span>
              <input
                type="text"
                value={seminuevos.title || ''}
                onChange={(e) =>
                  setTemplates((t) => ({ ...t, seminuevos: { ...t.seminuevos, title: e.target.value } }))
                }
              />
            </label>
            <label className="builder__field">
              <span>Introducción</span>
              <textarea
                rows={3}
                value={seminuevos.intro || ''}
                onChange={(e) =>
                  setTemplates((t) => ({ ...t, seminuevos: { ...t.seminuevos, intro: e.target.value } }))
                }
              />
            </label>
            <label className="builder__field builder__field--check">
              <input
                type="checkbox"
                checked={Boolean(seminuevos.showLocationPrompt)}
                onChange={(e) =>
                  setTemplates((t) => ({
                    ...t,
                    seminuevos: { ...t.seminuevos, showLocationPrompt: e.target.checked },
                  }))
                }
              />
              <span>Pedir ubicación al visitante</span>
            </label>
            <p className="builder__muted">
              El contenido por vehículo (bloques de imagen/texto, galería, beneficios y CTA) se edita en la pestaña
              «Página» del Espacio de trabajo de cada vehículo.
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
                  Móvil
                </button>
              </>
            }
          />
        </div>
      </div>
    </div>
  )
}

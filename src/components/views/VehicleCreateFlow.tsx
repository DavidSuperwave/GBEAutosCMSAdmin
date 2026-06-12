'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { ActionButton, AdminPageHeader, AdminPageShell, PrimaryActionBar, StatusBadge } from '../admin-ui/kit'
import VehicleSpecsLookup, { type AppliedVehicleSpecs } from './VehicleSpecsLookup'

type Dealership = {
  id: string | number
  brandName?: string
  displayName?: string
  city?: string
  isActive?: boolean
}

type Draft = {
  brand: string
  model: string
  year: string
  trim: string
  condition: string
  inventoryStatus: string
  price: string
  city: string
  dealership: string
  mileage: string
  exteriorColor: string
  interiorColor: string
  description: string
  bodyType: string
  transmission: string
  fuel: string
  specs: Record<string, string>
  sourceMeta?: AppliedVehicleSpecs['sourceMeta']
}

const INITIAL_DRAFT: Draft = {
  brand: '',
  model: '',
  year: '',
  trim: '',
  condition: 'used',
  inventoryStatus: 'available',
  price: '',
  city: '',
  dealership: '',
  mileage: '',
  exteriorColor: '',
  interiorColor: '',
  description: '',
  bodyType: '',
  transmission: '',
  fuel: '',
  specs: {},
}

const BODY_TYPES = [
  ['', 'Sin definir'],
  ['sedan', 'Sedán'],
  ['suv', 'SUV'],
  ['pickup', 'Pickup'],
  ['coupe', 'Coupe'],
  ['hatchback', 'Hatchback'],
  ['van', 'Van'],
  ['other', 'Otro'],
] as const

const TRANSMISSIONS = [
  ['', 'Sin definir'],
  ['automatic', 'Automática'],
  ['manual', 'Manual'],
  ['cvt', 'CVT'],
] as const

const FUELS = [
  ['', 'Sin definir'],
  ['gasoline', 'Gasolina'],
  ['diesel', 'Diesel'],
  ['hybrid', 'Híbrido'],
  ['electric', 'Eléctrico'],
] as const

function relationshipId(value: string): string | number {
  return /^\d+$/.test(value) ? Number(value) : value
}

function formatPrice(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/[a-z$]/i.test(trimmed)) return trimmed
  const number = Number(trimmed.replace(/[^\d.]/g, ''))
  if (!Number.isFinite(number) || number <= 0) return trimmed
  return new Intl.NumberFormat('es-MX', {
    currency: 'MXN',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(number)
}

function extractCreatedId(value: unknown): string | number | undefined {
  if (!value || typeof value !== 'object') return undefined
  const obj = value as { id?: string | number; doc?: { id?: string | number } }
  return obj.doc?.id ?? obj.id
}

export default function VehicleCreateFlow() {
  const [draft, setDraft] = useState<Draft>(INITIAL_DRAFT)
  const [dealerships, setDealerships] = useState<Dealership[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadDealerships() {
      try {
        const res = await fetch('/api/dealerships?limit=200&depth=0&sort=displayName', {
          credentials: 'include',
        })
        if (!res.ok) return
        const data = (await res.json()) as { docs?: Dealership[] }
        if (!cancelled) setDealerships(data.docs || [])
      } catch {
        // The form remains usable without a dealership.
      }
    }
    void loadDealerships()
    return () => {
      cancelled = true
    }
  }, [])

  const selectedDealership = useMemo(
    () => dealerships.find((item) => String(item.id) === draft.dealership),
    [dealerships, draft.dealership],
  )

  function setField(key: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const applySpecs = useCallback((data: AppliedVehicleSpecs) => {
    setDraft((current) => ({
      ...current,
      brand: data.brand || current.brand,
      model: data.model || current.model,
      year: data.year || current.year,
      trim: data.trim || current.trim,
      bodyType: data.bodyType || current.bodyType,
      transmission: data.transmission || current.transmission,
      fuel: data.fuel || current.fuel,
      specs: { ...current.specs, ...data.specs },
      sourceMeta: data.sourceMeta,
    }))
  }, [])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      if (!draft.brand.trim() || !draft.model.trim()) {
        throw new Error('Marca y modelo son obligatorios.')
      }
      const year = draft.year.trim() ? Number(draft.year) : null
      const mileage = draft.mileage.trim() ? Number(draft.mileage) : null
      if (draft.year.trim() && !Number.isFinite(year)) throw new Error('El año debe ser numérico.')
      if (draft.mileage.trim() && !Number.isFinite(mileage)) throw new Error('El kilometraje debe ser numérico.')

      const body = {
        brand: draft.brand.trim(),
        model: draft.model.trim(),
        trim: draft.trim.trim() || null,
        year,
        condition: draft.condition,
        inventoryStatus: draft.inventoryStatus,
        publishStatus: 'draft',
        price: formatPrice(draft.price) || null,
        city: draft.city.trim() || selectedDealership?.city || null,
        dealership: draft.dealership ? relationshipId(draft.dealership) : null,
        mileage,
        exteriorColor: draft.exteriorColor.trim() || null,
        interiorColor: draft.interiorColor.trim() || null,
        description: draft.description.trim() || null,
        bodyType: draft.bodyType || null,
        transmission: draft.transmission || null,
        fuel: draft.fuel || null,
        specs: draft.specs,
        specStatus: draft.sourceMeta ? 'matched' : 'manual',
        sourceMeta: draft.sourceMeta || { specSource: 'manual' },
      }

      const res = await fetch('/api/vehicles', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error((data as { errors?: unknown; message?: string })?.message || 'No se pudo crear el vehículo.')
      }
      const id = extractCreatedId(data)
      if (!id) throw new Error('El vehículo se creó sin ID.')
      setNotice('Vehículo creado. Abriendo workspace...')
      window.location.href = `/admin/collections/vehicles/${id}/workspace`
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear vehículo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminPageShell className="vehicle-create">
      <AdminPageHeader
        title="Nuevo vehículo"
        subtitle="Crea un borrador rápido, opcionalmente autocompleta specs y termina imágenes/página en el workspace."
        actions={
          <>
            <ActionButton href="/admin/inventory" variant="secondary">
              Volver al inventario
            </ActionButton>
            <StatusBadge tone="info">Borrador</StatusBadge>
          </>
        }
      />

      {error ? <div className="builder__error">{error}</div> : null}
      {notice ? <div className="builder__notice">{notice}</div> : null}

      <form className="vehicle-create__layout" onSubmit={submit}>
        <section className="vehicle-create__panel">
          <h3>Datos principales</h3>
          <div className="vehicle-create__grid">
            <label className="builder__field">
              <span>Marca</span>
              <input value={draft.brand} onChange={(event) => setField('brand', event.target.value)} required />
            </label>
            <label className="builder__field">
              <span>Modelo</span>
              <input value={draft.model} onChange={(event) => setField('model', event.target.value)} required />
            </label>
            <label className="builder__field">
              <span>Año</span>
              <input inputMode="numeric" value={draft.year} onChange={(event) => setField('year', event.target.value)} />
            </label>
            <label className="builder__field">
              <span>Versión / trim</span>
              <input value={draft.trim} onChange={(event) => setField('trim', event.target.value)} />
            </label>
            <label className="builder__field">
              <span>Condición</span>
              <select value={draft.condition} onChange={(event) => setField('condition', event.target.value)}>
                <option value="used">Seminuevo</option>
                <option value="new">Nuevo</option>
              </select>
            </label>
            <label className="builder__field">
              <span>Estatus</span>
              <select value={draft.inventoryStatus} onChange={(event) => setField('inventoryStatus', event.target.value)}>
                <option value="available">Disponible</option>
                <option value="reserved">Apartado</option>
                <option value="sold">Vendido</option>
              </select>
            </label>
            <label className="builder__field">
              <span>Precio</span>
              <input value={draft.price} onChange={(event) => setField('price', event.target.value)} placeholder="345000" />
            </label>
            <label className="builder__field">
              <span>Kilometraje</span>
              <input inputMode="numeric" value={draft.mileage} onChange={(event) => setField('mileage', event.target.value)} />
            </label>
            <label className="builder__field">
              <span>Agencia</span>
              <select
                value={draft.dealership}
                onChange={(event) => {
                  const dealership = dealerships.find((item) => String(item.id) === event.target.value)
                  setDraft((current) => ({
                    ...current,
                    dealership: event.target.value,
                    city: dealership?.city || current.city,
                  }))
                }}
              >
                <option value="">Sin agencia</option>
                {dealerships.map((dealership) => (
                  <option key={dealership.id} value={String(dealership.id)}>
                    {dealership.displayName || dealership.brandName || dealership.id}
                    {dealership.city ? ` - ${dealership.city}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="builder__field">
              <span>Ciudad</span>
              <input value={draft.city} onChange={(event) => setField('city', event.target.value)} />
            </label>
            <label className="builder__field">
              <span>Color exterior</span>
              <input value={draft.exteriorColor} onChange={(event) => setField('exteriorColor', event.target.value)} />
            </label>
            <label className="builder__field">
              <span>Color interior</span>
              <input value={draft.interiorColor} onChange={(event) => setField('interiorColor', event.target.value)} />
            </label>
          </div>
          <label className="builder__field">
            <span>Descripción</span>
            <textarea rows={4} value={draft.description} onChange={(event) => setField('description', event.target.value)} />
          </label>
        </section>

        <section className="vehicle-create__panel">
          <h3>Especificaciones visibles</h3>
          <div className="vehicle-create__grid vehicle-create__grid--three">
            <label className="builder__field">
              <span>Tipo de carrocería</span>
              <select value={draft.bodyType} onChange={(event) => setField('bodyType', event.target.value)}>
                {BODY_TYPES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="builder__field">
              <span>Transmisión</span>
              <select value={draft.transmission} onChange={(event) => setField('transmission', event.target.value)}>
                {TRANSMISSIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="builder__field">
              <span>Combustible</span>
              <select value={draft.fuel} onChange={(event) => setField('fuel', event.target.value)}>
                {FUELS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <VehicleSpecsLookup
            defaultMake={draft.brand}
            defaultModel={draft.model}
            defaultYear={draft.year}
            onApply={applySpecs}
          />
        </section>

        <PrimaryActionBar>
          <ActionButton href="/admin/inventory" variant="secondary">
            Cancelar
          </ActionButton>
          <ActionButton type="submit" variant="primary" disabled={saving}>
            {saving ? 'Creando...' : 'Crear borrador y abrir workspace'}
          </ActionButton>
        </PrimaryActionBar>
      </form>
    </AdminPageShell>
  )
}

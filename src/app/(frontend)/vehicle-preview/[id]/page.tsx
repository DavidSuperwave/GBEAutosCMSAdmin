import React from 'react'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@payload-config'
import { hasRole } from '../../../../access/roles'
import { toPublicVehicleDetail } from '../../../../services/publicVehicleCatalog'

type RouteContext = {
  params: Promise<{ id: string }>
}

type JsonRecord = Record<string, unknown>

function text(value: unknown): string {
  return String(value ?? '').trim()
}

function numberValue(value: unknown): number | undefined {
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function mediaUrl(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const media = value as { url?: string; thumbnailURL?: string }
  return text(media.url || media.thumbnailURL)
}

function relationDoc(value: unknown): JsonRecord {
  return value && typeof value === 'object' ? (value as JsonRecord) : {}
}

function titleFor(vehicle: JsonRecord): string {
  return text(vehicle.title) || [vehicle.year, vehicle.brand, vehicle.model, vehicle.trim].map(text).filter(Boolean).join(' ')
}

function renderBlock(block: JsonRecord, index: number) {
  const blockType = text(block.blockType)
  const heading = text(block.heading)
  const body = text(block.body)

  if (blockType === 'imageText') {
    const image = mediaUrl(block.image)
    const imageAlt = text(relationDoc(block.image).alt) || heading
    return (
      <section className="vehicle-preview__section vehicle-preview__split" key={text(block.id) || index}>
        {image ? <img alt={imageAlt} src={image} /> : null}
        <div>
          {text(block.eyebrow) ? <p className="vehicle-preview__eyebrow">{text(block.eyebrow)}</p> : null}
          {heading ? <h2>{heading}</h2> : null}
          {body ? <p>{body}</p> : null}
        </div>
      </section>
    )
  }

  if (blockType === 'gallery') {
    const images = Array.isArray(block.images) ? block.images : []
    return (
      <section className="vehicle-preview__section" key={text(block.id) || index}>
        {heading ? <h2>{heading}</h2> : null}
        <div className="vehicle-preview__gallery">
          {images.map((item, imageIndex) => {
            const itemRecord = relationDoc(item)
            const image = mediaUrl(itemRecord.image)
            return image ? (
              <img alt={text(itemRecord.alt || heading)} key={`${image}-${imageIndex}`} src={image} />
            ) : null
          })}
        </div>
      </section>
    )
  }

  if (blockType === 'highlightList') {
    const items = Array.isArray(block.items) ? block.items : []
    return (
      <section className="vehicle-preview__section" key={text(block.id) || index}>
        {heading ? <h2>{heading}</h2> : null}
        {body ? <p>{body}</p> : null}
        <div className="vehicle-preview__list">
          {items.map((item, itemIndex) => {
            const itemRecord = relationDoc(item)
            return (
              <article key={`${text(itemRecord.label)}-${itemIndex}`}>
                <strong>{text(itemRecord.label) || `Punto ${itemIndex + 1}`}</strong>
                {text(itemRecord.description) ? <p>{text(itemRecord.description)}</p> : null}
              </article>
            )
          })}
        </div>
      </section>
    )
  }

  if (blockType === 'featureGrid') {
    // Serialized featureGrid items are plain strings (see serializePublicLandingBlocks).
    const items = Array.isArray(block.items) ? block.items.map(text).filter(Boolean) : []
    return (
      <section className="vehicle-preview__section" key={text(block.id) || index}>
        {heading ? <h2>{heading}</h2> : null}
        <div className="vehicle-preview__features">
          {items.map((item, itemIndex) => (
            <span key={`${item}-${itemIndex}`}>{item}</span>
          ))}
        </div>
      </section>
    )
  }

  if (blockType === 'cta') {
    return (
      <section className="vehicle-preview__section vehicle-preview__cta" key={text(block.id) || index}>
        {heading ? <h2>{heading}</h2> : null}
        {body ? <p>{body}</p> : null}
        <button type="button">{text(block.buttonLabel) || 'Consultar por WhatsApp'}</button>
      </section>
    )
  }

  return null
}

export default async function VehiclePreviewPage({ params }: RouteContext) {
  const { id } = await params
  const payload = await getPayload({ config })

  const authResult = await payload.auth({ canSetHeaders: false, headers: await headers() })
  if (!authResult.user || !hasRole(authResult.user, 'admin', 'inventory_manager', 'content_editor')) {
    notFound()
  }

  const rawVehicle = (await payload
    .findByID({ collection: 'vehicles', id, depth: 2, overrideAccess: true })
    .catch(() => null)) as JsonRecord | null

  if (!rawVehicle) notFound()

  const vehicle = (await toPublicVehicleDetail(payload, rawVehicle)) as JsonRecord
  const title = titleFor(vehicle)
  const image = mediaUrl(vehicle.image)
  const landing = Array.isArray(vehicle.landing) ? (vehicle.landing as JsonRecord[]) : []
  const gallery = Array.isArray(vehicle.gallery) ? (vehicle.gallery as JsonRecord[]) : []
  const features = Array.isArray(vehicle.features) ? vehicle.features : []
  const mileage = numberValue(vehicle.mileage)

  return (
    <main className="vehicle-preview">
      <section className="vehicle-preview__hero">
        <div>
          <p className="vehicle-preview__eyebrow">
            {vehicle.condition === 'used' ? 'Seminuevo' : 'Nuevo'} / {text(vehicle.city) || 'Sin ciudad'}
          </p>
          <h1>{title || 'Vehiculo'}</h1>
          <dl>
            <div>
              <dt>Precio</dt>
              <dd>{text(vehicle.priceLabel) || 'Precio a consultar'}</dd>
            </div>
            <div>
              <dt>Agencia</dt>
              <dd>{text(vehicle.agencyName) || 'Sin agencia'}</dd>
            </div>
            <div>
              <dt>Kilometraje</dt>
              <dd>{mileage ? `${mileage.toLocaleString('es-MX')} km` : 'Por confirmar'}</dd>
            </div>
          </dl>
        </div>
        {image ? <img alt={title} src={image} /> : <div className="vehicle-preview__placeholder">Sin imagen</div>}
      </section>

      {text(vehicle.description) ? (
        <section className="vehicle-preview__section">
          <h2>Descripcion</h2>
          <p>{text(vehicle.description)}</p>
        </section>
      ) : null}

      {features.length ? (
        <section className="vehicle-preview__section">
          <h2>Caracteristicas</h2>
          <div className="vehicle-preview__features">
            {features.map((item, index) => {
              return <span key={`${text(item)}-${index}`}>{text(item)}</span>
            })}
          </div>
        </section>
      ) : null}

      {gallery.length ? (
        <section className="vehicle-preview__section">
          <h2>Galeria</h2>
          <div className="vehicle-preview__gallery">
            {gallery.map((item, index) => {
              const itemRecord = relationDoc(item)
              const url = text(itemRecord.url) || mediaUrl(itemRecord.image)
              return url ? <img alt={text(itemRecord.alt || title)} key={`${url}-${index}`} src={url} /> : null
            })}
          </div>
        </section>
      ) : null}

      {landing.map(renderBlock)}
    </main>
  )
}

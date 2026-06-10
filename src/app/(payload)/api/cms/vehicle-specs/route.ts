import { NextResponse } from 'next/server'

/**
 * Admin-owned vehicle specs service (Phase 4 — Specs Service Migration).
 *
 * Previously the admin Vehicle Lookup field called the public website for spec
 * data. This route brings the integration into the admin/API project so the
 * lookup no longer depends on the public site. It proxies the RapidAPI
 * "Car Specs" API (car-specs.p.rapidapi.com) and normalizes responses into the
 * shape the admin UI expects.
 */

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || ''
const RAPIDAPI_HOST = process.env.RAPIDAPI_VEHICLE_SPECS_HOST || 'car-specs.p.rapidapi.com'
const API_BASE = `https://${RAPIDAPI_HOST}`

type Json = Record<string, unknown>

function str(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

async function rapid<T>(path: string): Promise<T> {
  if (!RAPIDAPI_KEY) {
    throw new Error('RAPIDAPI_KEY no está configurada en el servidor admin.')
  }
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'X-RapidAPI-Key': RAPIDAPI_KEY,
      'X-RapidAPI-Host': RAPIDAPI_HOST,
    },
    // Spec catalog data is stable; cache for an hour.
    next: { revalidate: 3600 },
  })
  if (!response.ok) {
    throw new Error(`Car Specs API respondió ${response.status}`)
  }
  return (await response.json()) as T
}

function asArray(data: unknown): Json[] {
  if (Array.isArray(data)) return data as Json[]
  if (data && typeof data === 'object') {
    const obj = data as Json
    for (const key of ['data', 'results', 'items']) {
      if (Array.isArray(obj[key])) return obj[key] as Json[]
    }
  }
  return []
}

function mapMake(item: Json) {
  return { id: item.id ?? item.makeId ?? item.value, name: str(item.name ?? item.make ?? item.label) }
}

function mapModel(item: Json) {
  return { id: item.id ?? item.modelId ?? item.value, name: str(item.name ?? item.model ?? item.label) }
}

function mapGeneration(item: Json) {
  const yearFrom = Number(item.yearFrom ?? item.yearBegin ?? item.startYear ?? item.year_start)
  const yearTo = Number(item.yearTo ?? item.yearEnd ?? item.endYear ?? item.year_end)
  return {
    id: item.id ?? item.generationId ?? item.value,
    name: str(item.name ?? item.generation ?? item.label),
    yearFrom: Number.isFinite(yearFrom) ? yearFrom : undefined,
    yearTo: Number.isFinite(yearTo) ? yearTo : undefined,
  }
}

function mapTrim(item: Json) {
  return {
    id: item.id ?? item.trimId ?? item.value,
    name: str(item.trim ?? item.name ?? item.series ?? item.label),
    trim: str(item.trim),
    series: str(item.series),
    bodyType: str(item.bodyType),
  }
}

function mapTrimSpecs(raw: Json) {
  const specs = {
    tipo: str(raw.bodyType),
    motor: str(raw.engineType ?? raw.engine),
    potencia: str(raw.engineHp ? `${raw.engineHp} hp` : raw.maxPowerKw ? `${raw.maxPowerKw} kW` : ''),
    transmision: str(raw.transmission),
    combustible: str(raw.engineType ?? raw.fuelType),
    traccion: str(raw.driveWheels ?? raw.drive),
    cylinders: str(raw.numberOfCylinders ?? raw.cylinders),
    seats: str(raw.numberOfSeats ?? raw.seats),
    doors: str(raw.numberOfDoors ?? raw.doors),
    lengthMm: str(raw.lengthMm),
    widthMm: str(raw.widthMm),
    heightMm: str(raw.heightMm),
    wheelbaseMm: str(raw.wheelbaseMm),
    maxTrunkCapacityL: str(raw.maxTrunkCapacityL ?? raw.maximumTrunkCapacityL),
    torqueNm: str(raw.maximumTorqueNM ?? raw.torqueNm),
    fuelTankCapacityL: str(raw.fuelTankCapacityL),
  }

  return {
    specs,
    raw: {
      id: raw.id,
      make: str(raw.make),
      model: str(raw.model),
      generation: str(raw.generation),
      transmission: str(raw.transmission),
      engineType: str(raw.engineType),
      trim: str(raw.trim),
      series: str(raw.series),
      bodyType: str(raw.bodyType),
    },
    source: 'rapidapi' as const,
    lastSpecSyncAt: new Date().toISOString(),
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  try {
    switch (action) {
      case 'makes': {
        const data = await rapid<unknown>('/cars/makes')
        return NextResponse.json({ makes: asArray(data).map(mapMake) })
      }
      case 'models': {
        const makeId = searchParams.get('makeId')
        if (!makeId) return NextResponse.json({ error: 'makeId requerido' }, { status: 400 })
        const data = await rapid<unknown>(`/cars/makes/${encodeURIComponent(makeId)}/models`)
        return NextResponse.json({ models: asArray(data).map(mapModel) })
      }
      case 'generations': {
        const modelId = searchParams.get('modelId')
        if (!modelId) return NextResponse.json({ error: 'modelId requerido' }, { status: 400 })
        const data = await rapid<unknown>(`/cars/models/${encodeURIComponent(modelId)}/generations`)
        return NextResponse.json({ generations: asArray(data).map(mapGeneration) })
      }
      case 'trims': {
        const generationId = searchParams.get('generationId')
        if (!generationId) return NextResponse.json({ error: 'generationId requerido' }, { status: 400 })
        const data = await rapid<unknown>(`/cars/generations/${encodeURIComponent(generationId)}/trims`)
        return NextResponse.json({ trims: asArray(data).map(mapTrim) })
      }
      case 'trimSpecs': {
        const trimId = searchParams.get('trimId')
        if (!trimId) return NextResponse.json({ error: 'trimId requerido' }, { status: 400 })
        const data = await rapid<Json>(`/cars/trims/${encodeURIComponent(trimId)}`)
        const payload = Array.isArray(data) ? (data[0] as Json) : data
        return NextResponse.json(mapTrimSpecs(payload || {}))
      }
      default:
        return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al consultar especificaciones'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

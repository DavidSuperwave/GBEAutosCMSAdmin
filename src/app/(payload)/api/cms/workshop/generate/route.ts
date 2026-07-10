import { NextResponse } from 'next/server'

import { requireCmsRole } from '../../../../../../services/cmsRequestAuth'

/**
 * AI Workshop generation endpoint.
 *
 * Runs image generation server-side through OpenRouter/Grok so provider keys
 * never reach the browser. The generated images are saved into Payload Media
 * and appended to the workshop job outputs for review/import.
 */

const AI_IMAGE_API_KEY = process.env.OPENROUTER_API_KEY || process.env.AI_IMAGE_API_KEY || ''
const AI_IMAGE_WIZARD_SERVER_ENABLED =
  process.env.ENABLE_AI_IMAGE_WIZARD === 'true' || process.env.NEXT_PUBLIC_ENABLE_AI_IMAGE_WIZARD === 'true'
const OPENROUTER_MODEL = process.env.AI_IMAGE_MODEL || 'x-ai/grok-imagine-image-quality'
const OPENROUTER_URL = process.env.AI_IMAGE_API_URL || 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_REFERER = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001'
const MAX_PROVIDER_IMAGE_BYTES = 14 * 1024 * 1024

const PRESET_PROMPTS: Record<string, string> = {
  vehicle_hero: 'Vehicle listing hero photo in a clean dealership studio.',
  transparent_bg: 'Vehicle cutout with no visible background.',
  clean_dealership_bg:
    'Vehicle in a clean dealership studio: neutral gray/white curved wall, glossy circular turntable floor, soft overhead light, realistic reflections.',
  logo_overlay: 'Vehicle image prepared for a dealership-branded overlay.',
  homepage_banner: 'Horizontal homepage banner featuring the vehicle.',
  social_ad: 'Social media ad image featuring the vehicle.',
  promo_banner: 'Promotional banner with the vehicle and room for copy.',
  seminuevo_gallery_cover: 'Used-vehicle gallery cover image.',
  new_car_representative: 'Representative image for a new vehicle.',
}

const MARKETING_PRESET_PROMPTS: Record<string, string> = {
  vehicle_hero: 'Marketing hero creative for an automotive campaign.',
  transparent_bg: 'Clean product cutout or composited graphic with transparent/isolated feel.',
  clean_dealership_bg: 'Clean dealership-branded marketing visual with polished lighting.',
  logo_overlay: 'Brand-ready creative with room for dealership logo placement.',
  homepage_banner: 'Wide homepage banner with strong composition, room for headline and CTA.',
  social_ad: 'Social media ad creative with bold focal point and readable negative space.',
  promo_banner: 'Promotional banner with premium automotive mood and room for offer copy.',
  seminuevo_gallery_cover: 'Used-vehicle promotional cover graphic.',
  new_car_representative: 'Representative new-car marketing creative.',
}

type MediaLike = {
  id?: number | string
  url?: string
  thumbnailURL?: string
}

type JobOutput = {
  image?: MediaLike | number | string | null
  url?: string
  selected?: boolean
  turnId?: string
}

type JobLike = {
  id: number | string
  aspectRatio?: string
  jobType?: 'vehicle_image' | 'marketing_asset'
  title?: string
  prompt?: string
  promptPreset?: string
  styleName?: string
  stylePrompt?: string
  inputImages?: Array<{ image?: MediaLike | number | string | null }> | null
  messages?: Array<{ role?: string; content?: string; turnId?: string }> | null
  outputs?: JobOutput[] | null
  styleReferenceUrl?: string
  vehicleContext?: {
    brand?: string
    model?: string
    year?: number
    color?: string
  }
}

type ProviderImage = {
  buffer: Buffer
  mime: string
  extension: string
}

function valueToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function extensionFromMime(mime: string): string {
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  return 'jpg'
}

function parseDataUrl(url: string): ProviderImage | null {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(url)
  if (!match) return null
  const mime = match[1] || 'image/jpeg'
  const buffer = Buffer.from(match[2], 'base64')
  return { buffer, mime, extension: extensionFromMime(mime) }
}

async function downloadProviderImage(url: string): Promise<ProviderImage> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Could not download generated image (${res.status}).`)
  const mime = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim()
  const arrayBuffer = await res.arrayBuffer()
  if (arrayBuffer.byteLength > MAX_PROVIDER_IMAGE_BYTES) {
    throw new Error('Generated image is larger than the allowed size.')
  }
  return { buffer: Buffer.from(arrayBuffer), mime, extension: extensionFromMime(mime) }
}

function mediaUrlFromDoc(media: MediaLike | number | string | null | undefined): string {
  if (!media || typeof media !== 'object') return ''
  return media.url || media.thumbnailURL || ''
}

function toPayloadMediaId(value: MediaLike | number | string | null | undefined): number | undefined {
  const raw = typeof value === 'object' ? value?.id : value
  const numeric = Number(raw)
  return Number.isFinite(numeric) ? numeric : undefined
}

async function mediaToDataUrl(media: MediaLike | number | string | null | undefined): Promise<string> {
  const url = mediaUrlFromDoc(media)
  if (!url) return ''
  const absoluteUrl = url.startsWith('http') ? url : `${OPENROUTER_REFERER}${url.startsWith('/') ? url : `/${url}`}`
  const res = await fetch(absoluteUrl, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Could not read input image (${res.status}).`)
  const mime = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim()
  const buffer = Buffer.from(await res.arrayBuffer())
  return `data:${mime};base64,${buffer.toString('base64')}`
}

function buildVehiclePrompt(job: JobLike): string {
  const vehicle = job.vehicleContext || {}
  const vehicleTitle = [vehicle.year, vehicle.brand, vehicle.model].filter(Boolean).join(' ')
  const presetPrompt = PRESET_PROMPTS[job.promptPreset || 'clean_dealership_bg'] || PRESET_PROMPTS.clean_dealership_bg
  const userPrompt = valueToString(job.prompt)
  const styleName = valueToString(job.styleName)
  const stylePrompt = valueToString(job.stylePrompt)

  return [
    'Use case: precise-object-edit',
    'Asset type: vehicle inventory listing photo',
    `Primary request: ${userPrompt || 'Transform the selected vehicle photo into a clean indoor dealership turntable studio photo.'}`,
    vehicleTitle ? `Vehicle context: ${vehicleTitle}${vehicle.color ? `, exterior color ${vehicle.color}` : ''}.` : '',
    `Preset: ${presetPrompt}`,
    styleName ? `Selected style: ${styleName}.` : '',
    stylePrompt ? `Embedded style instructions: ${stylePrompt}` : '',
    'Input images: Image 1 is the exact vehicle identity/edit target. Other input images are style or chat references only.',
    'Scene/backdrop: bright neutral gray/white curved cyclorama wall, glossy light gray circular turntable floor, subtle dark circular outline on the floor, clean dealership photo bay.',
    'Subject: preserve the exact vehicle from Image 1: same make/model appearance, body shape, grille, headlights, wheels, angle, roofline, trim, stance, and proportions. Preserve paint color unless the user explicitly asks to change it; if requested, repaint the vehicle cleanly while keeping all model identity details.',
    'Lighting/mood: soft overhead studio lighting, realistic soft shadow under the tires, mild floor reflection, polished but not CGI.',
    'License plate rule: no readable license plate text, no invented letters, no fake words, no random plate characters. Use an angle, crop, shadow, blur, blank area, or cover that makes plate text not visible.',
    'Style/reference rule: for Image 2 and later images, copy only the requested environment, lighting, mood, framing, material cues, or specific user-requested context. Do not copy any vehicle, badge, grille, wheels, brand, or plate from reference images after Image 1.',
    'Avoid: outdoor scenery, road markings, trees, sky, watermarks, wall logos, fake plate lettering, Audi styling unless the source vehicle is an Audi, distorted wheels, extra vehicles, impossible reflections.',
  ]
    .filter(Boolean)
    .join('\n')
}

function buildMarketingPrompt(job: JobLike): string {
  const vehicle = job.vehicleContext || {}
  const vehicleTitle = [vehicle.year, vehicle.brand, vehicle.model].filter(Boolean).join(' ')
  const presetPrompt =
    MARKETING_PRESET_PROMPTS[job.promptPreset || 'homepage_banner'] || MARKETING_PRESET_PROMPTS.homepage_banner
  const userPrompt = valueToString(job.prompt)
  const styleName = valueToString(job.styleName)
  const stylePrompt = valueToString(job.stylePrompt)
  const hasInputImages = Boolean(job.inputImages?.length)

  return [
    'Use case: general-marketing-creative',
    'Asset type: automotive marketing image, banner, promotion, social ad, or web content.',
    `Primary request: ${userPrompt || 'Create a polished automotive marketing creative.'}`,
    vehicleTitle ? `Optional vehicle context: ${vehicleTitle}${vehicle.color ? `, exterior color ${vehicle.color}` : ''}.` : '',
    `Preset: ${presetPrompt}`,
    styleName ? `Selected style: ${styleName}.` : '',
    stylePrompt ? `Embedded style instructions: ${stylePrompt}` : '',
    hasInputImages
      ? 'Input images are optional visual references. Use them for product identity, layout, color, lighting, background, or mood only as requested by the user.'
      : 'No input image is required. Create the image from the prompt and marketing context.',
    'Composition: polished commercial quality, clear focal point, useful negative space for dealership copy, offers, logo, or CTA when appropriate.',
    'Brand safety: no readable license plate text, no watermarks, no fake badges, no random text, no invented logos unless the user explicitly requests placeholder graphic text.',
    'Avoid: cluttered layouts, distorted vehicles, unreadable copy, low-quality stock-photo look, watermarks, extra nonsensical objects, and random text artifacts.',
  ]
    .filter(Boolean)
    .join('\n')
}

function buildPrompt(job: JobLike): string {
  return job.jobType === 'marketing_asset' ? buildMarketingPrompt(job) : buildVehiclePrompt(job)
}

function normalizeAspectRatio(value: unknown): string {
  const text = valueToString(value)
  return ['16:9', '1:1', '9:16', '4:3'].includes(text) ? text : '16:9'
}

async function callImageProvider(prompt: string, inputImages: string[], aspectRatio = '16:9'): Promise<ProviderImage[]> {
  const requestBody = {
    model: OPENROUTER_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          ...inputImages.map((url) => ({ type: 'image_url', image_url: { url } })),
        ],
      },
    ],
    modalities: ['image'],
    image_config: {
      aspect_ratio: normalizeAspectRatio(aspectRatio),
      image_size: '1K',
    },
    stream: false,
  }

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AI_IMAGE_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': OPENROUTER_REFERER,
      'X-Title': 'GBE Autos CMS Admin image wizard',
    },
    body: JSON.stringify(requestBody),
  })

  const data = (await response.json().catch(() => ({}))) as {
    error?: { message?: string }
    choices?: Array<{
      message?: {
        images?: Array<{ image_url?: { url?: string }; imageUrl?: { url?: string } }>
      }
    }>
  }

  if (!response.ok) {
    throw new Error(data.error?.message || `OpenRouter responded ${response.status}.`)
  }

  const imageUrls = (data.choices?.[0]?.message?.images || [])
    .map((image) => image.image_url?.url || image.imageUrl?.url || '')
    .filter(Boolean)

  const images = await Promise.all(imageUrls.map(async (url) => parseDataUrl(url) || downloadProviderImage(url)))
  return images.filter((image): image is ProviderImage => Boolean(image))
}

function outputToData(output: JobOutput) {
  return {
    image: toPayloadMediaId(output.image),
    url: output.url,
    selected: Boolean(output.selected),
    turnId: output.turnId,
  }
}

export async function POST(request: Request) {
  let jobId = ''
  let jobData: Record<string, unknown> | undefined
  try {
    const body = (await request.json()) as { jobId?: unknown; jobData?: unknown }
    jobId = valueToString(body.jobId)
    if (body.jobData && typeof body.jobData === 'object' && !Array.isArray(body.jobData)) {
      jobData = body.jobData as Record<string, unknown>
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  if (!jobId && !jobData) {
    return NextResponse.json({ error: 'jobId or jobData is required.' }, { status: 400 })
  }

  const auth = await requireCmsRole(request, ['general'], 'Not allowed to use the workshop.')
  if (auth.response) return auth.response
  const { payload, user } = auth

  if (!AI_IMAGE_WIZARD_SERVER_ENABLED) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        error:
          'AI image generation is paused for production v1. Enable ENABLE_AI_IMAGE_WIZARD=true on the server for beta testing.',
      },
      { status: 403 },
    )
  }

  const reqContext = { headers: request.headers, user }
  if (jobData) {
    try {
      if (jobId) {
        await payload.update({
          collection: 'workshop-jobs',
          id: jobId,
          data: jobData,
          overrideAccess: true,
          req: reqContext,
        })
      } else {
        const created = await payload.create({
          collection: 'workshop-jobs',
          data: jobData,
          overrideAccess: true,
          req: reqContext,
        })
        jobId = valueToString(created.id)
      }
    } catch (error) {
      const cause = error && typeof error === 'object' && 'cause' in error ? (error as { cause?: unknown }).cause : undefined
      const causeMessage = cause instanceof Error ? cause.message : ''
      const causeCode = cause && typeof cause === 'object' && 'code' in cause ? String((cause as { code?: unknown }).code) : ''
      const message = [
        error instanceof Error ? error.message : 'Could not save the workshop job.',
        causeCode ? `code: ${causeCode}` : '',
        causeMessage,
      ]
        .filter(Boolean)
        .join('\n')
      return NextResponse.json({ ok: false, error: message, phase: 'save_job' }, { status: 422 })
    }
  }

  const job = (await payload.findByID({ collection: 'workshop-jobs', id: jobId, depth: 2 }).catch(() => null)) as
    | JobLike
    | null

  if (!job) {
    return NextResponse.json({ error: 'Job not found.' }, { status: 404 })
  }

  await payload.update({
    collection: 'workshop-jobs',
    id: jobId,
    data: { status: 'generating', error: '' },
    overrideAccess: true,
    req: reqContext,
  })

  if (!AI_IMAGE_API_KEY) {
    const message = 'AI image generation is not configured. Set OPENROUTER_API_KEY or AI_IMAGE_API_KEY on the server.'
    await payload.update({
      collection: 'workshop-jobs',
      id: jobId,
      data: { status: 'failed', error: message },
      overrideAccess: true,
      req: reqContext,
    })
    return NextResponse.json({ ok: false, configured: false, error: message, jobId }, { status: 501 })
  }

  try {
    const prompt = buildPrompt(job)
    const inputImages = await Promise.all((job.inputImages || []).map((item) => mediaToDataUrl(item.image)))
    const cleanInputs = inputImages.filter(Boolean)

    if (job.jobType !== 'marketing_asset' && cleanInputs.length === 0) {
      throw new Error('Select at least one vehicle reference image.')
    }

    const results = await callImageProvider(prompt, cleanInputs, job.aspectRatio)
    if (!results.length) {
      throw new Error('The image provider did not return any images.')
    }

    const existingOutputs = (job.outputs || []).map(outputToData)
    const currentTurnId = [...(job.messages || [])].reverse().find((message) => message.role === 'user')?.turnId
    const newOutputs = []

    for (const [index, result] of results.entries()) {
      const media = await payload.create({
        collection: 'media',
        data: {
          alt: `${job.title || 'AI vehicle image'} result ${existingOutputs.length + index + 1}`,
        },
        file: {
          data: result.buffer,
          mimetype: result.mime,
          name: `grok-${job.jobType === 'marketing_asset' ? 'marketing' : 'vehicle'}-${jobId}-${Date.now()}-${index + 1}.${result.extension}`,
          size: result.buffer.length,
        },
        overrideAccess: true,
        req: reqContext,
      })
      newOutputs.push({ image: media.id, selected: false, turnId: currentTurnId })
    }

    await payload.update({
      collection: 'workshop-jobs',
      id: jobId,
      data: {
        status: 'ready_for_review',
        error: '',
        prompt,
        outputs: [...existingOutputs, ...newOutputs],
      },
      overrideAccess: true,
      req: reqContext,
    })

    return NextResponse.json({ ok: true, configured: true, jobId, outputs: newOutputs })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The image provider did not return results.'
    await payload.update({
      collection: 'workshop-jobs',
      id: jobId,
      data: { status: 'failed', error: message },
      overrideAccess: true,
      req: reqContext,
    })
    return NextResponse.json({ ok: false, error: message, jobId }, { status: 502 })
  }
}

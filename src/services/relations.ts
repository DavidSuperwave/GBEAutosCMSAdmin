/**
 * Pure helpers for coercing Payload relationship values (raw ids or populated
 * docs) into comparable ids. Shared by server services, API routes and admin
 * client components — keep this module dependency-free.
 */

export function relationId(value: unknown): string | number | undefined {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && typeof value === 'object') {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return id
  }
  return undefined
}

export function sameRelationId(a: unknown, b: unknown) {
  return String(relationId(a) ?? '') === String(relationId(b) ?? '')
}

export function relationIds(values: unknown): Array<string | number> {
  if (!Array.isArray(values)) return []
  return values.map(relationId).filter((id): id is string | number => id !== undefined)
}

type GalleryItem = { image?: unknown } | null | undefined

export function galleryMediaIds(gallery: unknown): Array<string | number> {
  if (!Array.isArray(gallery)) return []
  return gallery
    .map((item: GalleryItem) => relationId(item?.image))
    .filter((id): id is string | number => id !== undefined)
}

export function landingMediaIds(landing: unknown): Array<string | number> {
  if (!Array.isArray(landing)) return []
  return landing.flatMap((block) => {
    if (!block || typeof block !== 'object') return []
    const record = block as { blockType?: unknown; image?: unknown; images?: unknown }
    if (record.blockType === 'imageText') {
      const id = relationId(record.image)
      return id === undefined ? [] : [id]
    }
    if (record.blockType === 'gallery' && Array.isArray(record.images)) {
      return record.images
        .map((item) => (item && typeof item === 'object' ? relationId((item as { image?: unknown }).image) : undefined))
        .filter((id): id is string | number => id !== undefined)
    }
    return []
  })
}

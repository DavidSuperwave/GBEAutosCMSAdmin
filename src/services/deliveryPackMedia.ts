export const DELIVERY_PACK_MEDIA_SOURCE_PROVIDER = 'client_delivery_pack' as const

export type DeliveryPackArchiveRecord = {
  record_type?: unknown
  folder_label?: unknown
  status?: unknown
  candidate_idvs?: unknown
  local_paths?: unknown
  hashes?: unknown
  sha256?: unknown
  sha256_by_path?: unknown
}

export type DeliveryPackManifest = {
  generated_date?: unknown
  archive_records?: unknown
  reference_records?: unknown
}

export type DeliveryPackSelectionReason =
  | 'invalid_record'
  | 'not_archive_record'
  | 'candidate_idv_count'
  | 'disallowed_status'
  | 'location_conflict'
  | 'invalid_local_paths'
  | 'path_outside_semi_new_by_idv'
  | 'path_idv_mismatch'
  | 'duplicate_local_path'

export type SelectedDeliveryPackRecord = {
  folderLabel: string
  idv: string
  localPaths: string[]
  expectedSha256ByPath: Record<string, string>
  status: string
}

export type BlockedDeliveryPackRecord = {
  folderLabel: string
  reason: DeliveryPackSelectionReason
  status: string
}

export type DeliveryPackSelection = {
  blocked: BlockedDeliveryPackRecord[]
  selected: SelectedDeliveryPackRecord[]
}

function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function block(
  blocked: BlockedDeliveryPackRecord[],
  record: DeliveryPackArchiveRecord,
  reason: DeliveryPackSelectionReason,
) {
  blocked.push({
    folderLabel: asTrimmedString(record.folder_label) || '(unnamed folder)',
    reason,
    status: asTrimmedString(record.status) || '(missing status)',
  })
}

function normalizeManifestPath(value: string) {
  const normalized = value.replaceAll('\\', '/').replace(/^\.\//, '')
  if (
    normalized.startsWith('/') ||
    normalized.includes('\0') ||
    normalized.split('/').some((part) => part === '' || part === '.' || part === '..')
  ) {
    return null
  }
  return normalized
}

function expectedHashesFor(
  record: DeliveryPackArchiveRecord,
  localPaths: string[],
): Record<string, string> {
  const expected: Record<string, string> = {}
  const hashMaps = [record.sha256_by_path, record.hashes]
  for (const candidate of hashMaps) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue
    for (const [rawPath, rawHash] of Object.entries(candidate)) {
      const normalizedPath = normalizeManifestPath(rawPath)
      const normalizedHash = asTrimmedString(rawHash).toLowerCase()
      if (normalizedPath && localPaths.includes(normalizedPath) && /^[a-f0-9]{64}$/.test(normalizedHash)) {
        expected[normalizedPath] = normalizedHash
      }
    }
  }

  const recordHash = asTrimmedString(record.sha256).toLowerCase()
  if (localPaths.length === 1 && /^[a-f0-9]{64}$/.test(recordHash)) {
    expected[localPaths[0]] = recordHash
  }
  return expected
}

/**
 * Select only client-supplied seminuevo dealer photos that have an unambiguous
 * inventory ID. This function intentionally does not inspect reference_records:
 * those are NUEVOS research references and are outside this staging workflow.
 */
export function selectDeliveryPackSemiNewMedia(
  manifest: DeliveryPackManifest,
  options: { includeLocationConflicts?: boolean } = {},
): DeliveryPackSelection {
  const blocked: BlockedDeliveryPackRecord[] = []
  const selected: SelectedDeliveryPackRecord[] = []
  const records = Array.isArray(manifest.archive_records) ? manifest.archive_records : []

  for (const value of records) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      blocked.push({
        folderLabel: '(invalid record)',
        reason: 'invalid_record',
        status: '(missing status)',
      })
      continue
    }

    const record = value as DeliveryPackArchiveRecord
    if (asTrimmedString(record.record_type) !== 'supplied_archive_folder') {
      block(blocked, record, 'not_archive_record')
      continue
    }

    const status = asTrimmedString(record.status).toLowerCase()
    const isLocationConflict = status.includes('location_conflict')
    if (isLocationConflict && !options.includeLocationConflicts) {
      block(blocked, record, 'location_conflict')
      continue
    }

    const hasDisallowedStatus = ['review', 'unmatched', 'sold'].some((token) =>
      status.includes(token),
    )
    const hasOtherConflict = status.includes('conflict') && !isLocationConflict
    if (!status.startsWith('matched_') || hasDisallowedStatus || hasOtherConflict) {
      block(blocked, record, 'disallowed_status')
      continue
    }

    const candidateIdvs = Array.isArray(record.candidate_idvs)
      ? record.candidate_idvs.map(asTrimmedString).filter(Boolean)
      : []
    if (candidateIdvs.length !== 1) {
      block(blocked, record, 'candidate_idv_count')
      continue
    }
    const [idv] = candidateIdvs

    if (!Array.isArray(record.local_paths) || record.local_paths.length === 0) {
      block(blocked, record, 'invalid_local_paths')
      continue
    }

    const normalizedPaths: string[] = []
    let invalidReason: DeliveryPackSelectionReason | undefined
    for (const pathValue of record.local_paths) {
      const normalized = normalizeManifestPath(asTrimmedString(pathValue))
      if (!normalized) {
        invalidReason = 'invalid_local_paths'
        break
      }

      const match = /^images\/semi_new\/by_idv\/([^/]+)\/dealer_photos\/[^/]+$/i.exec(normalized)
      if (!match) {
        invalidReason = 'path_outside_semi_new_by_idv'
        break
      }
      if (match[1] !== idv) {
        invalidReason = 'path_idv_mismatch'
        break
      }
      normalizedPaths.push(normalized)
    }

    if (invalidReason) {
      block(blocked, record, invalidReason)
      continue
    }
    if (new Set(normalizedPaths).size !== normalizedPaths.length) {
      block(blocked, record, 'duplicate_local_path')
      continue
    }

    selected.push({
      folderLabel: asTrimmedString(record.folder_label) || `IDV ${idv}`,
      idv,
      localPaths: normalizedPaths,
      expectedSha256ByPath: expectedHashesFor(record, normalizedPaths),
      status,
    })
  }

  return { blocked, selected }
}

export function buildDeliveryPackMediaUrn(sha256: string) {
  return `urn:gba:client-delivery-pack:sha256:${sha256.toLowerCase()}`
}

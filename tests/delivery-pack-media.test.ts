import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildDeliveryPackMediaUrn,
  selectDeliveryPackSemiNewMedia,
  type DeliveryPackArchiveRecord,
} from '../src/services/deliveryPackMedia'
import {
  buildSupabaseMediaObjectKey,
  buildSupabasePublicMediaUrl,
  canUseSupabaseMediaClientUploads,
  readSupabaseS3StorageConfig,
} from '../src/services/supabaseS3Storage'

function record(overrides: Partial<DeliveryPackArchiveRecord> = {}): DeliveryPackArchiveRecord {
  return {
    record_type: 'supplied_archive_folder',
    folder_label: 'Mazda CX-5 2024',
    status: 'matched_exact',
    candidate_idvs: ['12345'],
    local_paths: ['images/semi_new/by_idv/12345/dealer_photos/01.jpeg'],
    ...overrides,
  }
}

test('selects only unambiguous seminuevo by-IDV dealer photos', () => {
  const result = selectDeliveryPackSemiNewMedia({
    archive_records: [record()],
    reference_records: [
      {
        record_type: 'new_display_reference',
        local_path: 'images/reference_candidates/new/mazda/01.jpeg',
      },
    ],
  })

  assert.equal(result.blocked.length, 0)
  assert.deepEqual(result.selected, [
    {
      expectedSha256ByPath: {},
      folderLabel: 'Mazda CX-5 2024',
      idv: '12345',
      localPaths: ['images/semi_new/by_idv/12345/dealer_photos/01.jpeg'],
      status: 'matched_exact',
    },
  ])
})

test('blocks ambiguous, review, unmatched, sold, and out-of-scope records', () => {
  const result = selectDeliveryPackSemiNewMedia({
    archive_records: [
      record({ folder_label: 'Ambiguous', candidate_idvs: ['1', '2'] }),
      record({ folder_label: 'Review', status: 'potential_match_needs_review' }),
      record({ folder_label: 'Unmatched', status: 'unmatched_archive_folder' }),
      record({ folder_label: 'Sold', status: 'sold_archive_excluded' }),
      record({
        folder_label: 'Reference path',
        local_paths: ['images/reference_candidates/new/mazda/01.jpeg'],
      }),
    ],
  })

  assert.equal(result.selected.length, 0)
  assert.deepEqual(
    result.blocked.map((item) => item.reason),
    [
      'candidate_idv_count',
      'disallowed_status',
      'disallowed_status',
      'disallowed_status',
      'path_outside_semi_new_by_idv',
    ],
  )
})

test('location conflicts require the explicit opt-in and remain review-only candidates', () => {
  const conflict = record({ status: 'matched_location_conflict' })
  const defaultSelection = selectDeliveryPackSemiNewMedia({ archive_records: [conflict] })
  assert.equal(defaultSelection.selected.length, 0)
  assert.equal(defaultSelection.blocked[0]?.reason, 'location_conflict')

  const optedIn = selectDeliveryPackSemiNewMedia(
    { archive_records: [conflict] },
    { includeLocationConflicts: true },
  )
  assert.equal(optedIn.selected.length, 1)
})

test('blocks path traversal, wrong IDV folders, and duplicate local paths', () => {
  const result = selectDeliveryPackSemiNewMedia({
    archive_records: [
      record({ folder_label: 'Traversal', local_paths: ['../outside.jpeg'] }),
      record({
        folder_label: 'Wrong IDV',
        local_paths: ['images/semi_new/by_idv/99999/dealer_photos/01.jpeg'],
      }),
      record({
        folder_label: 'Duplicate',
        local_paths: [
          'images/semi_new/by_idv/12345/dealer_photos/01.jpeg',
          'images/semi_new/by_idv/12345/dealer_photos/01.jpeg',
        ],
      }),
    ],
  })

  assert.deepEqual(
    result.blocked.map((item) => item.reason),
    ['invalid_local_paths', 'path_idv_mismatch', 'duplicate_local_path'],
  )
})

test('retains valid manifest SHA-256 values for later byte verification', () => {
  const digest = 'a'.repeat(64)
  const path = 'images/semi_new/by_idv/12345/dealer_photos/01.jpeg'
  const result = selectDeliveryPackSemiNewMedia({
    archive_records: [record({ sha256_by_path: { [path]: digest } })],
  })

  assert.deepEqual(result.selected[0]?.expectedSha256ByPath, { [path]: digest })
  assert.equal(buildDeliveryPackMediaUrn(digest), `urn:gba:client-delivery-pack:sha256:${digest}`)
})

test('Supabase S3 configuration is enabled only when complete and valid', () => {
  const valid = {
    SUPABASE_S3_ACCESS_KEY_ID: 'server-key',
    SUPABASE_S3_BUCKET: 'vehicle-images',
    SUPABASE_S3_ENDPOINT: 'https://example-ref.storage.supabase.co/storage/v1/s3/',
    SUPABASE_S3_PREFIX: 'cms_media',
    SUPABASE_S3_PUBLIC_URL_BASE:
      'https://example-ref.supabase.co/storage/v1/object/public/vehicle-images/',
    SUPABASE_S3_REGION: 'us-west-2',
    SUPABASE_S3_SECRET_ACCESS_KEY: 'server-secret',
  }
  const configured = readSupabaseS3StorageConfig(valid)
  assert.equal(configured.configured, true)
  if (configured.configured) {
    assert.equal(configured.config.endpoint, 'https://example-ref.storage.supabase.co/storage/v1/s3')
    assert.equal(
      buildSupabasePublicMediaUrl(configured.config, 'photo one.jpg'),
      'https://example-ref.supabase.co/storage/v1/object/public/vehicle-images/cms_media/photo%20one.jpg',
    )
    assert.equal(buildSupabaseMediaObjectKey(configured.config.prefix, 'photo one.jpg'), 'cms_media/photo one.jpg')
  }

  const missing = readSupabaseS3StorageConfig({ ...valid, SUPABASE_S3_SECRET_ACCESS_KEY: '' })
  assert.equal(missing.configured, false)
  if (!missing.configured) assert.deepEqual(missing.missing, ['SUPABASE_S3_SECRET_ACCESS_KEY'])
})

test('client-side media uploads match the media-management role boundary exactly', () => {
  assert.equal(canUseSupabaseMediaClientUploads('media', { role: 'admin' }), true)
  assert.equal(canUseSupabaseMediaClientUploads('media', { role: 'general' }), true)
  assert.equal(canUseSupabaseMediaClientUploads('media', { role: 'sales' }), false)
  assert.equal(canUseSupabaseMediaClientUploads('media', {}), false)
  assert.equal(canUseSupabaseMediaClientUploads('media', null), false)
  assert.equal(canUseSupabaseMediaClientUploads('vehicles', { role: 'admin' }), false)
})

test('Supabase media object keys reject filenames and prefixes with traversal', () => {
  assert.throws(() => buildSupabaseMediaObjectKey('cms_media', '../photo.jpg'), /basename/)
  assert.throws(() => buildSupabaseMediaObjectKey('../cms_media', 'photo.jpg'), /unsafe/)
  assert.throws(() => buildSupabaseMediaObjectKey('cms_media', 'bad\u0000.jpg'), /basename/)
})

test('complete but malformed Supabase S3 configuration fails closed', () => {
  const malformed = readSupabaseS3StorageConfig({
    SUPABASE_S3_ACCESS_KEY_ID: 'server-key',
    SUPABASE_S3_BUCKET: 'INVALID_BUCKET',
    SUPABASE_S3_ENDPOINT: 'http://example.com/not-s3',
    SUPABASE_S3_PREFIX: '../unsafe',
    SUPABASE_S3_PUBLIC_URL_BASE: 'https://other-ref.supabase.co/storage/v1/object/public/wrong',
    SUPABASE_S3_REGION: 'us-west-2',
    SUPABASE_S3_SECRET_ACCESS_KEY: 'server-secret',
  })

  assert.equal(malformed.configured, false)
  if (!malformed.configured) {
    assert.equal(malformed.missing.length, 0)
    assert.ok(malformed.errors.length >= 3)
  }
})

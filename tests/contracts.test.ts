import assert from 'node:assert/strict'
import test from 'node:test'

import { ANALYTICS_EVENT_TYPES, ANALYTICS_EVENT_TYPE_OPTIONS } from '../src/contracts/analytics'
import { SITE_SECTION_BLOCK_SLUGS } from '../src/contracts/blocks'
import {
  PUBLIC_VEHICLE_SORT_VALUES,
  VEHICLE_LANDING_BLOCK_TYPES,
} from '../src/contracts/publicCatalog'
import { AnalyticsEvents } from '../src/collections/AnalyticsEvents'
import { siteSectionBlocks } from '../src/blocks/SiteSections'

test('site section registry matches the block contract exactly', () => {
  const registrySlugs = siteSectionBlocks.map((block) => block.slug)
  assert.deepEqual(registrySlugs, [...SITE_SECTION_BLOCK_SLUGS])
})

test('analytics collection derives its event types from the contract', () => {
  const eventTypeField = AnalyticsEvents.fields.find(
    (field) => 'name' in field && field.name === 'eventType',
  )
  assert.ok(eventTypeField && 'options' in eventTypeField, 'eventType select field exists')
  const values = (eventTypeField.options as { value: string }[]).map((option) => option.value)
  assert.deepEqual(values, ANALYTICS_EVENT_TYPES)
})

test('contract constants are non-empty and unique', () => {
  for (const list of [
    ANALYTICS_EVENT_TYPES,
    [...SITE_SECTION_BLOCK_SLUGS],
    [...PUBLIC_VEHICLE_SORT_VALUES],
    [...VEHICLE_LANDING_BLOCK_TYPES],
  ]) {
    assert.ok(list.length > 0)
    assert.equal(new Set(list).size, list.length)
  }
  assert.equal(ANALYTICS_EVENT_TYPE_OPTIONS.length, ANALYTICS_EVENT_TYPES.length)
})

test('smart ranks are not part of the public sort contract', () => {
  for (const smartRank of ['mostViewed', 'mostClicked', 'mostLeads']) {
    assert.ok(!(PUBLIC_VEHICLE_SORT_VALUES as readonly string[]).includes(smartRank))
  }
})

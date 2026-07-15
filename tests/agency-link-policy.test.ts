import assert from 'node:assert/strict'
import test from 'node:test'

import { selectAgencyMapLink } from '../src/services/agencyLinkPolicy'

test('client-confirmation map links are withheld from the public field', () => {
  const candidate = 'https://share.google/MQC2CmihPpc9dye4s'
  assert.deepEqual(selectAgencyMapLink(candidate, 'MAP_LINK_CLIENT_CONFIRM - pending'), {
    mapUrl: '',
    reviewRequired: true,
    withheldMapUrl: candidate,
  })
})

test('confirmed agency map links remain publishable', () => {
  const candidate = 'https://maps.app.goo.gl/FQejroDAjAXErMpx8'
  assert.deepEqual(selectAgencyMapLink(candidate, 'official_source_client_confirm'), {
    mapUrl: candidate,
    reviewRequired: false,
  })
})

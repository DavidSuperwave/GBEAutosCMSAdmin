export type AgencyMapLinkDecision = {
  mapUrl: string
  reviewRequired: boolean
  withheldMapUrl?: string
}

/**
 * `map_link_client_confirm` is an explicit publication hold in the intake
 * workbook. Keep the candidate visible in dry-run output, but never persist it
 * to the public map field until the workbook verification value is changed.
 */
export function selectAgencyMapLink(
  candidate: unknown,
  verification: unknown,
): AgencyMapLinkDecision {
  const mapUrl = String(candidate ?? '').trim()
  const verificationKey = String(verification ?? '').trim().toLowerCase()
  const reviewRequired = verificationKey.includes('map_link_client_confirm')

  return reviewRequired && mapUrl
    ? { mapUrl: '', reviewRequired: true, withheldMapUrl: mapUrl }
    : { mapUrl, reviewRequired }
}

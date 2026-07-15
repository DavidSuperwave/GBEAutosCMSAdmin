export type ImportDealership = {
  id: number | string
  brandName?: string | null
  displayName?: string | null
  city?: string | null
  sourceAliases?: string | null
}

export type DealershipMatchStrategy =
  | 'sourceAlias'
  | 'displayName'
  | 'displayNamePartial'
  | 'brand'
  | 'ambiguousSourceAlias'
  | 'ambiguousDisplayName'
  | 'ambiguousBrand'
  | 'none'

export type DealershipMatch<T extends ImportDealership> = {
  dealership?: T
  strategy: DealershipMatchStrategy
}

/**
 * Canonical lookup key used for imports and client-provided source aliases.
 * Accents, punctuation and spacing are intentionally ignored, while the
 * original source value remains untouched on the vehicle record.
 */
export function normalizeDealershipKey(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export function splitSourceAliases(value: unknown): string[] {
  return String(value ?? '')
    .split(/\r?\n/)
    .map((alias) => alias.trim())
    .filter(Boolean)
}

function uniqueMatch<T extends ImportDealership>(
  matches: T[],
  strategy: DealershipMatchStrategy,
  ambiguousStrategy: DealershipMatchStrategy,
): DealershipMatch<T> | undefined {
  if (matches.length === 1) return { dealership: matches[0], strategy }
  if (matches.length > 1) return { strategy: ambiguousStrategy }
  return undefined
}

/**
 * Resolve one imported source agency without silently choosing among multiple
 * city branches of the same brand. Exact internal aliases are authoritative;
 * the legacy display-name/brand fallbacks only run when no alias matches and
 * only succeed when they identify one dealership.
 */
export function matchDealershipForImport<T extends ImportDealership>(
  dealerships: T[],
  brand: unknown,
  sourceDealerName: unknown,
): DealershipMatch<T> {
  const sourceKey = normalizeDealershipKey(sourceDealerName)

  if (sourceKey) {
    const aliasMatches = dealerships.filter((dealership) =>
      splitSourceAliases(dealership.sourceAliases).some(
        (alias) => normalizeDealershipKey(alias) === sourceKey,
      ),
    )
    const aliasMatch = uniqueMatch(
      aliasMatches,
      'sourceAlias',
      'ambiguousSourceAlias',
    )
    if (aliasMatch) return aliasMatch

    const exactNameMatches = dealerships.filter(
      (dealership) => normalizeDealershipKey(dealership.displayName) === sourceKey,
    )
    const exactNameMatch = uniqueMatch(
      exactNameMatches,
      'displayName',
      'ambiguousDisplayName',
    )
    if (exactNameMatch) return exactNameMatch

    const partialNameMatches = dealerships.filter((dealership) => {
      const displayKey = normalizeDealershipKey(dealership.displayName)
      return Boolean(displayKey) &&
        (displayKey.includes(sourceKey) || sourceKey.includes(displayKey))
    })
    const partialNameMatch = uniqueMatch(
      partialNameMatches,
      'displayNamePartial',
      'ambiguousDisplayName',
    )
    if (partialNameMatch) return partialNameMatch
  }

  const brandKey = normalizeDealershipKey(brand)
  if (brandKey) {
    const brandMatches = dealerships.filter(
      (dealership) => normalizeDealershipKey(dealership.brandName) === brandKey,
    )
    const brandMatch = uniqueMatch(brandMatches, 'brand', 'ambiguousBrand')
    if (brandMatch) return brandMatch
  }

  return { strategy: 'none' }
}

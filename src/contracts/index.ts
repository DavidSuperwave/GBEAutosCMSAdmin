/**
 * Shared contracts source of truth (F038).
 *
 * Everything the Storefront (or any external consumer) depends on is exported
 * from here: public DTO types, catalog option values, block slugs, and the
 * analytics event taxonomy. Per D10's default this stays an in-repo module;
 * publishing it as a versioned package is deferred until after launch.
 */

export * from './analytics'
export * from './blocks'
export * from './publicCatalog'

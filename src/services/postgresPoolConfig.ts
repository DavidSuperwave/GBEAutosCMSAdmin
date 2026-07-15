type PostgresPoolEnvironment = {
  NODE_ENV?: string
  POSTGRES_POOL_MAX?: string
}

function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export function resolvePostgresPoolMax(environment: PostgresPoolEnvironment) {
  const isProduction = environment.NODE_ENV === 'production'
  const configured = readPositiveInt(environment.POSTGRES_POOL_MAX, isProduction ? 2 : 3)

  // Payload initialization and the first request can overlap database work.
  // A production pool of one self-starves; two stays small without blocking that handoff.
  return isProduction ? 2 : configured
}

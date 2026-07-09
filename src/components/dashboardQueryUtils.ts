/**
 * Query plumbing shared by the admin dashboard widgets (OperationsDashboard,
 * AnalyticsDashboard). Both widgets fan out many small Payload queries against
 * a tiny connection pool, so they bound each query with a timeout and cap
 * concurrency via the same env vars (ADMIN_DASHBOARD_QUERY_TIMEOUT_MS,
 * ADMIN_DASHBOARD_QUERY_CONCURRENCY).
 */

export function readPositiveInt(name: string, fallback: number) {
  const value = Number(process.env[name])
  return Number.isInteger(value) && value > 0 ? value : fallback
}

export function withTimeout<T>(label: string, task: () => Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    task().then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

export async function runLimited<T>(tasks: Array<() => Promise<T>>, concurrency: number) {
  const results: T[] = []
  let index = 0

  async function worker() {
    while (index < tasks.length) {
      const current = index
      index += 1
      results[current] = await tasks[current]()
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()))

  return results
}

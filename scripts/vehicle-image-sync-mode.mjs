export function resolveVehicleImageSyncMode(argv, options = {}) {
  const flags = new Set(argv)
  const applyRequested = flags.has('--apply')
  const dryRunRequested = flags.has('--dry-run')
  const environmentDryRun = options.environmentDryRun === true
  const dryRun = !applyRequested || dryRunRequested || environmentDryRun

  return {
    apply: applyRequested && !dryRun,
    dryRun,
  }
}

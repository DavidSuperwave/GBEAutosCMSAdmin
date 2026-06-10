import React from 'react'

import VehicleWorkspaceTab from './VehicleWorkspaceTab'

/**
 * Server wrapper registered as a custom document edit view/tab for Vehicles
 * (/admin/collections/vehicles/:id/workspace). Renders the client workspace,
 * which reads the document id from Payload's DocumentInfo provider.
 */
export default function VehicleWorkspaceView() {
  return <VehicleWorkspaceTab />
}

'use client'

import { useState } from 'react'

import { ActionButton, StatusBadge } from '../admin-ui/kit'
import VehicleSpecsLookupModal, { type AppliedVehicleSpecs } from '../VehicleSpecsLookupModal'

export type { AppliedVehicleSpecs }

type Props = {
  defaultMake?: string
  defaultModel?: string
  defaultYear?: string
  onApply: (data: AppliedVehicleSpecs) => void
}

export default function VehicleSpecsLookup({
  defaultMake,
  defaultModel,
  defaultYear,
  onApply,
}: Props) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState('Listo para buscar en catalogo.')

  function applySpecs(data: AppliedVehicleSpecs) {
    onApply(data)
    setStatus('Especificaciones aplicadas al formulario.')
  }

  return (
    <section className="vehicle-specs-lookup">
      <div className="vehicle-specs-lookup__head">
        <div>
          <h3>Autocompletar specs</h3>
          <p>
            Opcional. Completa datos tecnicos desde el catalogo cuando quieras acelerar la captura.
          </p>
        </div>
        <ActionButton onClick={() => setOpen(true)} variant="secondary">
          Buscar specs
        </ActionButton>
      </div>

      <div className="vehicle-specs-lookup__status">
        <StatusBadge tone="neutral">Opcional</StatusBadge>
        <span>{status}</span>
      </div>

      <VehicleSpecsLookupModal
        defaultMake={defaultMake}
        defaultModel={defaultModel}
        defaultYear={defaultYear}
        isOpen={open}
        onApply={applySpecs}
        onClose={() => setOpen(false)}
      />
    </section>
  )
}

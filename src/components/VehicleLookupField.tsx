'use client'

import { useField } from '@payloadcms/ui'
import { useState } from 'react'

import { ActionButton } from './admin-ui/kit'
import VehicleSpecsLookupModal, { type AppliedVehicleSpecs } from './VehicleSpecsLookupModal'

export default function VehicleLookupField() {
  const brand = useField<string>({ path: 'brand' })
  const model = useField<string>({ path: 'model' })
  const trim = useField<string>({ path: 'trim' })
  const year = useField<number>({ path: 'year' })
  const bodyType = useField<string>({ path: 'bodyType' })
  const commercialTransmission = useField<string>({ path: 'transmission' })
  const fuel = useField<string>({ path: 'fuel' })
  const tipo = useField<string>({ path: 'specs.tipo' })
  const motor = useField<string>({ path: 'specs.motor' })
  const potencia = useField<string>({ path: 'specs.potencia' })
  const transmision = useField<string>({ path: 'specs.transmision' })
  const combustible = useField<string>({ path: 'specs.combustible' })
  const traccion = useField<string>({ path: 'specs.traccion' })
  const cylinders = useField<string>({ path: 'specs.cylinders' })
  const seats = useField<string>({ path: 'specs.seats' })
  const doors = useField<string>({ path: 'specs.doors' })
  const lengthMm = useField<string>({ path: 'specs.lengthMm' })
  const widthMm = useField<string>({ path: 'specs.widthMm' })
  const heightMm = useField<string>({ path: 'specs.heightMm' })
  const wheelbaseMm = useField<string>({ path: 'specs.wheelbaseMm' })
  const maxTrunkCapacityL = useField<string>({ path: 'specs.maxTrunkCapacityL' })
  const torqueNm = useField<string>({ path: 'specs.torqueNm' })
  const fuelTankCapacityL = useField<string>({ path: 'specs.fuelTankCapacityL' })
  const specSource = useField<string>({ path: 'sourceMeta.specSource' })
  const externalMakeId = useField<string>({ path: 'sourceMeta.externalMakeId' })
  const externalModelId = useField<string>({ path: 'sourceMeta.externalModelId' })
  const externalGenerationId = useField<string>({ path: 'sourceMeta.externalGenerationId' })
  const externalTrimId = useField<string>({ path: 'sourceMeta.externalTrimId' })
  const lastSpecSyncAt = useField<string>({ path: 'sourceMeta.lastSpecSyncAt' })

  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState('Listo para buscar especificaciones.')

  function applySpecs(data: AppliedVehicleSpecs) {
    const specs = data.specs || {}

    if (data.brand) brand.setValue(data.brand)
    if (data.model) model.setValue(data.model)
    if (data.trim) trim.setValue(data.trim)
    if (data.year) {
      const numericYear = Number(data.year)
      if (Number.isFinite(numericYear)) year.setValue(numericYear)
    }

    if (specs.tipo) tipo.setValue(specs.tipo)
    if (specs.motor) motor.setValue(specs.motor)
    if (specs.potencia) potencia.setValue(specs.potencia)
    if (specs.transmision) transmision.setValue(specs.transmision)
    if (specs.combustible) combustible.setValue(specs.combustible)
    if (specs.traccion) traccion.setValue(specs.traccion)
    if (specs.cylinders) cylinders.setValue(specs.cylinders)
    if (specs.seats) seats.setValue(specs.seats)
    if (specs.doors) doors.setValue(specs.doors)
    if (specs.lengthMm) lengthMm.setValue(specs.lengthMm)
    if (specs.widthMm) widthMm.setValue(specs.widthMm)
    if (specs.heightMm) heightMm.setValue(specs.heightMm)
    if (specs.wheelbaseMm) wheelbaseMm.setValue(specs.wheelbaseMm)
    if (specs.maxTrunkCapacityL) maxTrunkCapacityL.setValue(specs.maxTrunkCapacityL)
    if (specs.torqueNm) torqueNm.setValue(specs.torqueNm)
    if (specs.fuelTankCapacityL) fuelTankCapacityL.setValue(specs.fuelTankCapacityL)

    if (data.bodyType) bodyType.setValue(data.bodyType)
    if (data.transmission) commercialTransmission.setValue(data.transmission)
    if (data.fuel) fuel.setValue(data.fuel)

    specSource.setValue(data.sourceMeta.specSource)
    externalMakeId.setValue(data.sourceMeta.externalMakeId || '')
    externalModelId.setValue(data.sourceMeta.externalModelId || '')
    externalGenerationId.setValue(data.sourceMeta.externalGenerationId || '')
    externalTrimId.setValue(data.sourceMeta.externalTrimId || '')
    lastSpecSyncAt.setValue(data.sourceMeta.lastSpecSyncAt)

    setStatus(
      'Especificaciones aplicadas. Revisa precio, ubicacion, kilometraje, imagenes y descripcion antes de guardar.',
    )
  }

  return (
    <div className="vehicle-lookup-field">
      <div className="vehicle-lookup-field__header">
        <h3>Busqueda de vehiculo</h3>
        <ActionButton type="button" onClick={() => setOpen(true)} size="sm" variant="secondary">
          Buscar especificaciones
        </ActionButton>
      </div>
      <p className="vehicle-lookup-field__hint">
        Opcional. Busca en el catalogo Car Specs para acelerar la captura de datos tecnicos.
      </p>
      <p className="vehicle-lookup-field__status">{status}</p>

      <VehicleSpecsLookupModal
        defaultMake={brand.value ? String(brand.value) : ''}
        defaultModel={model.value ? String(model.value) : ''}
        defaultYear={year.value ? String(year.value) : ''}
        isOpen={open}
        onApply={applySpecs}
        onClose={() => setOpen(false)}
      />
    </div>
  )
}

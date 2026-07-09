import type { Block, CollectionConfig, Payload } from 'payload'

import {
  calculateVehicleCompleteness,
  deriveImageStatus,
  deriveSpecStatus,
  getVehiclePublishIssues,
  type VehicleLike,
} from '../services/vehicleWorkflow'
import { canManageInventory, isAuthenticated } from '../access/roles'
import {
  approvedVehicleMediaMap,
  relationId,
  sameRelationId,
} from '../services/vehicleMediaPolicy'

const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000'

function slugify(value: string | number | null | undefined) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function shortId(value: string | number | null | undefined) {
  return slugify(value).replace(/-/g, '').slice(0, 6)
}

function generateVehicleSlug({
  brand,
  id,
  model,
  year,
}: {
  brand?: string
  id?: string | number
  model?: string
  year?: number
}) {
  return [slugify(brand), slugify(model), slugify(year), shortId(id)].filter(Boolean).join('-')
}

const brandToDealershipGroup: Record<string, string> = {
  dfac: 'dongfeng',
  dodge: 'stellantis',
  fiat: 'stellantis',
  ford: 'ford',
  jeep: 'stellantis',
  jetour: 'jetour',
  lincoln: 'lincoln',
  mazda: 'mazda',
  peugeot: 'stellantis',
  ram: 'stellantis',
}

async function resolveDealershipId(payload: Payload, brand?: string, city?: string) {
  const normalizedBrand = slugify(brand).replace(/-/g, '')
  const brandName = brandToDealershipGroup[normalizedBrand] || normalizedBrand

  if (!brandName) return undefined

  const cityClause = city
    ? {
        city: {
          equals: city,
        },
      }
    : undefined

  const result = await payload.find({
    collection: 'dealerships',
    depth: 0,
    limit: 1,
    where: {
      and: [
        {
          brandName: {
            equals: brandName,
          },
        },
        ...(cityClause ? [cityClause] : []),
      ],
    },
  })

  return result.docs[0]?.id
}

async function resolveDealershipCity(payload: Payload, dealership: unknown) {
  if (!dealership) return undefined

  if (typeof dealership === 'object' && dealership !== null && 'city' in dealership) {
    const city = (dealership as { city?: unknown }).city
    return typeof city === 'string' && city.trim() ? city.trim() : undefined
  }

  const id = typeof dealership === 'string' || typeof dealership === 'number' ? dealership : undefined
  if (!id) return undefined

  try {
    const doc = await payload.findByID({
      collection: 'dealerships',
      id,
      depth: 0,
    })
    return typeof doc?.city === 'string' && doc.city.trim() ? doc.city.trim() : undefined
  } catch {
    return undefined
  }
}

function formatMXN(value: unknown) {
  const text = String(value ?? '').trim()
  if (!text) return text

  const parts = text.split(/\s*[-–]\s*/)
  const formattedParts = parts.map((part) => {
    const numeric = Number(part.replace(/[^\d.]/g, ''))
    if (!Number.isFinite(numeric) || numeric <= 0) return part.trim()
    return `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(numeric)}`
  })

  const formatted = formattedParts.join(' - ')
  return /mxn$/i.test(formatted) ? formatted : `${formatted} MXN`
}

const VehicleImageTextBlock: Block = {
  slug: 'imageText',
  labels: {
    singular: 'Imagen y texto',
    plural: 'Imagen y texto',
  },
  fields: [
    { name: 'eyebrow', type: 'text', label: 'Etiqueta' },
    { name: 'heading', type: 'text', required: true, label: 'Titulo' },
    { name: 'body', type: 'textarea', label: 'Texto' },
    { name: 'image', type: 'upload', relationTo: 'media', label: 'Imagen' },
    {
      name: 'imagePosition',
      type: 'select',
      defaultValue: 'left',
      label: 'Posicion de imagen',
      options: [
        { label: 'Izquierda', value: 'left' },
        { label: 'Derecha', value: 'right' },
      ],
    },
  ],
}

const VehicleGalleryBlock: Block = {
  slug: 'gallery',
  labels: {
    singular: 'Galeria',
    plural: 'Galerias',
  },
  fields: [
    { name: 'heading', type: 'text', label: 'Titulo' },
    {
      name: 'images',
      type: 'array',
      label: 'Imagenes',
      fields: [
        { name: 'image', type: 'upload', relationTo: 'media', required: true, label: 'Imagen' },
        { name: 'alt', type: 'text', label: 'Texto alternativo' },
      ],
    },
  ],
}

const VehicleHighlightListBlock: Block = {
  slug: 'highlightList',
  labels: {
    singular: 'Lista de puntos clave',
    plural: 'Listas de puntos clave',
  },
  fields: [
    { name: 'heading', type: 'text', required: true, label: 'Titulo' },
    { name: 'body', type: 'textarea', label: 'Texto' },
    {
      name: 'items',
      type: 'array',
      label: 'Puntos',
      fields: [
        { name: 'label', type: 'text', required: true, label: 'Titulo' },
        { name: 'description', type: 'textarea', label: 'Descripcion' },
      ],
    },
  ],
}

const VehicleFeatureGridBlock: Block = {
  slug: 'featureGrid',
  labels: {
    singular: 'Cuadricula de beneficios',
    plural: 'Cuadriculas de beneficios',
  },
  fields: [
    { name: 'heading', type: 'text', required: true, label: 'Titulo' },
    {
      name: 'items',
      type: 'array',
      label: 'Beneficios',
      fields: [{ name: 'feature', type: 'text', required: true, label: 'Beneficio' }],
    },
  ],
}

const VehicleCtaBlock: Block = {
  slug: 'cta',
  labels: {
    singular: 'Llamado a acción',
    plural: 'Llamados a acción',
  },
  fields: [
    { name: 'heading', type: 'text', required: true, label: 'Titulo' },
    { name: 'body', type: 'textarea', label: 'Texto' },
    { name: 'buttonLabel', type: 'text', label: 'Texto del boton', defaultValue: 'Consultar por WhatsApp' },
  ],
}

const vehicleLandingBlocks = [
  VehicleImageTextBlock,
  VehicleGalleryBlock,
  VehicleHighlightListBlock,
  VehicleFeatureGridBlock,
  VehicleCtaBlock,
]

const templateOverrideOptions = [
  { label: 'Usar plantilla global', value: 'inherit' },
  { label: 'Mostrar', value: 'show' },
  { label: 'Ocultar', value: 'hide' },
]

export const Vehicles: CollectionConfig = {
  slug: 'vehicles',
  access: {
    read: isAuthenticated,
    create: canManageInventory,
    update: canManageInventory,
    delete: canManageInventory,
  },
  hooks: {
    beforeChange: [
      ({ data, operation, originalDoc, req }) => {
        if (operation === 'update' && originalDoc) {
          data.uuid = originalDoc.uuid
          data.slug = originalDoc.slug
        }

        // Track publish lifecycle transitions.
        const previousStatus = originalDoc?.publishStatus
        const nextStatus = data.publishStatus

        if (nextStatus === 'published' && previousStatus !== 'published') {
          data.publishedAt = new Date().toISOString()
          if (req?.user?.id) data.lastPublishedBy = req.user.id
        }

        if (nextStatus === 'needs_review' && previousStatus !== 'needs_review') {
          data.lastReviewedAt = new Date().toISOString()
          if (req?.user?.id) data.lastReviewedBy = req.user.id
        }

        return data
      },
    ],
    beforeValidate: [
      async ({ data, operation, originalDoc, req }) => {
        if (!data) return data

        const original = originalDoc ? ({ ...originalDoc } as Record<string, unknown>) : {}

        if (!data.inventoryStatus && data.status) {
          data.inventoryStatus = data.status
        }

        if (operation === 'create' && !data.publishStatus) {
          data.publishStatus = 'draft'
        }

        const uuid = data.uuid || crypto.randomUUID()
        data.uuid = uuid

        if (operation === 'create' || !data.slug) {
          data.slug = generateVehicleSlug({
            brand: data.brand,
            id: uuid,
            model: data.model,
            year: data.year,
          })
        }

        if (data.price) {
          data.price = formatMXN(data.price)
        }

        if (!data.dealership) {
          const dealershipId = await resolveDealershipId(req.payload, data.brand, data.city)
          if (dealershipId) {
            data.dealership = dealershipId
          }
        }

        if (!data.city && data.dealership) {
          const dealershipCity = await resolveDealershipCity(req.payload, data.dealership)
          if (dealershipCity) data.city = dealershipCity
        }

        // Derive completeness and lifecycle statuses from the assembled data.
        const vehicleLike = { ...original, ...data } as VehicleLike
        const vehicleId = relationId(data.id ?? original.id)
        const imageChanged =
          operation === 'create'
            ? relationId(vehicleLike.image) !== undefined
            : Object.prototype.hasOwnProperty.call(data, 'image') &&
              !sameRelationId(original.image, data.image)
        const approvedMedia =
          vehicleId === undefined
            ? new Set<string>()
            : (await approvedVehicleMediaMap(req.payload, [
                {
                  id: vehicleId,
                  image: vehicleLike.image,
                  gallery: vehicleLike.gallery,
                  landing: vehicleLike.landing,
                },
              ])).get(String(vehicleId)) || new Set<string>()
        const heroMediaId = relationId(vehicleLike.image)
        const heroIsApproved =
          heroMediaId !== undefined && approvedMedia.has(String(heroMediaId))

        const derivedImageStatus = deriveImageStatus(
          imageChanged && !heroIsApproved
            ? ({ ...vehicleLike, imageStatus: undefined } as VehicleLike)
            : vehicleLike,
        )
        data.imageStatus =
          derivedImageStatus === 'approved' && !heroIsApproved
            ? heroMediaId === undefined
              ? 'missing'
              : 'uploaded'
            : derivedImageStatus
        data.specStatus = deriveSpecStatus(vehicleLike)
        const derivedVehicleLike = {
          ...vehicleLike,
          imageStatus: data.imageStatus,
          specStatus: data.specStatus,
        } as VehicleLike
        data.completenessScore = calculateVehicleCompleteness(derivedVehicleLike)

        if (derivedVehicleLike.publishStatus === 'published') {
          const issues = getVehiclePublishIssues(derivedVehicleLike, { approvedMediaIds: approvedMedia })
          if (issues.critical.length > 0) {
            throw new Error(`No se puede publicar el vehiculo: ${issues.critical.join(' ')}`)
          }
        }

        return data
      },
    ],
  },
  admin: {
    // Inventario (/admin/inventory) is the primary operator UI and the
    // collection stays hidden from nav. Native Payload vehicle routes remain
    // directly reachable as an emergency/schema fallback, not the daily flow.
    group: false,
    useAsTitle: 'model',
    defaultColumns: [
      'brand',
      'model',
      'year',
      'price',
      'condition',
      'publishStatus',
      'imageStatus',
      'completenessScore',
      'inventoryStatus',
    ],
    listSearchableFields: ['slug', 'brand', 'model', 'city', 'stockId', 'sourceId'],
    livePreview: {
      breakpoints: [
        { label: 'Mobile', name: 'mobile', width: 390, height: 844 },
        { label: 'Desktop', name: 'desktop', width: 1440, height: 900 },
      ],
      url: ({ data }) => `${FRONTEND_URL}/cars/${typeof data?.slug === 'string' ? data.slug : ''}`,
    },
    preview: (doc) => `${FRONTEND_URL}/cars/${typeof doc?.slug === 'string' ? doc.slug : ''}`,
    components: {
      views: {
        edit: {
          workspace: {
            Component: './components/views/VehicleWorkspaceView',
            path: '/workspace',
            tab: {
              label: 'Espacio de trabajo',
              href: '/workspace',
              order: 100,
            },
          },
        },
      },
    },
  },
  labels: {
    singular: 'Vehículo',
    plural: 'Vehículos',
  },
  fields: [
    {
      name: 'vehicleLinks',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field: {
            path: './components/VehicleAdminLinks',
          },
        },
      },
    },
    {
      name: 'vehicleLandingPreview',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field: {
            path: './components/VehicleLandingPreview',
          },
        },
      },
    },
    {
      name: 'uuid',
      type: 'text',
      unique: true,
      admin: {
        hidden: true,
        readOnly: true,
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      label: 'Slug',
      admin: {
        description: 'Se genera al guardar con marca, modelo, año y UUID del vehículo.',
        readOnly: true,
      },
    },
    { name: 'brand', type: 'text', required: true, label: 'Marca' },
    { name: 'modelFamily', type: 'text', label: 'Familia de modelo' },
    { name: 'model', type: 'text', required: true, label: 'Modelo' },
    { name: 'trim', type: 'text', label: 'Versión / Trim' },
    {
      name: 'year',
      type: 'number',
      label: 'Año',
      admin: { description: 'Requerido para publicar. Opcional al importar borradores.' },
    },
    {
      name: 'exteriorColor',
      type: 'text',
      label: 'Color exterior',
    },
    {
      name: 'interiorColor',
      type: 'text',
      label: 'Color interior',
    },
    {
      name: 'vehicleType',
      type: 'text',
      label: 'Tipo de vehículo',
      admin: { description: 'Mapeado desde DES_TIPO_VEHICULO en importaciones.' },
    },
    {
      name: 'segment',
      type: 'text',
      label: 'Segmento',
      admin: { description: 'Mapeado desde DES_SEGMENTO en importaciones.' },
    },
    {
      name: 'motorType',
      type: 'text',
      label: 'Tipo de motor',
      admin: { description: 'Mapeado desde DES_TIPO_MOTOR en importaciones.' },
    },
    {
      name: 'stockId',
      type: 'text',
      label: 'ID publico de inventario',
      admin: {
        description: 'Referencia visible para ventas y WhatsApp. Si se deja vacio se usara el UUID corto.',
      },
    },
    {
      name: 'condition',
      type: 'select',
      required: true,
      defaultValue: 'new',
      label: 'Condicion',
      options: [
        { label: 'Nuevo', value: 'new' },
        { label: 'Seminuevo', value: 'used' },
      ],
    },
    {
      name: 'dealership',
      type: 'relationship',
      relationTo: 'dealerships',
      label: 'Agencia responsable',
      admin: {
        description:
          'Define a que agencia pertenece esta unidad y a que WhatsApp se enviaran los leads. Requerida para publicar salvo fallback explicito.',
      },
    },
    {
      name: 'city',
      type: 'text',
      label: 'Ciudad de inventario',
      admin: {
        description: 'Opcional. Si se deja vacia, la pagina usara la ciudad de la agencia seleccionada.',
      },
    },
    { name: 'mileage', type: 'number', label: 'Kilometraje' },
    {
      name: 'bodyType',
      type: 'select',
      label: 'Tipo de carroceria',
      options: [
        { label: 'Sedan', value: 'sedan' },
        { label: 'SUV', value: 'suv' },
        { label: 'Pickup', value: 'pickup' },
        { label: 'Coupe', value: 'coupe' },
        { label: 'Hatchback', value: 'hatchback' },
        { label: 'Van', value: 'van' },
        { label: 'Otro', value: 'other' },
      ],
    },
    {
      name: 'transmission',
      type: 'select',
      label: 'Transmision comercial',
      options: [
        { label: 'Automatica', value: 'automatic' },
        { label: 'Manual', value: 'manual' },
        { label: 'CVT', value: 'cvt' },
      ],
    },
    {
      name: 'fuel',
      type: 'select',
      label: 'Combustible comercial',
      options: [
        { label: 'Gasolina', value: 'gasoline' },
        { label: 'Diesel', value: 'diesel' },
        { label: 'Hibrido', value: 'hybrid' },
        { label: 'Electrico', value: 'electric' },
      ],
    },
    {
      name: 'badges',
      type: 'array',
      label: 'Tags para filtros y ventas',
      admin: {
        description: 'Crea etiquetas como Un dueno, Garantia, Factura agencia, Promo o Recien llegado.',
      },
      labels: {
        singular: 'Tag',
        plural: 'Tags',
      },
      fields: [{ name: 'label', type: 'text', required: true, label: 'Tag' }],
    },
    {
      name: 'tags',
      type: 'relationship',
      relationTo: 'vehicle-tags',
      hasMany: true,
      label: 'Tags de catálogo',
      admin: {
        description: 'Etiquetas reutilizables para colecciones, filtros y tarjetas publicas.',
      },
    },
    {
      name: 'featured',
      type: 'checkbox',
      defaultValue: false,
      label: 'Destacado',
      admin: {
        description: 'Marca esta unidad para bloques editoriales o colecciones inteligentes.',
      },
    },
    {
      name: 'price',
      type: 'text',
      label: 'Precio',
      admin: {
        description: 'Requerido para publicar. Opcional al importar. Escribe un número o rango; se guardará como MXN.',
        placeholder: '398900 or 599000 - 798500',
        components: {
          afterInput: [
            {
              path: './components/PriceFormatter',
            },
          ],
        },
      },
    },
    {
      name: 'inventoryStatus',
      type: 'select',
      required: true,
      label: 'Estatus',
      defaultValue: 'available',
      options: [
        { label: 'Disponible', value: 'available' },
        { label: 'Apartado', value: 'reserved' },
        { label: 'Vendido', value: 'sold' },
      ],
    },
    {
      name: 'publishStatus',
      type: 'select',
      label: 'Estado de publicación',
      defaultValue: 'draft',
      admin: { position: 'sidebar' },
      options: [
        { label: 'Borrador', value: 'draft' },
        { label: 'En revisión', value: 'needs_review' },
        { label: 'Publicado', value: 'published' },
        { label: 'Archivado', value: 'archived' },
      ],
    },
    {
      name: 'allowFallbackRouting',
      type: 'checkbox',
      label: 'Permitir fallback WhatsApp',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description:
          'Permite publicar usando el WhatsApp global si todavia no hay agencia exacta. Usar solo como excepcion operativa.',
      },
    },
    {
      name: 'imageStatus',
      type: 'select',
      label: 'Estado de imagen',
      defaultValue: 'missing',
      admin: {
        position: 'sidebar',
        description: 'Se calcula automáticamente salvo aprobaciones/rechazos manuales.',
      },
      options: [
        { label: 'Sin imagen', value: 'missing' },
        { label: 'Candidata encontrada', value: 'candidate_found' },
        { label: 'Subida', value: 'uploaded' },
        { label: 'Generada con IA', value: 'generated' },
        { label: 'Aprobada', value: 'approved' },
        { label: 'Rechazada', value: 'rejected' },
      ],
    },
    {
      name: 'specStatus',
      type: 'select',
      label: 'Estado de especificaciones',
      defaultValue: 'missing',
      admin: { position: 'sidebar' },
      options: [
        { label: 'Sin especificaciones', value: 'missing' },
        { label: 'Parciales', value: 'partial' },
        { label: 'Coincidencia automática', value: 'matched' },
        { label: 'Manual', value: 'manual' },
        { label: 'Verificadas', value: 'verified' },
      ],
    },
    {
      name: 'completenessScore',
      type: 'number',
      label: 'Completitud (%)',
      defaultValue: 0,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Calculado automáticamente al guardar.',
      },
    },
    {
      name: 'publishedAt',
      type: 'date',
      label: 'Publicado el',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'lastPublishedBy',
      type: 'relationship',
      relationTo: 'users',
      label: 'Publicado por',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'lastReviewedAt',
      type: 'date',
      label: 'Revisado el',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'lastReviewedBy',
      type: 'relationship',
      relationTo: 'users',
      label: 'Revisado por',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'reviewNotes',
      type: 'textarea',
      label: 'Notas de revisión',
      admin: { position: 'sidebar' },
    },
    {
      name: 'sourceId',
      type: 'text',
      label: 'ID de origen (IDV)',
      admin: { description: 'Identificador del inventario de origen para detectar duplicados.' },
    },
    {
      name: 'sourceImportId',
      type: 'text',
      label: 'ID del trabajo de importación',
      admin: { hidden: true },
    },
    {
      name: 'sourceDealerName',
      type: 'text',
      label: 'Agencia de origen (texto)',
      admin: { description: 'Nombre de agencia tal como vino en el archivo importado.' },
    },
    {
      name: 'imageUrl',
      type: 'text',
      label: 'URL publica de imagen sincronizada',
      admin: { hidden: true },
    },
    {
      name: 'imagePath',
      type: 'text',
      label: 'Ruta de imagen sincronizada',
      admin: { hidden: true },
    },
    {
      name: 'imageFilename',
      type: 'text',
      label: 'Archivo de imagen sincronizada',
      admin: { hidden: true },
    },
    {
      name: 'image',
      type: 'upload',
      label: 'Imagen',
      relationTo: 'media',
    },
    {
      name: 'gallery',
      type: 'array',
      label: 'Galeria de seminuevo',
      fields: [
        { name: 'image', type: 'upload', relationTo: 'media', required: true },
        { name: 'alt', type: 'text' },
      ],
    },
    { name: 'description', type: 'textarea', label: 'Descripción' },
    {
      name: 'features',
      type: 'array',
      label: 'Características',
      labels: {
        singular: 'Característica',
        plural: 'Características',
      },
      fields: [{ name: 'feature', type: 'text', required: true, label: 'Característica' }],
    },
    {
      name: 'specs',
      type: 'group',
      label: 'Especificaciones',
      fields: [
        { name: 'tipo', type: 'text', label: 'Tipo / carroceria' },
        { name: 'motor', type: 'text', label: 'Motor' },
        { name: 'potencia', type: 'text', label: 'Potencia' },
        { name: 'transmision', type: 'text', label: 'Transmisión' },
        { name: 'combustible', type: 'text', label: 'Combustible' },
        { name: 'traccion', type: 'text', label: 'Tracción' },
        { name: 'cylinders', type: 'text', label: 'Cilindros' },
        { name: 'seats', type: 'text', label: 'Asientos' },
        { name: 'doors', type: 'text', label: 'Puertas' },
        { name: 'lengthMm', type: 'text', label: 'Largo (mm)' },
        { name: 'widthMm', type: 'text', label: 'Ancho (mm)' },
        { name: 'heightMm', type: 'text', label: 'Alto (mm)' },
        { name: 'wheelbaseMm', type: 'text', label: 'Distancia entre ejes (mm)' },
        { name: 'maxTrunkCapacityL', type: 'text', label: 'Capacidad cajuela (L)' },
        { name: 'torqueNm', type: 'text', label: 'Torque (Nm)' },
        { name: 'fuelTankCapacityL', type: 'text', label: 'Tanque combustible (L)' },
      ],
    },
    {
      name: 'sourceMeta',
      type: 'group',
      label: 'Origen de especificaciones',
      admin: {
        description: 'Datos técnicos normalizados desde catálogo interno o RapidAPI.',
        hidden: true,
      },
      fields: [
        {
          name: 'specSource',
          type: 'select',
          label: 'Fuente',
          defaultValue: 'manual',
          options: [
            { label: 'Catalogo interno', value: 'catalog' },
            { label: 'RapidAPI', value: 'rapidapi' },
            { label: 'Manual', value: 'manual' },
            { label: 'Sin fuente', value: 'none' },
          ],
        },
        { name: 'externalMakeId', type: 'text', label: 'RapidAPI make ID' },
        { name: 'externalModelId', type: 'text', label: 'RapidAPI model ID' },
        { name: 'externalGenerationId', type: 'text', label: 'RapidAPI generation ID' },
        { name: 'externalTrimId', type: 'text', label: 'RapidAPI trim ID' },
        { name: 'lastSpecSyncAt', type: 'date', label: 'Ultima sincronizacion de specs' },
      ],
    },
    {
      name: 'customFields',
      type: 'array',
      label: 'Campos personalizados',
      admin: {
        description: 'Datos importados desde CSV que no pertenecen al esquema principal.',
        hidden: true,
      },
      labels: {
        singular: 'Campo personalizado',
        plural: 'Campos personalizados',
      },
      fields: [
        { name: 'name', type: 'text', required: true, label: 'Nombre' },
        { name: 'value', type: 'text', required: true, label: 'Valor' },
      ],
    },
    {
      name: 'landing',
      type: 'blocks',
      label: 'Bloques de contenido',
      admin: {
        description:
          'Agrega secciones simples debajo de la página del vehículo: imagen y texto, galerías, beneficios o CTA.',
      },
      blocks: vehicleLandingBlocks,
    },
    {
      name: 'templateOverrides',
      type: 'group',
      label: 'Visibilidad de plantilla',
      admin: {
        description: 'Controla secciones fijas de la página de detalle para este vehículo.',
      },
      fields: [
        { name: 'gallery', type: 'select', defaultValue: 'inherit', options: templateOverrideOptions },
        { name: 'purchaseCard', type: 'select', defaultValue: 'inherit', options: templateOverrideOptions },
        { name: 'quickSpecs', type: 'select', defaultValue: 'inherit', options: templateOverrideOptions },
        { name: 'description', type: 'select', defaultValue: 'inherit', options: templateOverrideOptions },
        { name: 'features', type: 'select', defaultValue: 'inherit', options: templateOverrideOptions },
        { name: 'similarVehicles', type: 'select', defaultValue: 'inherit', options: templateOverrideOptions },
        { name: 'mobileCta', type: 'select', defaultValue: 'inherit', options: templateOverrideOptions },
      ],
    },
  ],
}

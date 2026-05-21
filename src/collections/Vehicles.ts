import type { Block, CollectionConfig, Payload } from 'payload'

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
    singular: 'Llamado a accion',
    plural: 'Llamados a accion',
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

export const Vehicles: CollectionConfig = {
  slug: 'vehicles',
  access: {
    read: () => true,
  },
  hooks: {
    beforeChange: [
      ({ data, operation, originalDoc }) => {
        if (operation !== 'update' || !originalDoc) return data

        data.uuid = originalDoc.uuid
        data.slug = originalDoc.slug

        return data
      },
    ],
    beforeValidate: [
      async ({ data, operation, req }) => {
        if (!data) return data

        if (!data.inventoryStatus && data.status) {
          data.inventoryStatus = data.status
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

        return data
      },
    ],
  },
  admin: {
    useAsTitle: 'model',
    defaultColumns: ['brand', 'model', 'year', 'price', 'condition', 'city', 'inventoryStatus'],
    listSearchableFields: ['slug', 'brand', 'model', 'city'],
    livePreview: {
      breakpoints: [
        { label: 'Mobile', name: 'mobile', width: 390, height: 844 },
        { label: 'Desktop', name: 'desktop', width: 1440, height: 900 },
      ],
      url: ({ data }) => `${FRONTEND_URL}/cars/${typeof data?.slug === 'string' ? data.slug : ''}`,
    },
    preview: (doc) => `${FRONTEND_URL}/cars/${typeof doc?.slug === 'string' ? doc.slug : ''}`,
    components: {
      beforeList: [
        {
          path: './components/VehicleImportLink',
        },
      ],
    },
  },
  labels: {
    singular: 'Vehículo',
    plural: 'Vehículos',
  },
  fields: [
    {
      name: 'vehicleLookup',
      type: 'ui',
      admin: {
        components: {
          Field: {
            path: './components/VehicleLookupField',
          },
        },
      },
    },
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
    { name: 'model', type: 'text', required: true, label: 'Modelo' },
    { name: 'year', type: 'number', required: true, label: 'Año' },
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
      required: true,
      label: 'Agencia responsable',
      admin: {
        description: 'Define a que agencia pertenece esta unidad y a que WhatsApp se enviaran los leads.',
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
      name: 'price',
      type: 'text',
      required: true,
      label: 'Precio',
      admin: {
        description: 'Escribe un número o rango. Se guardará automáticamente como MXN.',
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
        description: 'Datos tecnicos normalizados desde catalogo interno o RapidAPI.',
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
          'Agrega secciones simples debajo de la pagina del vehiculo: imagen y texto, galerias, beneficios o CTA.',
      },
      blocks: vehicleLandingBlocks,
    },
  ],
}

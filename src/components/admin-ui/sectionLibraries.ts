import type { FieldControl, LibraryEntry } from './SectionBuilder'

/**
 * Visual "Add Section" libraries for the site builders.
 *
 * These mirror the Payload block definitions (src/blocks/SiteSections.ts and the
 * vehicle landing blocks in src/collections/Vehicles.ts). `defaults` seed a new
 * block with sensible scalar values so the inspector has fields to edit; the
 * underlying Payload block schema remains the source of truth.
 */

const BODY_TYPE_OPTIONS = [
  { label: 'Todas', value: '' },
  { label: 'Sedan', value: 'sedan' },
  { label: 'SUV', value: 'suv' },
  { label: 'Pickup', value: 'pickup' },
  { label: 'Coupe', value: 'coupe' },
  { label: 'Hatchback', value: 'hatchback' },
  { label: 'Van', value: 'van' },
  { label: 'Otro', value: 'other' },
]

const CITY_INVENTORY_CONTROLS: FieldControl[] = [
  {
    key: 'layout',
    label: 'Diseno',
    type: 'select',
    defaultValue: 'cards',
    options: [
      { label: 'Tarjetas', value: 'cards' },
      { label: 'Lista compacta', value: 'compact' },
      { label: 'Mapa editorial', value: 'map' },
    ],
  },
  { key: 'limit', label: 'Limite por ciudad', type: 'number' },
  {
    key: 'cities',
    label: 'Ciudades',
    type: 'array',
    itemLabel: 'Ciudad',
    addLabel: 'Agregar ciudad',
    advancedNote: 'Las imagenes de ciudad se pueden asignar en la edicion a detalle.',
    fields: [
      { key: 'city', label: 'Ciudad', type: 'text' },
      { key: 'label', label: 'Texto visible', type: 'text' },
      { key: 'href', label: 'URL', type: 'text' },
    ],
  },
]

const PROMO_BANNER_CONTROLS: FieldControl[] = [
  {
    key: 'variant',
    label: 'Variante',
    type: 'select',
    defaultValue: 'image',
    options: [
      { label: 'Imagen completa', value: 'image' },
      { label: 'Texto + imagen', value: 'split' },
      { label: 'Compacto', value: 'compact' },
    ],
  },
  {
    key: 'theme',
    label: 'Tema',
    type: 'select',
    defaultValue: 'brand',
    options: [
      { label: 'Marca', value: 'brand' },
      { label: 'Claro', value: 'light' },
      { label: 'Oscuro', value: 'dark' },
    ],
  },
  { key: 'imageAlt', label: 'Texto alternativo', type: 'text' },
  { key: 'href', label: 'URL de banner', type: 'text' },
  { key: 'ctaLabel', label: 'Texto de CTA', type: 'text' },
  { key: 'ctaHref', label: 'URL de CTA', type: 'text' },
]

const TRUST_STEPS_CONTROLS: FieldControl[] = [
  {
    key: 'layout',
    label: 'Diseno',
    type: 'select',
    defaultValue: 'steps',
    options: [
      { label: 'Pasos', value: 'steps' },
      { label: 'Tarjetas', value: 'cards' },
    ],
  },
  {
    key: 'steps',
    label: 'Pasos',
    type: 'array',
    itemLabel: 'Paso',
    addLabel: 'Agregar paso',
    fields: [
      {
        key: 'icon',
        label: 'Icono',
        type: 'select',
        defaultValue: 'search',
        options: [
          { label: 'Busqueda', value: 'search' },
          { label: 'Revision', value: 'inspection' },
          { label: 'Financiamiento', value: 'financing' },
          { label: 'Entrega', value: 'delivery' },
          { label: 'Garantia', value: 'shield' },
        ],
      },
      { key: 'label', label: 'Titulo', type: 'text' },
      { key: 'description', label: 'Descripcion', type: 'textarea' },
    ],
  },
]

const TESTIMONIALS_CONTROLS: FieldControl[] = [
  {
    key: 'layout',
    label: 'Diseno',
    type: 'select',
    defaultValue: 'carousel',
    options: [
      { label: 'Carrusel', value: 'carousel' },
      { label: 'Cuadricula', value: 'grid' },
    ],
  },
  {
    key: 'items',
    label: 'Testimonios',
    type: 'array',
    itemLabel: 'Testimonio',
    addLabel: 'Agregar testimonio',
    advancedNote: 'Las fotos de cliente se pueden asignar en la edicion a detalle.',
    fields: [
      { key: 'quote', label: 'Cita', type: 'textarea' },
      { key: 'author', label: 'Autor', type: 'text' },
      { key: 'role', label: 'Detalle', type: 'text' },
      { key: 'city', label: 'Ciudad', type: 'text' },
      { key: 'rating', label: 'Calificacion', type: 'number', defaultValue: 5 },
    ],
  },
  { key: 'ctaLabel', label: 'Texto de CTA', type: 'text' },
  { key: 'ctaHref', label: 'URL de CTA', type: 'text' },
]

const VIDEO_TIPS_CONTROLS: FieldControl[] = [
  {
    key: 'layout',
    label: 'Diseno',
    type: 'select',
    defaultValue: 'featured',
    options: [
      { label: 'Destacado + lista', value: 'featured' },
      { label: 'Cuadricula', value: 'grid' },
    ],
  },
  {
    key: 'videos',
    label: 'Videos',
    type: 'array',
    itemLabel: 'Video',
    addLabel: 'Agregar video',
    advancedNote: 'Las miniaturas se pueden asignar en la edicion a detalle.',
    fields: [
      { key: 'title', label: 'Titulo', type: 'text' },
      { key: 'description', label: 'Descripcion', type: 'textarea' },
      { key: 'videoUrl', label: 'Video URL', type: 'text' },
      { key: 'duration', label: 'Duracion', type: 'text' },
    ],
  },
  { key: 'ctaLabel', label: 'Texto de CTA', type: 'text' },
  { key: 'ctaHref', label: 'URL de CTA', type: 'text' },
]

export const SITE_SECTION_LIBRARY: LibraryEntry[] = [
  {
    blockType: 'hero',
    label: 'Hero',
    description: 'Banner principal con titulo, texto e imagen.',
    defaults: { eyebrow: '', heading: 'Titulo principal', body: '' },
  },
  {
    blockType: 'promoStrip',
    label: 'Promo strip',
    description: 'Tira de promociones con imagenes enlazables.',
    defaults: {},
  },
  {
    blockType: 'featuredVehicles',
    label: 'Vehiculos destacados',
    description: 'Carrusel de seminuevos automaticos o seleccionados.',
    defaults: { eyebrow: 'Seminuevos', heading: 'Vehiculos destacados', body: '', limit: 6 },
    controls: [
      {
        key: 'source',
        label: 'Fuente',
        type: 'select',
        defaultValue: 'latestUsed',
        options: [
          { label: 'Ultimos seminuevos', value: 'latestUsed' },
          { label: 'Seleccion manual', value: 'manual' },
          { label: 'Filtrar por ciudad', value: 'city' },
          { label: 'Filtrar por marca', value: 'brand' },
          { label: 'Filtrar por carroceria', value: 'bodyType' },
        ],
      },
      { key: 'bodyType', label: 'Carroceria', type: 'select', options: BODY_TYPE_OPTIONS },
    ],
  },
  {
    blockType: 'inventoryCollection',
    label: 'Coleccion de inventario',
    description: 'Bloque alimentado por una coleccion manual o inteligente.',
    defaults: {
      heading: 'Seminuevos destacados',
      body: '',
      layout: 'grid',
      limit: 8,
      ctaLabel: 'Ver todos',
      ctaHref: '/seminuevos',
    },
  },
  {
    blockType: 'inventorySearch',
    label: 'Busqueda de inventario',
    description: 'Buscador con filtros de ciudad, marca y carroceria.',
    defaults: { eyebrow: 'Inventario', heading: 'Encuentra tu seminuevo', body: '', limit: 6 },
    controls: [
      { key: 'bodyType', label: 'Carroceria inicial', type: 'select', options: BODY_TYPE_OPTIONS },
    ],
  },
  {
    blockType: 'cityInventory',
    label: 'Inventario por ciudad',
    description: 'Accesos por ciudad con filtros hacia el inventario.',
    defaults: {
      eyebrow: 'Inventario por ciudad',
      heading: 'Encuentra seminuevos cerca de ti',
      body: '',
      layout: 'cards',
      limit: 6,
      cities: [
        { city: 'Queretaro', label: 'Queretaro', href: '/seminuevos?city=Queretaro' },
        {
          city: 'San Luis Potosi',
          label: 'San Luis Potosi',
          href: '/seminuevos?city=San%20Luis%20Potosi',
        },
        { city: 'Leon', label: 'Leon', href: '/seminuevos?city=Leon' },
      ],
      ctaLabel: 'Ver todo el inventario',
      ctaHref: '/seminuevos',
    },
    controls: CITY_INVENTORY_CONTROLS,
  },
  {
    blockType: 'promoBanner',
    label: 'Promo banner',
    description: 'Banner de campana con imagen, tema y CTA.',
    defaults: {
      eyebrow: 'Promocion',
      heading: 'Promocion especial',
      body: '',
      variant: 'image',
      theme: 'brand',
      imageAlt: '',
      href: '',
      ctaLabel: 'Ver promocion',
      ctaHref: '/seminuevos',
    },
    controls: PROMO_BANNER_CONTROLS,
  },
  {
    blockType: 'trustSteps',
    label: 'Pasos de confianza',
    description: 'Proceso de compra explicado en pasos claros.',
    defaults: {
      eyebrow: 'Compra con confianza',
      heading: 'Te acompanamos en cada paso',
      body: '',
      layout: 'steps',
      steps: [
        {
          icon: 'search',
          label: 'Elige tu auto',
          description: 'Compara opciones disponibles por ciudad, marca y presupuesto.',
        },
        {
          icon: 'inspection',
          label: 'Revisamos contigo',
          description: 'Validamos detalles, documentos y condiciones antes de avanzar.',
        },
        {
          icon: 'delivery',
          label: 'Agenda tu entrega',
          description: 'Coordinamos el cierre con la agencia que tiene la unidad.',
        },
      ],
    },
    controls: TRUST_STEPS_CONTROLS,
  },
  {
    blockType: 'testimonials',
    label: 'Testimonios',
    description: 'Historias breves de clientes con calificacion.',
    defaults: {
      eyebrow: 'Clientes felices',
      heading: 'Historias de nuestros clientes',
      body: '',
      layout: 'carousel',
      items: [
        {
          quote: 'Encontramos el auto ideal y el proceso fue muy claro.',
          author: 'Cliente GB',
          role: 'Compra seminuevo',
          city: 'Queretaro',
          rating: 5,
        },
        {
          quote: 'Me ayudaron a comparar opciones sin perder tiempo.',
          author: 'Cliente GB',
          role: 'Asesoria de compra',
          city: 'Leon',
          rating: 5,
        },
      ],
      ctaLabel: 'Hablar con un asesor',
      ctaHref: '/contacto',
    },
    controls: TESTIMONIALS_CONTROLS,
  },
  {
    blockType: 'videoTips',
    label: 'Video tips',
    description: 'Videos cortos para orientar la compra.',
    defaults: {
      eyebrow: 'Guias en video',
      heading: 'Tips para elegir tu proximo auto',
      body: '',
      layout: 'featured',
      videos: [
        {
          title: 'Como elegir un seminuevo',
          description: 'Puntos clave antes de apartar una unidad.',
          videoUrl: '',
          duration: '1:30',
        },
        {
          title: 'Que revisar en una prueba de manejo',
          description: 'Checklist rapido para comparar opciones.',
          videoUrl: '',
          duration: '2:00',
        },
      ],
      ctaLabel: 'Ver mas tips',
      ctaHref: '/seminuevos',
    },
    controls: VIDEO_TIPS_CONTROLS,
  },
  {
    blockType: 'brands',
    label: 'Marcas',
    description: 'Cuadricula de marcas disponibles.',
    defaults: { eyebrow: 'Marcas', heading: 'Las mejores marcas, en un solo lugar', body: '' },
  },
  {
    blockType: 'agencies',
    label: 'Agencias',
    description: 'Listado de agencias con mapa opcional.',
    defaults: { eyebrow: 'Encuentranos', heading: 'Nuestras agencias', body: '', showMap: true },
  },
  {
    blockType: 'mediaText',
    label: 'Imagen y texto',
    description: 'Bloque de imagen con texto a un costado.',
    defaults: { eyebrow: '', heading: 'Titulo', body: '' },
  },
  {
    blockType: 'cta',
    label: 'Llamado a la accion',
    description: 'Bloque de conversion con botones.',
    defaults: { heading: 'Titulo', body: '' },
  },
]

export const VEHICLE_SECTION_LIBRARY: LibraryEntry[] = [
  {
    blockType: 'imageText',
    label: 'Imagen y texto',
    description: 'Imagen del vehiculo con texto descriptivo.',
    defaults: { eyebrow: '', heading: 'Titulo', body: '', imagePosition: 'left' },
    controls: [
      { key: 'eyebrow', label: 'Etiqueta', type: 'text' },
      { key: 'heading', label: 'Titulo', type: 'text' },
      { key: 'body', label: 'Texto', type: 'textarea' },
      { key: 'image', label: 'Imagen', type: 'media' },
      {
        key: 'imagePosition',
        label: 'Posicion de imagen',
        type: 'select',
        defaultValue: 'left',
        options: [
          { label: 'Izquierda', value: 'left' },
          { label: 'Derecha', value: 'right' },
        ],
      },
    ],
  },
  {
    blockType: 'gallery',
    label: 'Galeria',
    description: 'Galeria de imagenes del vehiculo.',
    defaults: { heading: 'Galeria', images: [] },
    controls: [
      { key: 'heading', label: 'Titulo', type: 'text' },
      {
        key: 'images',
        label: 'Imagenes',
        type: 'array',
        itemLabel: 'Imagen',
        addLabel: 'Agregar imagen',
        fields: [
          { key: 'image', label: 'Imagen', type: 'media' },
          { key: 'alt', label: 'Texto alternativo', type: 'text' },
        ],
      },
    ],
  },
  {
    blockType: 'highlightList',
    label: 'Lista de puntos clave',
    description: 'Lista de beneficios destacados.',
    defaults: { heading: 'Titulo', body: '', items: [] },
    controls: [
      { key: 'heading', label: 'Titulo', type: 'text' },
      { key: 'body', label: 'Texto', type: 'textarea' },
      {
        key: 'items',
        label: 'Puntos',
        type: 'array',
        itemLabel: 'Punto',
        addLabel: 'Agregar punto',
        fields: [
          { key: 'label', label: 'Titulo', type: 'text' },
          { key: 'description', label: 'Descripcion', type: 'textarea' },
        ],
      },
    ],
  },
  {
    blockType: 'featureGrid',
    label: 'Cuadricula de beneficios',
    description: 'Cuadricula de caracteristicas.',
    defaults: { heading: 'Titulo', items: [] },
    controls: [
      { key: 'heading', label: 'Titulo', type: 'text' },
      {
        key: 'items',
        label: 'Beneficios',
        type: 'array',
        itemLabel: 'Beneficio',
        addLabel: 'Agregar beneficio',
        fields: [{ key: 'feature', label: 'Beneficio', type: 'text' }],
      },
    ],
  },
  {
    blockType: 'cta',
    label: 'Llamado a la accion',
    description: 'Boton de contacto por WhatsApp.',
    defaults: { heading: 'Titulo', body: '', buttonLabel: 'Consultar por WhatsApp' },
    controls: [
      { key: 'heading', label: 'Titulo', type: 'text' },
      { key: 'body', label: 'Texto', type: 'textarea' },
      { key: 'buttonLabel', label: 'Texto del boton', type: 'text' },
    ],
  },
]

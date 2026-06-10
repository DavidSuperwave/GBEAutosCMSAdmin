import type { LibraryEntry } from './SectionBuilder'

/**
 * Visual "Add Section" libraries for the site builders.
 *
 * These mirror the Payload block definitions (src/blocks/SiteSections.ts and the
 * vehicle landing blocks in src/collections/Vehicles.ts). `defaults` seed a new
 * block with sensible scalar values so the inspector has fields to edit; the
 * underlying Payload block schema remains the source of truth.
 */

export const SITE_SECTION_LIBRARY: LibraryEntry[] = [
  {
    blockType: 'hero',
    label: 'Hero',
    description: 'Banner principal con título, texto e imagen.',
    defaults: { eyebrow: '', heading: 'Título principal', body: '' },
  },
  {
    blockType: 'promoStrip',
    label: 'Promo banner',
    description: 'Tira de promociones con imágenes enlazables.',
    defaults: {},
  },
  {
    blockType: 'featuredVehicles',
    label: 'Vehículos destacados',
    description: 'Carrusel de seminuevos automáticos o seleccionados.',
    defaults: { eyebrow: 'Seminuevos', heading: 'Vehículos destacados', body: '', limit: 6 },
  },
  {
    blockType: 'inventorySearch',
    label: 'Búsqueda de inventario',
    description: 'Buscador con filtros de ciudad, marca y carrocería.',
    defaults: { eyebrow: 'Inventario', heading: 'Encuentra tu seminuevo', body: '', limit: 6 },
  },
  {
    blockType: 'brands',
    label: 'Marcas',
    description: 'Cuadrícula de marcas disponibles.',
    defaults: { eyebrow: 'Marcas', heading: 'Las mejores marcas, en un solo lugar', body: '' },
  },
  {
    blockType: 'agencies',
    label: 'Agencias',
    description: 'Listado de agencias con mapa opcional.',
    defaults: { eyebrow: 'Encuéntranos', heading: 'Nuestras agencias', body: '', showMap: true },
  },
  {
    blockType: 'mediaText',
    label: 'Imagen y texto',
    description: 'Bloque de imagen con texto a un costado.',
    defaults: { eyebrow: '', heading: 'Título', body: '' },
  },
  {
    blockType: 'cta',
    label: 'Llamado a la acción',
    description: 'Bloque de conversión con botones.',
    defaults: { heading: 'Título', body: '' },
  },
]

export const VEHICLE_SECTION_LIBRARY: LibraryEntry[] = [
  {
    blockType: 'imageText',
    label: 'Imagen y texto',
    description: 'Imagen del vehículo con texto descriptivo.',
    defaults: { eyebrow: '', heading: 'Título', body: '', imagePosition: 'left' },
  },
  {
    blockType: 'gallery',
    label: 'Galería',
    description: 'Galería de imágenes del vehículo.',
    defaults: { heading: '' },
  },
  {
    blockType: 'highlightList',
    label: 'Lista de puntos clave',
    description: 'Lista de beneficios destacados.',
    defaults: { heading: 'Título', body: '' },
  },
  {
    blockType: 'featureGrid',
    label: 'Cuadrícula de beneficios',
    description: 'Cuadrícula de características.',
    defaults: { heading: 'Título' },
  },
  {
    blockType: 'cta',
    label: 'Llamado a la acción',
    description: 'Botón de contacto por WhatsApp.',
    defaults: { heading: 'Título', body: '', buttonLabel: 'Consultar por WhatsApp' },
  },
]

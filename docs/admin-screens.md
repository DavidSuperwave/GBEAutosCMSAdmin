# Pantallas del admin (guía de uso)

Esta guía explica cada pantalla personalizada del panel de administración de GBE Autos:
para qué sirve, cómo abrirla y sus acciones principales. Al final hay un mapa de
qué pantalla nueva reemplazará a qué flujo anterior.

> Todas las pantallas nuevas usan las variables de tema (`--theme-*`), así que
> respetan el interruptor de tema (Claro / Oscuro / Auto) de la barra superior.

---

## Barra superior: interruptor de tema

- **Dónde**: esquina superior derecha del admin (junto a la cuenta).
- **Qué hace**: alterna entre **Auto** (sigue el sistema operativo, valor por
  defecto), **Claro** y **Oscuro**. La elección se guarda automáticamente.
- **Uso**: haz clic para ciclar `Auto → Claro → Oscuro → Auto`.

---

## 1. Panel de operaciones (Dashboard)

- **Propósito**: vista de inicio con métricas del inventario y accesos directos.
- **Cómo abrir**: es la pantalla de inicio del admin (`/admin`).
- **Acciones principales**:
  - Tarjetas de acceso rápido: Inventario, **Taller de imágenes** (→ `/admin/inventory`),
    constructores y plantillas.
  - Métricas resumidas y lista de importaciones recientes.

## 2. Inventario (gestión) — `/admin/inventory`

- **Propósito**: unidad principal para crear e importar vehículos y gestionarlos
  en una vista de tabla enriquecida (publicación, imágenes, especificaciones,
  completitud).
- **Cómo abrir**: menú lateral **Herramientas → Inventario (gestión)**.
- **Acciones principales**:
  - **Importar CSV/XLSX** (sin API): crea borradores de vehículos desde un archivo.
  - **+ Nuevo vehículo**: formulario de alta; la búsqueda de especificaciones por
    API (RapidAPI) es **opcional** y solo se ejecuta al pulsar "Buscar
    especificaciones" en el alta manual.
  - Filtrar/buscar vehículos y revisar su nivel de completitud.
  - Saltar al **Espacio de trabajo** de un vehículo para editarlo.

## 3. Espacio de trabajo del vehículo — pestaña en la edición del vehículo

- **Propósito**: editar un vehículo por pasos (Resumen, Especificaciones,
  Imágenes, Página de listado, Revisión y publicación, Actividad).
- **Cómo abrir**: abre un vehículo (`/admin/collections/vehicles/:id`) y usa la
  pestaña **Espacio de trabajo**.
- **Acciones principales**:
  - Completar datos por sección y ver el checklist de completitud.
  - Revisar y publicar; ver el historial de actividad.

## 4. Taller de IA — dentro de la pestaña **Imágenes** del vehículo ← **el "editor de IA"**

- **Propósito**: subir o **generar con IA** imágenes para un vehículo y guardarlas
  como **imagen principal** (hero) o en la **galería**. Ya no es una pantalla
  separada: vive en el Espacio de trabajo del vehículo.
- **Cómo abrir**: abre un vehículo → pestaña **Espacio de trabajo** → **Imágenes**.
- **Acciones principales**:
  - **Subir imagen principal** / **Agregar a galería**: sube un archivo (se guarda
    en `media` y se registra en `vehicle-media-assets`).
  - **Crear con IA** (asistente tipo chat):
    1. Elige el **tipo/preset** o una **plantilla guardada** (`image-templates`).
    2. Opcional: **sube una referencia/plantilla** de imagen.
    3. Escribe el **prompt** y pulsa **Generar**.
    4. Revisa los **resultados** y guárdalos como **principal** o en **galería**.
    5. **Guardar como plantilla** para reutilizar preset + prompt + referencia.
  - **Imágenes del vehículo (reutilizables)**: todas las imágenes quedan en
    `vehicle-media-assets` y pueden reutilizarse como principal, galería o
    referencia en futuras generaciones.
- **Nota IA (importante)**: la generación con IA está **deshabilitada hasta que se
  configure `AI_IMAGE_API_KEY`** en el servidor. Mientras tanto, el asistente
  muestra el aviso "IA no configurada"; aun así puedes preparar el trabajo,
  adjuntar referencias, guardar plantillas y reutilizar imágenes existentes.
  Al definir la clave se habilita sin más cambios de código (solo falta conectar
  `callImageProvider` en `src/app/(payload)/api/cms/workshop/generate/route.ts`).

## 5. Constructor de portada — `/admin/builder/home`

- **Propósito**: armar la página principal del sitio con secciones visuales.
- **Cómo abrir**: menú lateral **Herramientas → Constructor de portada**.
- **Acciones principales**: agregar/ordenar/editar secciones de la biblioteca y
  guardar (publica al guardar). Vista previa en vivo del sitio.

## 6. Páginas landing — `/admin/builder/landing`

- **Propósito**: construir y editar páginas de aterrizaje por secciones.
- **Cómo abrir**: menú lateral **Herramientas → Páginas landing**.
- **Acciones principales**: crear/editar landings con la misma biblioteca de
  secciones y vista previa.

## 7. Plantilla de vehículos — `/admin/builder/vehicle-template`

- **Propósito**: definir la plantilla/estructura de la página de detalle de los
  vehículos (qué secciones se muestran y en qué orden).
- **Cómo abrir**: menú lateral **Herramientas → Plantilla de vehículos**.
- **Acciones principales**: configurar las secciones de la ficha de vehículo y
  previsualizar.

---

## Mapa: pantalla nueva → flujo anterior que reemplazará

Las pantallas nuevas conviven con las anteriores por ahora (no se eliminó nada).
A futuro, la intención es:

| Pantalla nueva                                   | Reemplazará a (flujo anterior)                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| **Taller de IA** (pestaña Imágenes del vehículo) | Pantalla independiente `/admin/workshop` (eliminada) y la lista cruda `workshop-jobs`      |
| **Inventario (gestión)** (`/admin/inventory`)    | Lista por defecto de la colección `vehicles` para tareas de inventario                     |
| **Espacio de trabajo del vehículo** (pestaña)    | Formulario por defecto de edición de `vehicles` para la operación diaria                   |
| **Constructor de portada / Landing / Plantilla** | Edición manual de los globals/relaciones de secciones (`/admin/globals/site-config`, etc.) |

Componentes anteriores que **se mantienen** (no quitar todavía):
el formulario por defecto de vehículos, la lista por defecto de colecciones y la
edición directa de globals. Sirven de respaldo mientras se validan las pantallas
nuevas.

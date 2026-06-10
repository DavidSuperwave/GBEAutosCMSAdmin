/**
 * Adds links to the custom Phase 5 admin screens into the Payload nav sidebar
 * (registered via admin.components.afterNavLinks).
 */
export default function AdminBuilderNavLinks() {
  return (
    <div className="admin-builder-nav">
      <span className="admin-builder-nav__label">Herramientas</span>
      <a href="/admin/inventory">Inventario</a>
      <a href="/admin/media-workspace">Media Workspace</a>
      <a href="/admin/builder/home">Constructor de portada</a>
      <a href="/admin/builder/landing">Páginas landing</a>
      <a href="/admin/builder/vehicle-template">Plantilla de vehículos</a>
    </div>
  )
}

// Ids sembrados por backend-emd/prisma/seed.ts (STATUS_SEEDS, con id
// explícito). El id 2 ("en pruebas") fue RETIRADO del flujo: sus pedidos se
// migraron a "en proceso" (ver la migración
// 20260906140000_remove_en_pruebas_status) y el id no se reutiliza.
export const statusMap: { [key: number]: string } = {
  1: "pendiente",
  3: "en proceso",
  4: "terminado",
  5: "entregado",
};

// Estados que ya no existen pero que pueden seguir apareciendo en textos
// históricos (historial de pedidos viejo, notificaciones ya emitidas). Se
// mantienen sólo para que esos registros sigan renderizándose legibles.
export const retiredStatusMap: { [key: number]: string } = {
  2: "en pruebas",
};

/** Nombre legible de un estado, incluidos los retirados del flujo. */
export const statusLabel = (
  statusId: number | null | undefined,
  fallback = "desconocido",
): string => {
  if (statusId == null) return fallback;
  return statusMap[statusId] ?? retiredStatusMap[statusId] ?? fallback;
};

// Sólo estados vigentes: los retirados no se ofrecen en selectores/filtros.
export const statusOptions = Object.entries(statusMap).map(([id, name]) => ({
  value: Number(id),
  label: name,
}));

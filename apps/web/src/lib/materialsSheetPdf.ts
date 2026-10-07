import { formatDate } from "@/lib/format";
import { LOCATION_LABELS } from "@/lib/suppliers";
import type { Order, OrderMaterialItem } from "@/types";

/**
 * Nombre del cliente para el encabezado del PDF: mismo criterio que
 * `getOrderClientName` (cliente registrado o el nombre escrito a mano).
 */
function clientName(order: Order): string {
  if (order.client) {
    return [order.client.first_name, order.client.last_name].filter(Boolean).join(" ");
  }
  return order.clientNameOverride || "Sin cliente";
}

/** Alto del logo en el encabezado, en mm; el ancho sale de su proporción. */
const LOGO_HEIGHT_MM = 12;
const LOGO_MAX_WIDTH_MM = 50;

/** Pone el logo (data URL PNG/JPEG/WebP) arriba a la derecha de una página A4. */
function embedLogo(doc: import("jspdf").jsPDF, dataUrl: string) {
  const props = doc.getImageProperties(dataUrl);
  const ratio = props.width / props.height;
  const height = Math.min(LOGO_HEIGHT_MM, LOGO_MAX_WIDTH_MM / ratio);
  const width = height * ratio;
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.addImage(dataUrl, props.fileType, pageWidth - 14 - width, 12, width, height);
}

/**
 * Genera e imprime la hoja de materiales de un pedido en un PDF, 100%
 * client-side (mismo enfoque que ya usa el export a Excel de Pedidos): los
 * datos ya están cargados en memoria, así que no hace falta ida y vuelta al
 * backend.
 *
 * `jspdf`/`jspdf-autotable` se cargan de forma dinámica (solo cuando se
 * descarga el PDF) para no meter esta librería pesada en el bundle inicial
 * de la pantalla de pedidos, que la mayoría de las visitas no usa.
 */
export async function downloadMaterialsSheetPdf(
  order: Order,
  items: OrderMaterialItem[],
  options: { branchLogoOnLight?: string | null } = {},
): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("Hoja de materiales", 14, 18);

  doc.setFontSize(10);
  doc.text(`Pedido #${order.id}`, 14, 26);
  doc.text(`Cliente: ${clientName(order)}`, 14, 32);
  doc.text(`Fecha: ${formatDate(new Date().toISOString())}`, 14, 38);
  if (order.branch?.name) doc.text(`Sucursal: ${order.branch.name}`, 14, 44);

  // Pedido de una sucursal: su logo (el de fondo claro: el papel es blanco)
  // arriba a la derecha. Sin logo cargado, queda sólo la línea "Sucursal".
  if (options.branchLogoOnLight) {
    try {
      embedLogo(doc, options.branchLogoOnLight);
    } catch {
      // Una imagen que jsPDF no pueda leer no debe impedir el PDF.
    }
  }

  autoTable(doc, {
    startY: order.branch?.name ? 50 : 44,
    head: [["Cantidad", "Descripción", "Proveedor", "Ubicación"]],
    body: items.map((item) => [
      item.material?.unit ? `${item.quantity} ${item.material.unit.name}` : String(item.quantity),
      item.description,
      item.supplier?.name ?? "—",
      item.supplier ? LOCATION_LABELS[item.supplier.location] : "—",
    ]),
    styles: { fontSize: 10 },
    headStyles: { fillColor: [51, 51, 51] },
  });

  doc.save(`hoja-materiales-pedido-${order.id}.pdf`);
}

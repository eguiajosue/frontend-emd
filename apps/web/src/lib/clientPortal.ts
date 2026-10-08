/**
 * Portal del cliente: enlace privado `/p/<token>` para que el cliente vea su
 * pedido y apruebe (o pida cambios a) su diseño. Su respuesta queda pendiente
 * hasta que Recepción la confirma. Backend: `src/client-portal`.
 */

export type PortalStageKey = "diseno" | "autorizacion" | "produccion" | "listo" | "entregado" | "cancelado";

export type ClientResponseKind = "aprobar" | "cambios";

export interface ClientDesignResponse {
  id: number;
  revisionId: number;
  kind: ClientResponseKind;
  comment: string | null;
  status: "pendiente" | "aplicada" | "descartada" | "reemplazada";
  createdAt: string;
}

/** `GET /portal/:token`. */
export interface PortalView {
  order: {
    id: number;
    description: string;
    clientName: string | null;
    deliveryDate: string | null;
    creationDate: string;
    branch: { name: string; logo: string | null } | null;
  };
  stage: { key: PortalStageKey; label: string };
  stages: { key: PortalStageKey; label: string }[];
  products: { name: string; quantity: number; sizes: unknown }[];
  design: {
    revisionId: number;
    round: number;
    sentAt: string | null;
    approved: boolean;
    awaitingResponse: boolean;
    files: { id: number; filename: string; mimeType: string }[];
  } | null;
  mockups: { id: number; garment: string }[];
  response: ClientDesignResponse | null;
}

/** `GET /orders/:id/share-link` (Recepción). */
export interface ShareState {
  link: { token: string; createdAt: string; lastViewedAt: string | null; viewCount: number } | null;
  pendingResponse: ClientDesignResponse | null;
}

/** Qué significa cada etapa, dicho al cliente. */
export const STAGE_COPY: Record<PortalStageKey, string> = {
  diseno: "Estamos preparando tu diseño.",
  autorizacion: "Tu diseño está listo: revísalo y dinos si lo aprobamos.",
  produccion: "Tu pedido se está produciendo.",
  listo: "¡Tu pedido está listo! Ya puedes pasar por él.",
  entregado: "Pedido entregado. ¡Gracias por confiar en nosotros!",
  cancelado: "Este pedido fue cancelado.",
};

/** URL pública del enlace (la que se comparte). */
export function portalUrl(token: string, origin = typeof window !== "undefined" ? window.location.origin : ""): string {
  return `${origin}/p/${token}`;
}

/** Sólo dígitos; 10 dígitos se toman como celular de México (+52). */
export function whatsappNumber(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.length === 10 ? `52${digits}` : digits;
}

/** Mensaje listo para WhatsApp con el enlace del pedido. */
export function shareMessage(orderId: number, url: string, clientName?: string | null): string {
  const hello = clientName ? `Hola ${clientName.split(" ")[0]}, ` : "Hola, ";
  return `${hello}aquí puedes ver tu pedido #${orderId} de EMD y revisar tu diseño: ${url}`;
}

export function whatsappUrl(message: string, phone?: string | null): string {
  const number = whatsappNumber(phone);
  return `https://wa.me/${number ?? ""}?text=${encodeURIComponent(message)}`;
}

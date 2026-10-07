"use client";

import { useMemo } from "react";
import { BranchLogo } from "@/components/orders/BranchLogo";
import { getAreaLabel } from "@/lib/areas";
import { barcodeBars, CHOREO_3D } from "@/lib/arrival3d";
import { formatDeliveryDate, formatTimeOfDay, type TimeFormatPreference } from "@/lib/format";
import { PRIORITY_STYLE, type ArrivalPriority } from "@/lib/packageArrivals";
import { useBranchLogos } from "@/hooks/useBranchLogos";
import { cn } from "@/lib/utils";

/** Lo que muestra el ticket de un pedido (ya cruzado con el tablero). */
export interface ResolvedArrival {
  id: string;
  orderId: number;
  clientName: string | null;
  area: string | null;
  deliveryDate: string | null;
  priority: ArrivalPriority;
  /** Cuándo llegó el aviso (la hora impresa al pie del ticket). */
  receivedAt?: number;
  /** Sucursal que levantó el pedido; null/ausente = matriz. */
  branch?: { id: number; name: string } | null;
}

const DASHES = 26;

/** Separador de rayitas: <span> con fondo (la copia a 3D sólo pinta fondos y textos). */
function Dashes({ compact }: { compact: boolean }) {
  return (
    <div className="flex justify-between py-0.5" aria-hidden>
      {Array.from({ length: compact ? 18 : DASHES }, (_, i) => (
        <span key={i} className="h-px w-1.5 bg-slate-400" />
      ))}
    </div>
  );
}

function Row({ label, value, compact }: { label: string; value: string; compact: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className={cn("shrink-0 text-slate-500", compact ? "text-[10px]" : "text-xs")}>{label}</span>
      <span className={cn("truncate text-right font-semibold", compact ? "text-xs" : "text-sm")}>{value}</span>
    </div>
  );
}

/**
 * Ticket térmico de un pedido, estilo recibo: encabezado "EMD · NUEVO
 * PEDIDO", la prioridad en tinta (roja si está vencido, violeta si volvió con
 * cambios), número, cliente, área, entrega, insignia, código de barras y hora.
 * Es el mismo DOM que se copia a la textura 3D y que vuela a la tarjeta.
 * Mayúsculas escritas a mano (no `uppercase`): la copia a canvas usa el texto tal cual.
 */
export function TicketContent({
  arrival,
  compact,
  timeFormat,
}: {
  arrival: ResolvedArrival;
  compact: boolean;
  timeFormat: TimeFormatPreference;
}) {
  const style = PRIORITY_STYLE[arrival.priority];
  const choreo = CHOREO_3D[arrival.priority];
  const bars = useMemo(() => barcodeBars(arrival.orderId, compact ? 150 : 220), [arrival.orderId, compact]);
  const at = new Date(arrival.receivedAt ?? Date.now());
  // El ticket es papel claro (aunque la tele sea oscura): el logo NEGRO de la sucursal;
  // si no tiene logo, su nombre en una fila más.
  const { getLogos } = useBranchLogos();
  const branchLogo = arrival.branch ? getLogos(arrival.branch.id)?.logoOnLight : null;
  const stamp = `${String(at.getDate()).padStart(2, "0")}/${String(at.getMonth() + 1).padStart(2, "0")}/${at.getFullYear()} ${formatTimeOfDay(at, timeFormat)}`;
  return (
    <div className={cn("bg-[#fbfaf6] font-mono text-slate-900", compact ? "px-3 py-2.5" : "px-4 py-3.5")}>
      <p className={cn("text-center tracking-[0.18em] text-slate-500", compact ? "text-[9px]" : "text-[11px]")}>
        EMD · NUEVO PEDIDO
      </p>
      <p
        className={cn("text-center font-bold tracking-[0.3em]", compact ? "text-base" : "text-2xl")}
        style={{ color: choreo.ink }}
      >
        {choreo.header}
      </p>
      {arrival.branch && branchLogo && (
        <div className="flex justify-center pt-1.5">
          {/* Eager: el ticket se copia a la textura 3D al montarse y el logo ya tiene que estar. */}
          <BranchLogo branchId={arrival.branch.id} name={arrival.branch.name} surface="light" size={compact ? "sm" : "lg"} loading="eager" />
        </div>
      )}
      <Dashes compact={compact} />
      <div className="flex items-center justify-between gap-2 py-1">
        <span className={cn("font-bold tabular-nums", compact ? "text-2xl" : "text-4xl")}>#{arrival.orderId}</span>
        <span
          className="shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
          style={{ backgroundColor: style.color }}
        >
          {/* En el ticket chico del lote, "Cambios solicitados" no entra. */}
          {compact && arrival.priority === "changes" ? "Cambios" : style.label}
        </span>
      </div>
      <div className="space-y-0.5">
        <Row label="CLIENTE" value={arrival.clientName || "Sin nombre"} compact={compact} />
        {arrival.branch && !branchLogo && <Row label="SUCURSAL" value={arrival.branch.name} compact={compact} />}
        {arrival.area && <Row label="ÁREA" value={getAreaLabel(arrival.area)} compact={compact} />}
        <Row
          label="ENTREGA"
          value={arrival.deliveryDate ? formatDeliveryDate(arrival.deliveryDate, timeFormat) : "Sin fecha"}
          compact={compact}
        />
      </div>
      <Dashes compact={compact} />
      <div className={cn("mt-1 flex justify-center", compact ? "h-5" : "h-7")} aria-hidden>
        {bars.map((w, i) => (
          <span key={i} className={i % 2 === 0 ? "h-full bg-slate-900" : "h-full"} style={{ width: w }} />
        ))}
      </div>
      <p className={cn("mt-1 text-center tracking-wider text-slate-500", compact ? "text-[9px]" : "text-[10px]")}>
        {stamp} · #{arrival.orderId}
      </p>
    </div>
  );
}

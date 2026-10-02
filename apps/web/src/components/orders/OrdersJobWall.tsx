"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrderJobCard, TONE_META } from "@/components/orders/OrderJobCard";
import { useNow } from "@/hooks/useNow";
import { AREA_OPTIONS, getAreaIcon } from "@/lib/areas";
import {
  compareByUrgency,
  getDeadlineState,
  getOrderAreas,
  type DeadlineState,
  type DeadlineTone,
} from "@/lib/orderDeadline";
import type { TimeFormatPreference } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Order } from "@/types";

const KPI_TONES: DeadlineTone[] = ["overdue", "at_risk", "on_time", "no_date", "finished"];
const LIVE_TONES: DeadlineTone[] = ["overdue", "at_risk", "on_time", "no_date"];
const TV_REFRESH_MS = 30_000;

type Entry = { order: Order; state: DeadlineState };

function useEntries(orders: Order[], now: number): Entry[] {
  return useMemo(
    () =>
      orders
        .map((order) => ({ order, state: getDeadlineState(order, now) }))
        .sort((a, b) => compareByUrgency(a.state, b.state) || a.order.id - b.order.id),
    [orders, now]
  );
}

function KpiStrip({
  entries,
  activeTone,
  onToneChange,
  large = false,
}: {
  entries: Entry[];
  activeTone: DeadlineTone | null;
  onToneChange: (tone: DeadlineTone | null) => void;
  large?: boolean;
}) {
  const counts = useMemo(() => {
    const c = Object.fromEntries(KPI_TONES.map((t) => [t, 0])) as Record<DeadlineTone, number>;
    for (const { state } of entries) if (state.tone in c) c[state.tone] += 1;
    return c;
  }, [entries]);
  const active = LIVE_TONES.reduce((sum, tone) => sum + counts[tone], 0);

  return (
    <div
      role="group"
      aria-label="Filtrar por plazo"
      className={cn(
        large
          ? "grid grid-cols-5 gap-3"
          : // En teléfono, fila con scroll horizontal: cinco tiles apilados empujaban las tarjetas fuera de vista.
            "-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0 sm:pb-0"
      )}
    >
      {KPI_TONES.map((tone) => {
        const meta = TONE_META[tone];
        const pressed = activeTone === tone;
        const share = LIVE_TONES.includes(tone) && active > 0 ? Math.round((counts[tone] / active) * 100) : null;
        return (
          <button
            key={tone}
            type="button"
            aria-pressed={pressed}
            onClick={() => onToneChange(pressed ? null : tone)}
            className={cn(
              "flex min-w-[8.5rem] shrink-0 snap-start flex-col items-start rounded-xl border bg-card px-3.5 py-2.5 sm:min-w-0 text-left shadow-soft transition-colors hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              pressed && "border-primary ring-1 ring-primary",
              counts[tone] === 0 && !pressed && "opacity-60"
            )}
          >
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span className={cn("h-2 w-2 rounded-full", meta.dot)} aria-hidden />
              {meta.label}
            </span>
            <span className={cn("font-heading font-bold tabular-nums leading-tight", large ? "text-4xl" : "text-2xl")}>
              {counts[tone]}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {share != null ? `${share}% de activos` : tone === "finished" ? "Por entregar" : " "}
            </span>
          </button>
        );
      })}
    </div>
  );
}

interface OrdersJobWallProps {
  orders: Order[];
  timeFormat: TimeFormatPreference;
  onOpenOrder: (id: number) => void;
  selectable?: boolean;
  selectedIds?: number[];
  onSelectedChange?: (id: number, checked: boolean) => void;
  /** Lo llama el modo TV cada 30s: el muro se queda colgado horas en una tele. */
  onRefresh?: () => void;
  /**
   * Filtro por plazo controlado desde fuera (la página lo sincroniza con
   * `?plazo=` para que los accesos del menú y los links compartidos caigan
   * directo en "Vencidos"). Sin esto, el muro lo maneja solo.
   */
  tone?: DeadlineTone | null;
  onToneChange?: (tone: DeadlineTone | null) => void;
  /** Modo TV controlado (deep-link `?tv=1` desde la paleta ⌘K). */
  tvOpen?: boolean;
  onTvOpenChange?: (open: boolean) => void;
}

/**
 * Vista "Lista" de Pedidos: muro de tarjetas ordenado por urgencia de
 * entrega, con una franja de conteos que además filtra por plazo. Tiene un
 * modo TV a pantalla completa pensado para la tele del taller.
 */
export function OrdersJobWall({
  orders,
  timeFormat,
  onOpenOrder,
  selectable = false,
  selectedIds = [],
  onSelectedChange,
  onRefresh,
  tone: toneProp,
  onToneChange,
  tvOpen: tvOpenProp,
  onTvOpenChange,
}: OrdersJobWallProps) {
  const now = useNow();
  const entries = useEntries(orders, now);
  const [ownTone, setOwnTone] = useState<DeadlineTone | null>(null);
  const [ownTvOpen, setOwnTvOpen] = useState(false);
  const tone = toneProp !== undefined ? toneProp : ownTone;
  const tvOpen = tvOpenProp ?? ownTvOpen;
  const setTone = (next: DeadlineTone | null) => {
    setOwnTone(next);
    onToneChange?.(next);
  };
  const setTvOpen = (open: boolean) => {
    setOwnTvOpen(open);
    onTvOpenChange?.(open);
  };

  const shown = tone ? entries.filter((e) => e.state.tone === tone) : entries;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <KpiStrip entries={entries} activeTone={tone} onToneChange={setTone} />
        </div>
        {/* Modo TV no tiene sentido en un teléfono. */}
        <Button variant="outline" className="hidden gap-2 sm:inline-flex" onClick={() => setTvOpen(true)}>
          <Maximize2 className="h-4 w-4" />
          Modo TV
        </Button>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Ningún pedido en &ldquo;{tone ? TONE_META[tone].label : ""}&rdquo;.{" "}
          <button type="button" className="font-medium text-foreground underline underline-offset-2" onClick={() => setTone(null)}>
            Ver todos
          </button>
        </p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-3">
          {shown.map(({ order, state }) => (
            <li key={order.id} className="flex min-w-0">
              <div className="flex w-full min-w-0">
                <OrderJobCard
                  order={order}
                  state={state}
                  timeFormat={timeFormat}
                  onOpen={onOpenOrder}
                  selectable={selectable}
                  selected={selectedIds.includes(order.id)}
                  onSelectedChange={onSelectedChange}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {tvOpen && (
        <OrdersTvWall
          entries={entries}
          timeFormat={timeFormat}
          now={now}
          onOpenOrder={onOpenOrder}
          onRefresh={onRefresh}
          onClose={() => setTvOpen(false)}
        />
      )}
    </div>
  );
}

function OrdersTvWall({
  entries,
  timeFormat,
  now,
  onOpenOrder,
  onRefresh,
  onClose,
}: {
  entries: Entry[];
  timeFormat: TimeFormatPreference;
  now: number;
  onOpenOrder: (id: number) => void;
  onRefresh?: () => void;
  onClose: () => void;
}) {
  const [tone, setTone] = useState<DeadlineTone | null>(null);
  const [area, setArea] = useState<string | null>(null);
  const [accent, setAccent] = useState<string | undefined>();
  const onCloseRef = useRef(onClose);
  const onRefreshRef = useRef(onRefresh);
  onCloseRef.current = onClose;
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    setAccent(document.documentElement.dataset.accent);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    const refresh = setInterval(() => onRefreshRef.current?.(), TV_REFRESH_MS);
    document.documentElement.requestFullscreen?.().catch(() => {
      // Sin permiso de pantalla completa: el overlay igual tapa toda la app.
    });
    return () => {
      window.removeEventListener("keydown", onKey);
      clearInterval(refresh);
      if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  // Pedidos entregados/cancelados no son trabajo en curso: no van a la tele.
  const live = entries.filter((e) => e.state.tone !== "delivered" && e.state.tone !== "cancelled");
  const presentAreas = AREA_OPTIONS.filter((a) => live.some((e) => getOrderAreas(e.order).includes(a.value)));
  const shown = live.filter(
    (e) => (!tone || e.state.tone === tone) && (!area || getOrderAreas(e.order).includes(area))
  );
  const clock = new Date(now);

  return createPortal(
    // Siempre oscuro: una tele en el taller se mira de lejos y con luz de
    // fábrica; el fondo claro encandila y lava los colores del semáforo.
    <div
      className="dark fixed inset-0 z-[60] overflow-y-auto bg-background text-foreground"
      data-accent={accent}
      role="dialog"
      aria-modal="true"
      aria-label="Pedidos en modo TV"
    >
      <div className="mx-auto max-w-[120rem] space-y-4 p-6">
        <div className="flex items-center gap-4">
          <h2 className="font-heading text-3xl font-bold">Pedidos en curso</h2>
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden />
            En vivo
          </span>
          <p className="ml-auto font-heading text-3xl font-bold tabular-nums">
            {clock.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Salir del modo TV (Esc)">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <KpiStrip entries={live} activeTone={tone} onToneChange={setTone} large />

        {presentAreas.length > 1 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por área">
            {[{ value: null, label: "Todas" } as const, ...presentAreas].map((option) => {
              const Icon = option.value ? getAreaIcon(option.value) : null;
              const pressed = area === option.value;
              return (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => setArea(option.value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                    pressed ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
                  )}
                >
                  {Icon && <Icon className="h-4 w-4" aria-hidden />}
                  {option.label}
                </button>
              );
            })}
          </div>
        )}

        <ul className="grid grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] gap-4">
          {shown.map(({ order, state }) => (
            <li key={order.id} className="flex min-w-0">
              <div className="flex w-full min-w-0">
                <OrderJobCard
                  order={order}
                  state={state}
                  timeFormat={timeFormat}
                  onOpen={(id) => {
                    onClose();
                    onOpenOrder(id);
                  }}
                  wall
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
/** Valor de "Todas" en el filtro de área del modo TV (Radix no admite `""`). */
const ALL_AREAS = "all";

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
    <ToggleGroup
      type="single"
      value={activeTone ?? ""}
      onValueChange={(v) => onToneChange(v ? (v as DeadlineTone) : null)}
      aria-label="Filtrar por plazo"
      className={cn(
        "justify-start",
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
          <ToggleGroupItem
            key={tone}
            value={tone}
            aria-label={`${meta.label}: ${counts[tone]}`}
            className={cn(
              "h-auto min-w-[8.5rem] shrink-0 snap-start flex-col items-start gap-0.5 rounded-xl border bg-card px-3.5 py-2.5 text-left font-normal hover:border-foreground/20 hover:bg-card sm:min-w-0",
              "data-[state=on]:border-primary data-[state=on]:bg-primary/5 data-[state=on]:ring-1 data-[state=on]:ring-primary",
              counts[tone] === 0 && !pressed && "opacity-60"
            )}
          >
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span className={cn("h-2 w-2 rounded-full", meta.dot)} aria-hidden />
              {meta.label}
            </span>
            <span className={cn("font-heading font-semibold leading-tight", large ? "text-4xl" : "text-2xl")}>
              {counts[tone]}
            </span>
            <span className="text-meta">
              {share != null ? `${share}% de activos` : tone === "finished" ? "Por entregar" : " "}
            </span>
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
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
          <Button variant="link" className="h-auto p-0 text-foreground" onClick={() => setTone(null)}>
            Ver todos
          </Button>
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
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    setAccent(document.documentElement.dataset.accent);
    const refresh = setInterval(() => onRefreshRef.current?.(), TV_REFRESH_MS);
    document.documentElement.requestFullscreen?.().catch(() => {
      // Sin permiso de pantalla completa: el overlay igual tapa toda la app.
    });
    return () => {
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

  return (
    // Siempre oscuro: una tele en el taller se mira de lejos y con luz de
    // fábrica; el fondo claro encandila y lava los colores del semáforo.
    // Dialog de shadcn a pantalla completa: trae foco atrapado y Esc.
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        fullscreen
        className="dark"
        data-accent={accent}
        aria-describedby={undefined}
        // Sin esto el foco cae en "Salir", se abre su tooltip y el primer Esc
        // sólo cierra el tooltip en vez del Modo TV.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).focus();
        }}
      >
        <div className="mx-auto max-w-[120rem] space-y-4 p-6">
          <div className="flex items-center gap-4">
            <DialogTitle className="text-3xl">Pedidos en curso</DialogTitle>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden />
              En vivo
            </span>
            <p className="ml-auto font-heading text-3xl font-bold tabular-nums">
              {clock.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <SimpleTooltip label="Salir (Esc)" side="bottom">
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Salir del modo TV (Esc)">
                <X className="h-5 w-5" />
              </Button>
            </SimpleTooltip>
          </div>

          <KpiStrip entries={live} activeTone={tone} onToneChange={setTone} large />

          {presentAreas.length > 1 && (
            <ToggleGroup
              type="single"
              variant="segmented"
              value={area ?? ALL_AREAS}
              onValueChange={(v) => v && setArea(v === ALL_AREAS ? null : v)}
              aria-label="Filtrar por área"
              className="flex-wrap justify-start gap-2"
            >
              {[{ value: ALL_AREAS, label: "Todas" }, ...presentAreas].map((option) => {
                const Icon = option.value !== ALL_AREAS ? getAreaIcon(option.value) : null;
                return (
                  <ToggleGroupItem key={option.value} value={option.value} className="gap-1.5 border bg-card">
                    {Icon && <Icon aria-hidden />}
                    {option.label}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
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
      </DialogContent>
    </Dialog>
  );
}

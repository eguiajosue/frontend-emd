"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { OrderJobCard, TONE_META } from "@/components/orders/OrderJobCard";
import { OrderJumpDialog, OrderShortcutHints, OrderShortcutsDialog } from "@/components/orders/OrderShortcuts";
import { useOrderKeyboardNav } from "@/hooks/useOrderKeyboardNav";
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
import { useAreaScoreboard } from "@/hooks/useAreaScoreboard";
import { TvScoreboard } from "@/components/tasks/tv/TvScoreboard";
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
            "-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-5 [&::-webkit-scrollbar]:hidden"
      )}
    >
      {KPI_TONES.map((tone) => {
        const meta = TONE_META[tone];
        const Icon = meta.icon;
        const pressed = activeTone === tone;
        const share = LIVE_TONES.includes(tone) && active > 0 ? Math.round((counts[tone] / active) * 100) : null;
        return (
          // Tarjeta "de carpeta": ícono en círculo, número fuerte y etiqueta
          // muted. El color del plazo vive sólo en el ícono.
          <ToggleGroupItem
            key={tone}
            value={tone}
            aria-label={`${meta.label}: ${counts[tone]}`}
            className={cn(
              "h-auto min-w-[10.5rem] shrink-0 snap-start justify-start gap-3 rounded-2xl border border-border/60 bg-card text-left font-normal shadow-soft hover:border-border hover:bg-card sm:min-w-0",
              large ? "px-5 py-4 [&_svg]:size-6" : "px-4 py-3.5 [&_svg]:size-[1.125rem]",
              "data-[state=on]:border-transparent data-[state=on]:bg-card data-[state=on]:ring-2 data-[state=on]:ring-primary",
              counts[tone] === 0 && !pressed && "opacity-60"
            )}
          >
            <span
              className={cn(
                "flex shrink-0 items-center justify-center rounded-full bg-muted",
                large ? "h-12 w-12" : "h-10 w-10",
                meta.text
              )}
              aria-hidden
            >
              <Icon />
            </span>
            <span className="min-w-0">
              <span
                className={cn(
                  "block font-heading font-semibold leading-tight tabular-nums",
                  large ? "text-4xl" : "text-xl"
                )}
              >
                {counts[tone]}
              </span>
              <span className={cn("block text-muted-foreground", large ? "text-base leading-snug" : "truncate text-[0.8125rem]")}>
                {meta.label}
                {share != null ? ` · ${share}%` : tone === "finished" ? " · por entregar" : ""}
              </span>
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
  const shownOrders = useMemo(() => shown.map((e) => e.order), [shown]);
  const listRef = useRef<HTMLUListElement>(null);
  // Teclado: sólo con el muro a la vista (la tele tiene el suyo).
  const keys = useOrderKeyboardNav({ containerRef: listRef, orders: shownOrders, enabled: !tvOpen, onOpen: onOpenOrder });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="text-section-title">Por plazo de entrega</h2>
          <span className="ml-auto" />
          <OrderShortcutHints onHelp={() => keys.setHelpOpen(true)} />
          {/* Modo TV no tiene sentido en un teléfono. */}
          <Button variant="outline" size="sm" className="hidden gap-2 sm:inline-flex" onClick={() => setTvOpen(true)}>
            <Maximize2 className="h-4 w-4" />
            Modo TV
          </Button>
        </div>
        <KpiStrip entries={entries} activeTone={tone} onToneChange={setTone} />
      </div>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center text-sm text-muted-foreground">
          Ningún pedido en &ldquo;{tone ? TONE_META[tone].label : ""}&rdquo;.{" "}
          <Button variant="link" className="h-auto p-0 text-foreground" onClick={() => setTone(null)}>
            Ver todos
          </Button>
        </p>
      ) : (
        <ul ref={listRef} className="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-4">
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
                  keyboardActive={keys.activeId === order.id}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <OrderShortcutsDialog open={keys.helpOpen} onOpenChange={keys.setHelpOpen} />
      <OrderJumpDialog open={keys.searchOpen} onOpenChange={keys.setSearchOpen} onJump={keys.jumpTo} />

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
  const { data: scoreboard } = useAreaScoreboard(area);
  const shownOrders = shown.map((e) => e.order);
  const gridRef = useRef<HTMLUListElement>(null);
  const openFromTv = (id: number) => {
    onClose();
    onOpenOrder(id);
  };
  const keys = useOrderKeyboardNav({ containerRef: gridRef, orders: shownOrders, enabled: true, onOpen: openFromTv });

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
        <div className="mx-auto max-w-[120rem] space-y-5 p-8">
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

          {scoreboard && <TvScoreboard data={scoreboard} />}
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
                  <ToggleGroupItem key={option.value} value={option.value} data-area={Icon ? option.value : undefined} className="gap-1.5 border bg-card">
                    {Icon && <Icon aria-hidden className="text-[hsl(var(--tone))]" />}
                    {option.label}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          )}

          <ul ref={gridRef} className="grid grid-cols-[repeat(auto-fill,minmax(21rem,1fr))] gap-5">
            {shown.map(({ order, state }) => (
              <li key={order.id} className="flex min-w-0">
                <div className="flex w-full min-w-0">
                  <OrderJobCard
                    order={order}
                    state={state}
                    timeFormat={timeFormat}
                    onOpen={openFromTv}
                    wall
                    keyboardActive={keys.activeId === order.id}
                  />
                </div>
              </li>
            ))}
          </ul>

          {/* La tele se usa con teclado: los atajos principales siempre a la vista. */}
          <div className="sticky bottom-0 z-20 -mx-8 border-t border-border/60 bg-background/95 px-8 py-3 backdrop-blur">
            <OrderShortcutHints large onHelp={() => keys.setHelpOpen(true)} />
          </div>
        </div>
        <OrderShortcutsDialog open={keys.helpOpen} onOpenChange={keys.setHelpOpen} />
        <OrderJumpDialog open={keys.searchOpen} onOpenChange={keys.setSearchOpen} onJump={keys.jumpTo} />
      </DialogContent>
    </Dialog>
  );
}

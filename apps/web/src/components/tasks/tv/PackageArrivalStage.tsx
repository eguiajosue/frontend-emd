"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, type Transition } from "framer-motion";
import { CalendarDays } from "lucide-react";
import { CardboardBoxBack, CardboardBoxFront } from "@/components/tasks/tv/CardboardBox";
import { getAreaIcon, getAreaLabel } from "@/lib/areas";
import { formatDeliveryDate, type TimeFormatPreference } from "@/lib/format";
import {
  arrivalTimeline,
  MAX_FAN,
  PRIORITY_STYLE,
  REDUCED_TIMELINE,
  type ArrivalPriority,
  type ArrivalStep,
} from "@/lib/packageArrivals";
import { cn } from "@/lib/utils";

/** Lo que muestra la hoja de un paquete (ya cruzado con el tablero). */
export interface ResolvedArrival {
  id: string;
  orderId: number;
  clientName: string | null;
  area: string | null;
  deliveryDate: string | null;
  priority: ArrivalPriority;
}

type Phase = "drop" | "land" | "open" | "sheet" | "fly" | "done";

interface PackageArrivalStageProps {
  step: ArrivalStep;
  resolved: ResolvedArrival[];
  priority: ArrivalPriority;
  reduced: boolean;
  timeFormat: TimeFormatPreference;
  /** Elemento destino de una hoja (su tarjeta, o la columna si aún no está). */
  findTarget: (arrival: ResolvedArrival) => HTMLElement | null;
  /** Al aterrizar: momento de la campanita. */
  onLand: () => void;
  /** Las hojas llegaron a sus tarjetas (empieza el brillo). */
  onDelivered: () => void;
  onDone: () => void;
}

/**
 * Escena de una llegada: cae la caja, aterriza (rebote/sacudida/flotación según
 * prioridad), se abren las solapas, sube la hoja con el pedido, la caja se
 * desvanece y la hoja vuela a su tarjeta. Todo con transform/opacity.
 *
 * La secuencia la marcan timers fijos (`arrivalTimeline`) en vez de encadenar
 * callbacks de animación: si una animación se corta (pestaña oculta), la
 * escena igual termina y la cola sigue.
 */
export function PackageArrivalStage({
  step,
  resolved,
  priority,
  reduced,
  timeFormat,
  findTarget,
  onLand,
  onDelivered,
  onDone,
}: PackageArrivalStageProps) {
  const batch = step.kind === "batch";
  const timeline = useMemo(
    () => (reduced ? REDUCED_TIMELINE : arrivalTimeline(priority, batch)),
    [reduced, priority, batch]
  );
  const style = PRIORITY_STYLE[priority];
  const [phase, setPhase] = useState<Phase>(reduced ? "sheet" : "drop");
  const callbacks = useRef({ onLand, onDelivered, onDone });
  callbacks.current = { onLand, onDelivered, onDone };

  useEffect(() => {
    const timers = [
      setTimeout(() => {
        if (!reduced) setPhase("land");
        callbacks.current.onLand();
      }, timeline.land),
      ...(reduced
        ? []
        : [
            setTimeout(() => setPhase("open"), timeline.open),
            setTimeout(() => setPhase("sheet"), timeline.sheet),
          ]),
      setTimeout(() => setPhase("fly"), timeline.fly),
      setTimeout(() => callbacks.current.onDelivered(), Math.max(timeline.fly, timeline.done - 250)),
      setTimeout(() => {
        setPhase("done");
        callbacks.current.onDone();
      }, timeline.done),
    ];
    return () => timers.forEach(clearTimeout);
  }, [timeline, reduced]);

  const opened = phase === "open" || phase === "sheet" || phase === "fly";
  const sheetsOut = phase === "sheet" || phase === "fly";
  const fan = resolved.slice(0, batch ? MAX_FAN : 1);
  const extra = resolved.length - fan.length;
  const title = batch ? `${resolved.length} pedidos nuevos` : `Nuevo pedido #${resolved[0]?.orderId}`;

  const dropTransition: Transition = style.float
    ? { duration: style.dropDuration, ease: [0.22, 1, 0.36, 1] }
    : { type: "spring", duration: style.dropDuration + 0.25, bounce: style.bounce };

  const boxAnimate =
    phase === "fly" || phase === "done"
      ? { y: 40, x: 0, opacity: 0, scale: 0.9, rotate: 0, transition: { duration: 0.35 } }
      : phase === "land" && style.shake
        ? { y: 0, x: [0, -16, 14, -10, 7, -3, 0], rotate: [0, -3, 3, -2, 1, 0], opacity: 1, scale: 1, transition: { duration: 0.45 } }
        : phase === "sheet" && style.float
          ? { y: [0, -10, 0], x: 0, rotate: 0, opacity: 1, scale: 1, transition: { duration: 2.2, repeat: Infinity, ease: "easeInOut" as const } }
          : { y: 0, x: 0, rotate: 0, opacity: 1, scale: 1, transition: dropTransition };

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center"
      role="status"
      aria-live="polite"
      data-arrival-mode="2d"
    >
      <span className="sr-only">{title}</span>
      {/* Velo: oscurece el tablero mientras llega y se aclara cuando la hoja vuela. */}
      <motion.div
        className="absolute inset-0 bg-black/55"
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === "fly" || phase === "done" ? 0 : 1 }}
        transition={{ duration: 0.3 }}
      />

      <div className={cn("relative", batch ? "w-[min(70vw,30rem)]" : "w-[min(60vw,24rem)]")}>
        {/* Brillo de prioridad detrás de la caja (gradiente, no filter: barato de animar). */}
        {!reduced && (
          <motion.div
            className="absolute -inset-[30%] rounded-full"
            style={{ background: `radial-gradient(closest-side, ${style.color}66, transparent)` }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={
              phase === "fly" || phase === "done"
                ? { opacity: 0, scale: 1.2 }
                : style.pulse && opened
                  ? { opacity: [0.5, 1, 0.5], scale: [0.95, 1.08, 0.95], transition: { duration: 0.8, repeat: Infinity } }
                  : { opacity: phase === "drop" ? 0 : 0.75, scale: 1 }
            }
            transition={{ duration: 0.4 }}
          />
        )}

        {reduced ? (
          <div className="relative flex min-h-[16rem] items-center justify-center">
            <Sheets
              fan={fan}
              extra={extra}
              batch={batch}
              out
              flying={phase === "fly" || phase === "done"}
              reduced
              timeFormat={timeFormat}
              findTarget={findTarget}
            />
          </div>
        ) : (
          <motion.div
            className="relative aspect-[240/210] w-full"
            initial={{ y: "-110vh", rotate: style.shake ? -10 : -4, opacity: 1 }}
            animate={boxAnimate}
          >
            {/* Sombra en el piso: crece a medida que la caja baja. */}
            <motion.div
              className="absolute inset-x-[8%] bottom-[-6%] h-[10%] rounded-[50%] bg-black/45"
              initial={{ opacity: 0, scaleX: 0.3 }}
              animate={{ opacity: phase === "drop" ? 0.15 : 0.6, scaleX: phase === "drop" ? 0.5 : 1 }}
              transition={{ duration: style.dropDuration }}
            />
            {/* Aplastón al aterrizar: lo que vende el peso de la caja. */}
            <motion.div
              className="absolute inset-0"
              style={{ originY: 1 }}
              animate={phase === "land" ? { scaleY: [1, 0.84, 1.05, 1], scaleX: [1, 1.08, 0.98, 1] } : { scaleY: 1, scaleX: 1 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            >
              <CardboardBoxBack open={opened} accent={style.color} />
              {/* La boca de la caja está entre y=60 y y=90 del viewBox (≈29–43%). */}
              <div className="absolute inset-x-0 top-[34%] flex justify-center">
                <Sheets
                  fan={fan}
                  extra={extra}
                  batch={batch}
                  out={sheetsOut}
                  flying={phase === "fly" || phase === "done"}
                  reduced={false}
                  pulse={style.pulse}
                  timeFormat={timeFormat}
                  findTarget={findTarget}
                />
              </div>
              <CardboardBoxFront
                open={opened}
                accent={style.color}
                label={batch ? `${resolved.length} pedidos` : `#${resolved[0]?.orderId ?? ""}`}
              />
            </motion.div>
          </motion.div>
        )}

        <motion.p
          className={cn(
            "absolute inset-x-0 -bottom-16 text-center font-heading text-3xl font-bold text-white drop-shadow",
            "[text-shadow:0_2px_12px_rgba(0,0,0,0.6)]"
          )}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: phase === "drop" || phase === "fly" || phase === "done" ? 0 : 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          {title}
        </motion.p>
      </div>
    </div>
  );
}

interface SheetsProps {
  fan: ResolvedArrival[];
  extra: number;
  batch: boolean;
  out: boolean;
  flying: boolean;
  reduced: boolean;
  pulse?: boolean;
  timeFormat: TimeFormatPreference;
  findTarget: (arrival: ResolvedArrival) => HTMLElement | null;
}

function Sheets({ fan, extra, batch, out, flying, reduced, pulse, timeFormat, findTarget }: SheetsProps) {
  const mid = (fan.length - 1) / 2;
  return (
    <div className="relative flex justify-center">
      {fan.map((arrival, i) => (
        <FlyingSheet
          key={arrival.id}
          arrival={arrival}
          index={i}
          offset={i - mid}
          batch={batch}
          out={out}
          flying={flying}
          reduced={reduced}
          pulse={pulse}
          timeFormat={timeFormat}
          findTarget={findTarget}
        />
      ))}
      {batch && extra > 0 && out && !flying && (
        <motion.span
          className="absolute -top-56 right-0 rounded-full bg-white px-3 py-1 text-lg font-bold text-slate-900 shadow-lg"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          +{extra} más
        </motion.span>
      )}
    </div>
  );
}

interface FlyingSheetProps {
  arrival: ResolvedArrival;
  index: number;
  offset: number;
  batch: boolean;
  out: boolean;
  flying: boolean;
  reduced: boolean;
  pulse?: boolean;
  timeFormat: TimeFormatPreference;
  findTarget: (arrival: ResolvedArrival) => HTMLElement | null;
}

/**
 * Una hoja. Dos capas: la de adentro hace el "sale de la caja" (y, escala,
 * abanico); la de afuera, el vuelo a la tarjeta. Al empezar el vuelo se mide
 * una sola vez dónde está la hoja y dónde la tarjeta (FLIP): la capa de
 * afuera escala desde la esquina de la hoja y se traslada, sin layout por
 * frame.
 */
function FlyingSheet({ arrival, index, offset, batch, out, flying, reduced, pulse, timeFormat, findTarget }: FlyingSheetProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [flight, setFlight] = useState<{ x: number; y: number; scale: number; origin: string } | null>(null);
  const style = PRIORITY_STYLE[arrival.priority];

  useLayoutEffect(() => {
    if (!flying || reduced) return;
    const outer = outerRef.current;
    const inner = innerRef.current;
    const target = findTarget(arrival);
    if (!outer || !inner || !target) return;
    target.scrollIntoView({ block: "nearest", inline: "nearest" });
    const o = outer.getBoundingClientRect();
    const v = inner.getBoundingClientRect();
    const t = target.getBoundingClientRect();
    const scale = v.width > 0 ? t.width / v.width : 1;
    setFlight({
      x: t.left - v.left,
      y: t.top - v.top,
      scale,
      origin: `${v.left - o.left}px ${v.top - o.top}px`,
    });
    // Se mide una vez al despegar; si el tablero se mueve después, la hoja
    // igual se desvanece encima de su tarjeta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flying, reduced]);

  const fanAngle = batch ? offset * 11 : 0;
  const fanX = batch ? offset * 92 : 0;
  const rise = batch ? -150 - Math.abs(offset) * -12 : -190;

  return (
    <motion.div
      ref={outerRef}
      className={cn("absolute top-0", batch ? "w-52" : "w-72")}
      style={{ transformOrigin: flight?.origin ?? "50% 50%", zIndex: 10 + index }}
      initial={false}
      animate={
        flight
          ? { x: flight.x, y: flight.y, scale: flight.scale, opacity: [1, 1, 0] }
          : flying && reduced
            ? { opacity: 0 }
            : { x: 0, y: 0, scale: 1, opacity: 1 }
      }
      transition={
        flight
          ? { duration: 0.7, ease: [0.65, 0, 0.35, 1], opacity: { duration: 0.7, times: [0, 0.8, 1] } }
          : { duration: 0.3 }
      }
    >
      <motion.div
        ref={innerRef}
        initial={reduced ? { opacity: 0, y: 12 } : { y: 40, x: 0, rotate: 0, scale: 0.55, opacity: 0 }}
        animate={
          reduced
            ? { opacity: 1, y: 0 }
            : out
              ? { y: rise, x: fanX, rotate: fanAngle, scale: batch ? 1 : 1.15, opacity: 1 }
              : { y: 40, x: 0, rotate: 0, scale: 0.55, opacity: 0 }
        }
        transition={
          reduced
            ? { duration: 0.25 }
            : { type: "spring", bounce: 0.3, duration: 0.6, delay: batch ? index * 0.08 : 0 }
        }
        className={cn(
          "rounded-2xl bg-white text-slate-900 shadow-2xl ring-4",
          style.ring,
          pulse && "ring-8"
        )}
      >
        <SheetContent arrival={arrival} compact={batch} timeFormat={timeFormat} />
      </motion.div>
    </motion.div>
  );
}

/** Contenido de la hoja de un pedido (también lo copia a 3D `PackageArrival3DStage`). */
export function SheetContent({ arrival, compact, timeFormat }: { arrival: ResolvedArrival; compact: boolean; timeFormat: TimeFormatPreference }) {
  const style = PRIORITY_STYLE[arrival.priority];
  const AreaIcon = arrival.area ? getAreaIcon(arrival.area) : null;
  return (
    <div className={cn("overflow-hidden rounded-2xl", compact ? "text-sm" : "text-base")}>
      <div className="h-2" style={{ backgroundColor: style.color }} aria-hidden />
      <div className={cn("space-y-2", compact ? "p-3" : "p-5")}>
        <div className="flex items-center justify-between gap-2">
          <span className={cn("font-heading font-bold tabular-nums", compact ? "text-2xl" : "text-4xl")}>
            #{arrival.orderId}
          </span>
          <span
            className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold text-white"
            style={{ backgroundColor: style.color }}
          >
            {/* En la hoja chica del lote, "Cambios solicitados" no entra. */}
            {compact && arrival.priority === "changes" ? "Cambios" : style.label}
          </span>
        </div>
        <p className={cn("truncate font-semibold", compact ? "text-base" : "text-xl")}>
          {arrival.clientName || "Cliente sin nombre"}
        </p>
        {arrival.area && (
          <p className="flex items-center gap-1.5 text-slate-600">
            {AreaIcon && <AreaIcon className="h-4 w-4" aria-hidden />}
            {getAreaLabel(arrival.area)}
          </p>
        )}
        <p className="flex items-center gap-1.5 text-slate-600">
          <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
          {arrival.deliveryDate ? `Entrega: ${formatDeliveryDate(arrival.deliveryDate, timeFormat)}` : "Sin fecha de entrega"}
        </p>
      </div>
    </div>
  );
}

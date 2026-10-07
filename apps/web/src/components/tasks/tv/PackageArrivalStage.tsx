"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, type Transition } from "framer-motion";
import { PrinterFlat } from "@/components/tasks/tv/PrinterFlat";
import { TicketContent, type ResolvedArrival } from "@/components/tasks/tv/TicketContent";
import { CHOREO_3D, printTimeline, steppedFeed, type TicketSlot } from "@/lib/arrival3d";
import type { TimeFormatPreference } from "@/lib/format";
import { MAX_FAN, PRIORITY_STYLE, REDUCED_TIMELINE, type ArrivalPriority, type ArrivalStep } from "@/lib/packageArrivals";
import { playCutterSnip, playPrinterFeed } from "@/lib/tvSound";
import { cn } from "@/lib/utils";

export type { ResolvedArrival } from "@/components/tasks/tv/TicketContent";

type Phase = "drop" | "land" | "sheet" | "fly" | "done";

interface PackageArrivalStageProps {
  step: ArrivalStep;
  resolved: ResolvedArrival[];
  priority: ArrivalPriority;
  reduced: boolean;
  timeFormat: TimeFormatPreference;
  /** Elemento destino de un ticket (su tarjeta, o la columna si aún no está). */
  findTarget: (arrival: ResolvedArrival) => HTMLElement | null;
  /** Al llegar la impresora: momento de la campanita. */
  onLand: () => void;
  /** Los tickets llegaron a sus tarjetas (empieza el brillo). */
  onDelivered: () => void;
  onDone: () => void;
}

/**
 * Versión plana (SVG + framer) de la llegada: la impresora entra, imprime el
 * ticket (sale de la ranura a pasos de motor), la cuchilla corta, el ticket
 * sube y vuela a su tarjeta. Usa el mismo horario que la 3D
 * (`printTimeline`), así las dos se ven y suenan igual. Todo con
 * transform/opacity/clip-path.
 *
 * La secuencia la marcan timers fijos en vez de encadenar callbacks de
 * animación: si una animación se corta (pestaña oculta), la escena igual
 * termina y la cola sigue.
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
  const fan = resolved.slice(0, batch ? MAX_FAN : 1);
  const extra = resolved.length - fan.length;
  const print = useMemo(() => printTimeline(priority, batch, fan.length), [priority, batch, fan.length]);
  const timeline = reduced ? REDUCED_TIMELINE : print;
  const style = PRIORITY_STYLE[priority];
  const choreo = CHOREO_3D[priority];
  const [phase, setPhase] = useState<Phase>(reduced ? "sheet" : "drop");
  const [cutting, setCutting] = useState(false);
  const callbacks = useRef({ onLand, onDelivered, onDone });
  callbacks.current = { onLand, onDelivered, onDone };

  useEffect(() => {
    const steps = choreo.feedSteps;
    const timers = [
      setTimeout(() => {
        if (!reduced) setPhase("land");
        callbacks.current.onLand();
      }, timeline.land),
      ...(reduced
        ? []
        : [
            setTimeout(() => setPhase("sheet"), timeline.sheet),
            ...print.tickets.flatMap((slot) => [
              setTimeout(
                () => playPrinterFeed(priority, slot.feedEnd - slot.feedStart, batch ? Math.ceil(steps / 2) : steps),
                slot.feedStart
              ),
              setTimeout(() => {
                setCutting(true);
                playCutterSnip();
              }, slot.cut - 70),
              setTimeout(() => setCutting(false), slot.cut + 120),
            ]),
          ]),
      setTimeout(() => setPhase("fly"), timeline.fly),
      setTimeout(() => callbacks.current.onDelivered(), Math.max(timeline.fly, timeline.done - 250)),
      setTimeout(() => {
        setPhase("done");
        callbacks.current.onDone();
      }, timeline.done),
    ];
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeline, reduced]);

  const flying = phase === "fly" || phase === "done";
  const title = batch ? `${resolved.length} pedidos nuevos` : `Nuevo pedido #${resolved[0]?.orderId}`;

  const entry: Transition =
    choreo.entry === "float"
      ? { duration: print.land / 1000, ease: [0.22, 1, 0.36, 1] }
      : choreo.entry === "slide"
        ? { duration: print.land / 1000, ease: [0.34, 1.4, 0.64, 1] }
        : { type: "spring", duration: print.land / 1000 + 0.25, bounce: style.bounce };
  const initial =
    choreo.entry === "slide"
      ? { x: "80vw", y: 0, rotate: 6, opacity: 1 }
      : { x: 0, y: choreo.entry === "float" ? "-40vh" : "-110vh", rotate: style.shake ? -8 : -3, opacity: 1 };
  const printerAnimate = flying
    ? { y: 50, x: 0, opacity: 0, scale: 0.92, rotate: 0, transition: { duration: 0.4 } }
    : phase === "land" && style.shake
      ? { y: 0, x: [0, -14, 12, -8, 5, -2, 0], rotate: [0, -2.5, 2.5, -1.5, 1, 0], opacity: 1, scale: 1, transition: { duration: 0.45 } }
      : { y: 0, x: 0, rotate: 0, opacity: 1, scale: 1, transition: entry };

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center"
      role="status"
      aria-live="polite"
      data-arrival-mode="2d"
    >
      <span className="sr-only">{title}</span>
      {/* Velo: oscurece el tablero mientras llega y se aclara cuando el ticket vuela. */}
      <motion.div
        className="absolute inset-0 bg-black/55"
        initial={{ opacity: 0 }}
        animate={{ opacity: flying ? 0 : 1 }}
        transition={{ duration: 0.3 }}
      />

      <div className={cn("relative", batch ? "w-[min(70vw,30rem)]" : "w-[min(60vw,24rem)]")}>
        {reduced ? (
          <div className="relative flex min-h-[16rem] items-center justify-center">
            {fan.map((arrival, i) => (
              <Ticket
                key={arrival.id}
                arrival={arrival}
                index={i}
                offset={i - (fan.length - 1) / 2}
                batch={batch}
                slot={null}
                steps={1}
                flying={flying}
                reduced
                timeFormat={timeFormat}
                findTarget={findTarget}
              />
            ))}
          </div>
        ) : (
          <motion.div className="relative mt-[22rem] w-full" initial={initial} animate={printerAnimate}>
            {/* Brillo de prioridad detrás (gradiente, no filter: barato de animar). */}
            <motion.div
              className="absolute -inset-[25%] rounded-full"
              style={{ background: `radial-gradient(closest-side, ${style.color}55, transparent)` }}
              initial={{ opacity: 0 }}
              animate={
                style.pulse && phase !== "drop"
                  ? { opacity: [0.45, 1, 0.45], transition: { duration: 0.8, repeat: Infinity } }
                  : { opacity: phase === "drop" ? 0 : 0.7 }
              }
            />
            {/* Sombra en el piso. */}
            <motion.div
              className="absolute inset-x-[6%] bottom-[-5%] h-[12%] rounded-[50%] bg-black/50"
              initial={{ opacity: 0, scaleX: 0.4 }}
              animate={{ opacity: phase === "drop" ? 0.2 : 0.65, scaleX: phase === "drop" ? 0.5 : 1 }}
              transition={{ duration: print.land / 1000 }}
            />
            {/* Tickets: el borde de abajo apoyado en la ranura (≈18 % del alto de la impresora). */}
            <div className="absolute inset-x-0 top-[18%] flex justify-center">
              {fan.map((arrival, i) => (
                <Ticket
                  key={arrival.id}
                  arrival={arrival}
                  index={i}
                  offset={i - (fan.length - 1) / 2}
                  batch={batch}
                  slot={print.tickets[i]}
                  steps={batch ? Math.ceil(choreo.feedSteps / 2) : choreo.feedSteps}
                  flying={flying}
                  reduced={false}
                  timeFormat={timeFormat}
                  findTarget={findTarget}
                />
              ))}
              {batch && extra > 0 && phase === "sheet" && (
                <motion.span
                  className="absolute -top-80 right-0 rounded-full bg-white px-3 py-1 text-lg font-bold text-slate-900 shadow-lg"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  +{extra} más
                </motion.span>
              )}
            </div>
            <PrinterFlat color={style.color} led={choreo.led} ledHz={choreo.ledHz} cutting={cutting} awake={phase !== "drop"} />
          </motion.div>
        )}

        <motion.p
          className="absolute inset-x-0 -bottom-16 text-center font-heading text-3xl font-bold text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.6)]"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: phase === "drop" || flying ? 0 : 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          {title}
        </motion.p>
      </div>
    </div>
  );
}

interface TicketProps {
  arrival: ResolvedArrival;
  index: number;
  offset: number;
  batch: boolean;
  /** Horario de impresión de este ticket (null = sin impresora: movimiento reducido). */
  slot: TicketSlot | null;
  steps: number;
  flying: boolean;
  reduced: boolean;
  timeFormat: TimeFormatPreference;
  findTarget: (arrival: ResolvedArrival) => HTMLElement | null;
}

/**
 * Un ticket. Tres capas: la de adentro sale de la ranura (traslación + recorte
 * con `clip-path`, a pasos de motor); la del medio, después del corte, sube
 * a su lugar del abanico; la de afuera hace el vuelo a la tarjeta (FLIP: se
 * mide una sola vez al despegar).
 */
function Ticket({ arrival, index, offset, batch, slot, steps, flying, reduced, timeFormat, findTarget }: TicketProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [flight, setFlight] = useState<{ x: number; y: number; scale: number; origin: string } | null>(null);

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
    setFlight({ x: t.left - v.left, y: t.top - v.top, scale, origin: `${v.left - o.left}px ${v.top - o.top}px` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flying, reduced]);

  // Salida de la ranura: keyframes del avance a pasos (mismo `steppedFeed` que la 3D).
  const feed = useMemo(() => {
    if (!slot) return null;
    const total = slot.feedEnd;
    const samples = Math.max(8, steps * 4);
    const times: number[] = [0];
    const hidden: number[] = [100];
    for (let k = 0; k <= samples; k++) {
      const u = k / samples;
      times.push((slot.feedStart + u * (slot.feedEnd - slot.feedStart)) / total);
      hidden.push(100 * (1 - steppedFeed(u, steps)));
    }
    return {
      duration: total / 1000,
      times,
      y: hidden.map((h) => `${h}%`),
      clipPath: hidden.map((h) => `inset(0% 0% ${h}% 0%)`),
    };
  }, [slot, steps]);

  const fanAngle = batch ? offset * 7 : 0;
  const fanX = batch ? offset * 120 : 0;
  const rise = batch ? -40 - Math.abs(offset) * -10 : -30;

  return (
    <motion.div
      ref={outerRef}
      className={cn("absolute bottom-0", batch ? "w-52" : "w-72")}
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
        initial={reduced ? { opacity: 0, y: 12 } : { x: 0, y: 0, rotate: 0, scale: 1 }}
        animate={reduced ? { opacity: 1, y: 0 } : { x: fanX, y: rise, rotate: fanAngle, scale: batch ? 1 : 1.08 }}
        transition={
          reduced || !slot
            ? { duration: 0.25 }
            : { type: "spring", bounce: 0.3, duration: (slot.riseEnd - slot.riseStart) / 1000, delay: slot.riseStart / 1000 }
        }
      >
        <motion.div
          ref={innerRef}
          className="shadow-2xl"
          initial={feed ? { y: "100%", clipPath: "inset(0% 0% 100% 0%)" } : false}
          animate={feed ? { y: feed.y, clipPath: feed.clipPath } : undefined}
          transition={feed ? { duration: feed.duration, times: feed.times, ease: "linear" } : undefined}
        >
          <TicketContent arrival={arrival} compact={batch} timeFormat={timeFormat} />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

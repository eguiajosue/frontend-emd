"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { TicketContent, type ResolvedArrival } from "@/components/tasks/tv/TicketContent";
import type { ArrivalPlayer } from "@/components/tasks/tv/arrival3d/ArrivalScene";
import { loadArrivalScene } from "@/components/tasks/tv/arrival3d/runtime";
import { CHOREO_3D, printTimeline, sheetFlight, type ScreenSheet } from "@/lib/arrival3d";
import type { TimeFormatPreference } from "@/lib/format";
import { MAX_FAN, type ArrivalPriority, type ArrivalStep } from "@/lib/packageArrivals";
import { playCutterSnip, playPrinterFeed } from "@/lib/tvSound";
import { cn } from "@/lib/utils";

/** Si la escena 3D no arranca en este tiempo, se usa la animación SVG. */
const START_TIMEOUT_MS = 2500;
/** Lo que espera a las fuentes de la app antes de copiar el ticket a 3D. */
const FONTS_WAIT_MS = 600;

interface PackageArrival3DStageProps {
  step: ArrivalStep;
  resolved: ResolvedArrival[];
  priority: ArrivalPriority;
  timeFormat: TimeFormatPreference;
  findTarget: (arrival: ResolvedArrival) => HTMLElement | null;
  onLand: () => void;
  onDelivered: () => void;
  onDone: () => void;
  /**
   * La escena 3D no arrancó: `"timeout"` (tardó demasiado: esta llegada va
   * en 2D, la próxima vuelve a probar) o `"error"` (no hay caso: 2D siempre).
   */
  onFallback: (reason: "timeout" | "error") => void;
}

interface Flight {
  arrival: ResolvedArrival;
  from: ScreenSheet;
  natural: { width: number; height: number };
  startScale: number;
  endScale: number;
  dx: number;
  dy: number;
  startAngle: number;
}

/**
 * Llegada de un pedido en 3D real (three.js): una impresora térmica entra
 * según la prioridad, imprime el ticket línea por línea, la guillotina lo
 * corta y el ticket sube hasta mirar a la cámara. En ese momento pasa al DOM
 * exactamente donde quedó en pantalla y vuela a su tarjeta (el mismo FLIP de
 * la versión 2D) mientras la impresora se hunde y el lienzo se apaga.
 *
 * Los tickets DOM se renderizan desde el principio fuera de pantalla: se
 * copian a la textura 3D (misma fuente, mismos colores) y son los que
 * después vuelan, así el pase no se nota.
 */
export function PackageArrival3DStage({
  step,
  resolved,
  priority,
  timeFormat,
  findTarget,
  onLand,
  onDelivered,
  onDone,
  onFallback,
}: PackageArrival3DStageProps) {
  const batch = step.kind === "batch";
  const fan = resolved.slice(0, batch ? MAX_FAN : 1);
  const timeline = useMemo(() => printTimeline(priority, batch, fan.length), [priority, batch, fan.length]);
  const extra = resolved.length - fan.length;
  const title = batch ? `${resolved.length} pedidos nuevos` : `Nuevo pedido #${resolved[0]?.orderId}`;

  const hostRef = useRef<HTMLDivElement>(null);
  const sheetRefs = useRef<(HTMLDivElement | null)[]>([]);
  const playerRef = useRef<ArrivalPlayer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [phase, setPhase] = useState<"wait" | "land" | "sheet" | "fly">("wait");
  const [flights, setFlights] = useState<Flight[] | null>(null);
  const callbacks = useRef({ onLand, onDelivered, onDone, onFallback, findTarget });
  callbacks.current = { onLand, onDelivered, onDone, onFallback, findTarget };

  // --- Arranque: carga diferida de three, copia de los tickets y t = 0.
  useEffect(() => {
    let cancelled = false;
    let started = false;
    let player: ArrivalPlayer | null = null;
    const giveUp = setTimeout(() => {
      if (started) return;
      cancelled = true;
      callbacks.current.onFallback("timeout");
    }, START_TIMEOUT_MS);

    void (async () => {
      try {
        const mod = await loadArrivalScene();
        await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, FONTS_WAIT_MS))]);
        const host = hostRef.current;
        if (cancelled || !host) return;
        const sheets = fan
          .map((_, i) => ({ root: sheetRefs.current[i] }))
          .filter((s): s is { root: HTMLDivElement } => Boolean(s.root));
        const created = await mod.createArrivalPlayer(host, { priority, batch, sheets });
        if (cancelled) {
          created.stop();
          return;
        }
        player = created;
        playerRef.current = created;
        started = true;
        clearTimeout(giveUp);
        created.start();
        setPlaying(true);
      } catch (err) {
        console.error("[modo TV] la llegada 3D no pudo arrancar; se usa la 2D", err);
        if (!cancelled) {
          cancelled = true;
          clearTimeout(giveUp);
          callbacks.current.onFallback("error");
        }
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(giveUp);
      player?.stop();
      playerRef.current = null;
    };
    // Una escena por llegada (el padre cambia la `key` con cada paso).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Secuencia (los mismos tiempos que la versión 2D).
  useEffect(() => {
    if (!playing) return;
    const steps = CHOREO_3D[priority].feedSteps;
    const timers = [
      // Motor y guillotina, en sincronía con cada ticket.
      ...timeline.tickets.flatMap((slot) => [
        setTimeout(() => playPrinterFeed(priority, slot.feedEnd - slot.feedStart, batch ? Math.ceil(steps / 2) : steps), slot.feedStart),
        setTimeout(() => playCutterSnip(), slot.cut),
      ]),
      setTimeout(() => {
        setPhase("land");
        callbacks.current.onLand();
      }, timeline.land),
      setTimeout(() => setPhase("sheet"), timeline.sheet),
      setTimeout(() => {
        const player = playerRef.current;
        const from = player?.handoff() ?? [];
        const out: Flight[] = [];
        fan.forEach((arrival, i) => {
          const el = sheetRefs.current[i];
          const rect = from[i];
          if (!el || !rect) return;
          const natural = { width: el.offsetWidth, height: el.offsetHeight };
          const target = callbacks.current.findTarget(arrival);
          target?.scrollIntoView({ block: "nearest", inline: "nearest" });
          const t = target?.getBoundingClientRect() ?? {
            left: rect.cx - natural.width / 2,
            top: rect.cy - natural.height / 2,
            width: natural.width,
            height: natural.height,
          };
          out.push({ arrival, from: rect, natural, ...sheetFlight(rect, t, natural) });
        });
        setFlights(out);
        setPhase("fly");
      }, timeline.fly),
      setTimeout(() => callbacks.current.onDelivered(), Math.max(timeline.fly, timeline.done - 250)),
      setTimeout(() => callbacks.current.onDone(), timeline.done),
    ];
    return () => timers.forEach(clearTimeout);
    // `fan` sale de props que no cambian durante la llegada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, timeline]);

  const flying = phase === "fly";

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[70]"
      role="status"
      aria-live="polite"
      data-arrival-mode="3d"
    >
      <span className="sr-only">{title}</span>
      {/* Velo: oscurece el tablero mientras llega; se aclara cuando el ticket vuela. */}
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(15,23,42,0.55),rgba(2,6,23,0.82))]"
        initial={{ opacity: 0 }}
        animate={{ opacity: flying ? 0 : 1 }}
        transition={{ duration: flying ? 0.45 : 0.3 }}
      />
      {/* Host exclusivo del <canvas> de three (React no pone otros hijos aquí). */}
      <div ref={hostRef} className="absolute inset-0" data-arrival-canvas />

      <motion.p
        className="absolute inset-x-0 bottom-[4%] text-center font-heading text-4xl font-bold text-white [text-shadow:0_2px_16px_rgba(0,0,0,0.7)]"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: phase === "land" || phase === "sheet" ? 1 : 0, y: phase === "wait" ? 12 : 0 }}
        transition={{ duration: 0.3 }}
      >
        {title}
      </motion.p>
      {batch && extra > 0 && phase === "sheet" && (
        <motion.span
          className="absolute right-[12%] top-[14%] rounded-full bg-white px-4 py-1.5 text-xl font-bold text-slate-900 shadow-lg"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          +{extra} más
        </motion.span>
      )}

      {/* Tickets DOM: fuera de pantalla hasta el pase; después vuelan a su tarjeta. */}
      {fan.map((arrival, i) => {
        const flight = flights?.find((f) => f.arrival.id === arrival.id);
        return (
          <motion.div
            key={arrival.id}
            className={cn("fixed left-0 top-0", batch ? "w-52" : "w-72")}
            style={
              flight
                ? {
                    left: flight.from.cx - flight.natural.width / 2,
                    top: flight.from.cy - flight.natural.height / 2,
                    zIndex: 10 + i,
                  }
                : { left: -10_000, top: 0 }
            }
            aria-hidden
            initial={false}
            animate={
              flight
                ? {
                    x: [0, flight.dx],
                    y: [0, flight.dy],
                    scale: [flight.startScale, flight.endScale],
                    rotate: [flight.startAngle, 0],
                    opacity: [1, 1, 0],
                  }
                : { opacity: 1 }
            }
            transition={
              flight
                ? { duration: 0.7, ease: [0.65, 0, 0.35, 1], opacity: { duration: 0.7, times: [0, 0.8, 1] } }
                : { duration: 0 }
            }
          >
            <div
              ref={(el) => {
                sheetRefs.current[i] = el;
              }}
              className="shadow-2xl"
            >
              <TicketContent arrival={arrival} compact={batch} timeFormat={timeFormat} />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

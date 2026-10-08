"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, CloudOff, RefreshCw } from "lucide-react";
import { listPendingMutations } from "@/lib/offlineQueue";
import { cn } from "@/lib/utils";

/**
 * Píldora discreta con el estado de la conexión: sin red, cuántos cambios
 * quedaron guardados en el teléfono para enviarse, y un "Todo enviado" breve
 * al terminar. Sin red ni pendientes no muestra nada.
 */
export type ConnectionState = { online: boolean; pending: number; justSynced: boolean; stuck?: boolean };

/** Con red, lo que siga en la cola después de esto ya no se está enviando. */
const SENDING_WINDOW_MS = 15_000;

export function connectionLabel({ online, pending, justSynced, stuck }: ConnectionState): string | null {
  const cambios = `${pending} cambio${pending === 1 ? "" : "s"}`;
  if (!online) return pending > 0 ? `Sin conexión · ${cambios} por enviar` : "Sin conexión";
  if (pending > 0) return stuck ? `${cambios} sin enviar` : `Enviando ${cambios}…`;
  return justSynced ? "Todo enviado" : null;
}

export function ConnectionStatus() {
  const reduced = useReducedMotion();
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [justSynced, setJustSynced] = useState(false);
  const prevPending = useRef(0);
  const onlineSince = useRef(Date.now());
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      setOnline(navigator.onLine);
      setNow(Date.now());
      try {
        const list = await listPendingMutations();
        if (!cancelled) setPending(list.length);
      } catch {
        /* sin IndexedDB: no hay cola que mostrar */
      }
    };
    const goOnline = () => {
      setOnline(true);
      onlineSince.current = Date.now();
      // El drenaje lo hace `registerOnlineDrainFallback` (providers); aquí sólo se mira.
      setTimeout(check, 1500);
    };
    const goOffline = () => setOnline(false);
    void check();
    const interval = setInterval(check, 4000);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    if (prevPending.current > 0 && pending === 0 && online) {
      setJustSynced(true);
      const t = setTimeout(() => setJustSynced(false), 2500);
      prevPending.current = pending;
      return () => clearTimeout(t);
    }
    prevPending.current = pending;
  }, [pending, online]);

  const stuck = now - onlineSince.current > SENDING_WINDOW_MS;
  const label = connectionLabel({ online, pending, justSynced, stuck });
  const Icon = !online || (pending > 0 && stuck) ? CloudOff : pending > 0 ? RefreshCw : CheckCircle2;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[calc(0.75rem+env(safe-area-inset-top))] z-50 flex justify-center px-4"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence>
        {label && (
          <motion.div
            key={label.startsWith("Sin") ? "off" : label}
            initial={reduced ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium shadow-soft-md",
              !online ? "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100" : "bg-card text-foreground ring-1 ring-border/60"
            )}
          >
            <Icon className={cn("h-4 w-4", online && pending > 0 && !stuck && !reduced && "animate-spin")} aria-hidden />
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

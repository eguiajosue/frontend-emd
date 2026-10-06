"use client";

import { useEffect, useState } from "react";
import { listPendingMutations } from "@/lib/offlineQueue";

/**
 * `true` mientras el pedido tiene una mutación de cambio de estado esperando
 * en la cola offline (`offlineQueue.ts`) — se encoló porque no había red al
 * hacer el cambio. Filtra por URL: todas las mutaciones que encolamos son
 * `PATCH /orders/:id` o `PATCH /orders/:id/area-tasks/:taskId/status`, ambas
 * con el id del pedido en la ruta.
 *
 * Se refresca solo:
 *  - al montar,
 *  - cuando vuelve la red (`online`, mismo momento en que se dispara el drenaje),
 *  - cada pocos segundos mientras hay algo pendiente, para reflejar el drenaje
 *    en cuanto termina, sin necesitar un event bus para la cola.
 */
export function usePendingSync(orderId: number | null | undefined): boolean {
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (orderId === null || orderId === undefined) {
      setPending(false);
      return;
    }

    let cancelled = false;
    const needle = `/orders/${orderId}`;

    const check = async () => {
      try {
        const mutations = await listPendingMutations();
        if (cancelled) return;
        setPending(mutations.some((m) => m.url.includes(needle)));
      } catch {
        // Sin IndexedDB disponible: no hay forma de saber si hay pendientes,
        // se asume que no (falla en silencio, no es información crítica).
      }
    };

    void check();
    const interval = setInterval(check, 4000);
    window.addEventListener("online", check);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("online", check);
    };
  }, [orderId]);

  return pending;
}

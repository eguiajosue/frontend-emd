"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useOrderStep } from "@/hooks/useOrderStep";
import type { Order } from "@/types";

/**
 * Atajos de teclado del muro de pedidos (vista Lista y Modo TV):
 *
 * - ←/→ o J/K: pedido anterior / siguiente · ↑/↓: el de arriba / abajo
 * - Enter: siguiente paso del pedido elegido (o abrir lo que toque)
 * - O: abrir el detalle · Z: deshacer el último cambio
 * - /: ir a un pedido por número · ?: ayuda
 *
 * No hace nada mientras se escribe en un campo, con Ctrl/⌘/Alt, ni si hay un
 * diálogo abierto encima del muro (el detalle del pedido, la ayuda…).
 */

const TYPING = "input, textarea, select, [contenteditable=''], [contenteditable='true']";

interface Options {
  containerRef: RefObject<HTMLElement | null>;
  /** Pedidos en el orden en que se ven. */
  orders: Order[];
  enabled: boolean;
  onOpen: (orderId: number) => void;
}

export function useOrderKeyboardNav({ containerRef, orders, enabled, onOpen }: Options) {
  const step = useOrderStep();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const stateRef = useRef({ orders, activeId, step, onOpen });
  stateRef.current = { orders, activeId, step, onOpen };

  // Si el pedido elegido sale de la vista (filtro, entregado…), se suelta.
  useEffect(() => {
    if (activeId != null && !orders.some((o) => o.id === activeId)) setActiveId(null);
  }, [orders, activeId]);

  const select = useCallback(
    (id: number | null) => {
      setActiveId(id);
      if (id == null) return;
      requestAnimationFrame(() => {
        const el = containerRef.current?.querySelector<HTMLElement>(`[data-order-card="${id}"]`);
        // El foco va a la tarjeta: Enter le llega a ella (y no al último botón tocado).
        el?.focus({ preventScroll: true });
        el?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
      });
    },
    [containerRef]
  );

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.(TYPING)) return;
      const container = containerRef.current;
      if (!container) return;
      // Un diálogo encima del muro (el muro de la tele también es un diálogo: ése sí vale).
      const dialogs = Array.from(document.querySelectorAll<HTMLElement>("[role='dialog'], [role='alertdialog']"));
      // Los que se están cerrando (animación de salida) ya no cuentan.
      if (dialogs.some((d) => d.dataset.state !== "closed" && !d.contains(container))) return;

      const { orders: list, activeId: current, step: ctx, onOpen: open } = stateRef.current;
      const index = current == null ? -1 : list.findIndex((o) => o.id === current);
      const order = index >= 0 ? list[index] : null;
      const key = e.key;

      const moveBy = (delta: number) => {
        if (list.length === 0) return;
        const next = index < 0 ? 0 : Math.min(list.length - 1, Math.max(0, index + delta));
        select(list[next].id);
      };
      const moveVertical = (dir: 1 | -1) => {
        if (list.length === 0) return;
        if (index < 0) return select(list[0].id);
        const rectOf = (id: number) =>
          container.querySelector<HTMLElement>(`[data-order-card="${id}"]`)?.getBoundingClientRect() ?? null;
        const from = rectOf(list[index].id);
        if (!from) return moveBy(dir);
        const cx = from.left + from.width / 2;
        let best: { id: number; score: number } | null = null;
        for (const o of list) {
          const r = rectOf(o.id);
          if (!r) continue;
          const dy = (r.top - from.top) * dir;
          if (dy <= 4) continue; // tiene que estar en otra fila, en esa dirección
          const score = dy * 3 + Math.abs(r.left + r.width / 2 - cx);
          if (!best || score < best.score) best = { id: o.id, score };
        }
        if (best) select(best.id);
      };

      let handled = true;
      switch (key) {
        case "ArrowRight":
        case "j":
        case "J":
          moveBy(1);
          break;
        case "ArrowLeft":
        case "k":
        case "K":
          moveBy(-1);
          break;
        case "ArrowDown":
          moveVertical(1);
          break;
        case "ArrowUp":
          moveVertical(-1);
          break;
        case "Enter": {
          // Enter sobre un botón o un enlace hace lo suyo; sin pedido elegido, nada.
          if (!order || target?.closest?.("button, a, [role='button']")) {
            handled = false;
            break;
          }
          const action = ctx?.stepFor(order).action;
          if (action?.kind === "move") void ctx?.advance(order);
          else open(order.id);
          break;
        }
        case "o":
        case "O":
          if (order) open(order.id);
          else handled = false;
          break;
        case "z":
        case "Z":
          if (ctx?.canUndo) void ctx.undoLast();
          else handled = false;
          break;
        case "/":
          setSearchOpen(true);
          break;
        case "?":
          setHelpOpen(true);
          break;
        default:
          handled = false;
      }
      if (handled) e.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, containerRef, select]);

  /** "Ir al pedido #": si está en la vista se elige; si no, se abre su detalle. */
  const jumpTo = useCallback(
    (id: number) => {
      setSearchOpen(false);
      if (stateRef.current.orders.some((o) => o.id === id)) select(id);
      else stateRef.current.onOpen(id);
    },
    [select]
  );

  return { activeId, select, searchOpen, setSearchOpen, helpOpen, setHelpOpen, jumpTo };
}

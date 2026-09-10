"use client";

/**
 * Estado efímero de "escribiendo…" por conversación: quién está escribiendo
 * AHORA en cada una. Vive en memoria (un Map compartido a nivel de módulo),
 * nunca en React Query — no es un dato que tenga sentido cachear/persistir.
 * `useSocket` (la única conexión de socket de la app) escribe acá cuando
 * llegan `chatTyping`/`chatStopTyping`; este hook sólo lee y se suscribe a
 * los cambios de UNA conversación puntual.
 */

import { useEffect, useState } from "react";

type Listener = () => void;

const typingByConversation = new Map<number, Set<number>>();
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
}

/** Llamado por useSocket al recibir `chatTyping` { conversationId, userId }. */
export function markUserTyping(conversationId: number, userId: number) {
  const set = typingByConversation.get(conversationId) ?? new Set<number>();
  set.add(userId);
  typingByConversation.set(conversationId, set);
  notify();
}

/** Llamado por useSocket al recibir `chatStopTyping` { conversationId, userId }. */
export function markUserStoppedTyping(conversationId: number, userId: number) {
  const set = typingByConversation.get(conversationId);
  if (!set) return;
  set.delete(userId);
  notify();
}

/** userIds escribiendo ahora mismo en `conversationId` (o `null`/vacío). */
export function useChatTyping(conversationId: number | null): number[] {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener = () => forceRender((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  if (conversationId == null) return [];
  return Array.from(typingByConversation.get(conversationId) ?? []);
}

# Chat: checks estilo WhatsApp + presencia + escribiendo (frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El operario ve, en el chat interno (web y móvil — es la misma UI
responsive, no dos código-bases separadas), los tres estados de sus mensajes
propios (✓ enviado, ✓✓ entregado, ✓✓ azul leído), si el otro participante está
en línea o cuándo fue su última conexión, y "escribiendo…" en tiempo real. Es
la mitad de frontend de la Fase 4 del rediseño — consume los eventos y campos
que expone el plan de backend (`chat-whatsapp-checks-presence.md`, repo
`backend-emd`): `GET /chat/conversations/:id/members` ahora devuelve
`lastReadAt`/`deliveredAt`/`isOnline`/`lastSeenAt` por miembro, y el socket
emite `chatRead`/`chatDelivered`/`presenceChanged`/`chatTyping`/`chatStopTyping`.

**Architecture:** Sin rediseño visual completo de burbujas/lista (eso es la
Fase 4 grande del spec, sección 6.3-6.5) — este plan agrega los datos de
checks/presencia/escritura a los componentes que YA EXISTEN
(`ConversationList.tsx`, `MessageThread.tsx`), sin tocar su estructura
general. El estado de "escribiendo" es efímero (no se persiste ni cachea en
React Query): vive en un `Map` en memoria dentro de `useSocket`, expuesto vía
un hook chico nuevo (`useChatTyping`).

**Tech Stack:** Next.js 15, React 18, TypeScript, socket.io-client, TanStack
Query, Vitest + Testing Library.

**Spec:** sección 6 completa de
`docs/superpowers/specs/2026-09-10-frontend-ios-responsive-design.md`
(diseño general del chat estilo WhatsApp — este plan implementa la parte de
checks/presencia/escritura, no el rediseño visual completo de burbujas/cola/
separadores que describe esa sección).

## Global Constraints

- Backend: consume la interfaz del plan `chat-whatsapp-checks-presence.md`
  (repo `backend-emd`) tal cual está definida ahí — no inventar campos ni
  eventos nuevos sin que ese plan los tenga primero.
- Sin dependencias nuevas.
- Web y móvil comparten el mismo código responsive (`apps/web`) — no hay un
  segundo proyecto "mobile" para esto; no crear rutas ni componentes
  duplicados por plataforma.
- Tests con Vitest + Testing Library, `describe`/`it` en español, siguiendo
  el patrón de `apps/web/src/components/orders/OrderStatusButtons.test.tsx`.
- No modificar la estructura general de `ConversationList.tsx`/
  `MessageThread.tsx` (agrupación por canales/DMs, virtualización, adjuntos,
  referencias a pedido) — sólo agregar lo que este plan pide.

---

### Task 1: Tipos + wiring de socket (checks, presencia, escribiendo)

**Files:**
- Modify: `packages/types/src/index.ts`
- Modify: `apps/web/src/hooks/useSocket.tsx`
- Create: `apps/web/src/hooks/useChatTyping.ts`
- Test: `apps/web/src/hooks/useChatTyping.test.ts`

**Interfaces:**
- Produces: `ChatMember` gana `lastReadAt: string | null`,
  `deliveredAt: string | null`, `isOnline: boolean`,
  `lastSeenAt: string | null`. `ChatUserOption` gana `isOnline: boolean`,
  `lastSeenAt: string | null`.
- Produces: `useChatTyping(conversationId: number | null): number[]` — hook
  que devuelve los `userId` que están escribiendo AHORA MISMO en esa
  conversación (Task 3 lo consume).
- Consumes: nada de otras tareas de este plan (es la base).

**Contexto para quien implemente:** `useSocket` (línea 67-200) es la ÚNICA
conexión de socket de la app, montada una vez en el layout del dashboard. No
abrir un segundo socket. El comentario del archivo (línea 45-66) ya explica
que cualquier feature nueva se engancha ahí — seguir el mismo patrón que los
listeners existentes (`socket.on(...)` al conectar, `socket.off(...)` en el
cleanup).

- [ ] **Step 1: Agregar los campos a los tipos compartidos**

En `packages/types/src/index.ts`, el tipo `ChatMember` (línea 360-363) hoy
es:

```ts
/** Participante de una conversación; `isMonitor` marca a admin/superuser. */
export interface ChatMember extends ChatUserSummary {
  isMonitor: boolean;
}
```

Cambiarlo a:

```ts
/** Participante de una conversación; `isMonitor` marca a admin/superuser. */
export interface ChatMember extends ChatUserSummary {
  isMonitor: boolean;
  /** Último mensaje leído por este miembro en esta conversación (null = nunca leyó). */
  lastReadAt: string | null;
  /** Última vez que el cliente de este miembro confirmó tener la conexión viva. */
  deliveredAt: string | null;
  isOnline: boolean;
  /** Última desconexión del último socket vivo de este usuario (null = nunca se conectó). */
  lastSeenAt: string | null;
}
```

El tipo `ChatUserOption` (línea 355-358) hoy es:

```ts
/** Usuario elegible para abrir un mensaje directo (GET /chat/users). */
export interface ChatUserOption extends ChatUserSummary {
  roles: string[];
}
```

Cambiarlo a:

```ts
/** Usuario elegible para abrir un mensaje directo (GET /chat/users). */
export interface ChatUserOption extends ChatUserSummary {
  roles: string[];
  isOnline: boolean;
  lastSeenAt: string | null;
}
```

- [ ] **Step 2: Crear `useChatTyping`**

Crear `apps/web/src/hooks/useChatTyping.ts`:

```ts
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
```

- [ ] **Step 3: Escribir el test de `useChatTyping`**

Crear `apps/web/src/hooks/useChatTyping.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useChatTyping,
  markUserTyping,
  markUserStoppedTyping,
} from "./useChatTyping";

describe("useChatTyping", () => {
  it("no devuelve nada para una conversación sin actividad", () => {
    const { result } = renderHook(() => useChatTyping(1));
    expect(result.current).toEqual([]);
  });

  it("agrega el usuario cuando llega markUserTyping y se refleja en el hook", () => {
    const { result } = renderHook(() => useChatTyping(2));
    act(() => markUserTyping(2, 42));
    expect(result.current).toContain(42);
  });

  it("lo saca cuando llega markUserStoppedTyping", () => {
    const { result } = renderHook(() => useChatTyping(3));
    act(() => markUserTyping(3, 7));
    expect(result.current).toContain(7);
    act(() => markUserStoppedTyping(3, 7));
    expect(result.current).not.toContain(7);
  });

  it("no mezcla el estado de conversaciones distintas", () => {
    const { result: r1 } = renderHook(() => useChatTyping(10));
    const { result: r2 } = renderHook(() => useChatTyping(11));
    act(() => markUserTyping(10, 1));
    expect(r1.current).toContain(1);
    expect(r2.current).not.toContain(1);
  });
});
```

- [ ] **Step 4: Correr el test**

Run: `cd apps/web && npx vitest run useChatTyping.test.ts`
Expected: PASS (4/4).

- [ ] **Step 5: Conectar los eventos nuevos en `useSocket`**

En `apps/web/src/hooks/useSocket.tsx`, agregar el import:

```ts
import { markUserTyping, markUserStoppedTyping } from "@/hooks/useChatTyping";
```

Agregar, junto a los demás handlers definidos dentro del `useEffect`
(después de `handleChatMessage`, línea 166-175):

```ts
    // El cliente confirma haber recibido un mensaje en vivo; el backend usa
    // esto para el check "entregado" (ver NotificationsGateway.handleChatDelivered).
    const ackDelivered = (message: ChatMessagePayload) => {
      if (message.senderId === userId) return; // no hace falta confirmarse a uno mismo
      socket.emit("chatDelivered", { conversationId: message.conversationId });
    };

    // chatRead/chatDelivered/presenceChanged sólo invalidan la cache del
    // chat: el dato en sí (lastReadAt/deliveredAt/isOnline/lastSeenAt) se
    // vuelve a pedir a GET /chat/conversations/:id/members, no se aplica a
    // mano acá — mantiene una sola fuente de verdad.
    const handleChatRead = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.all("chat") });
    };
    const handleChatDelivered = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.all("chat") });
    };
    const handlePresenceChanged = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.all("chat") });
    };
    const handleChatTyping = (payload: { conversationId: number; userId: number }) => {
      markUserTyping(payload.conversationId, payload.userId);
    };
    const handleChatStopTyping = (payload: { conversationId: number; userId: number }) => {
      markUserStoppedTyping(payload.conversationId, payload.userId);
    };
```

Extender `handleChatMessage` (línea 166-175) para que también dispare el ack
de entrega. Hoy es:

```ts
    const handleChatMessage = (message: ChatMessagePayload) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.all("chat") });
      // Los mensajes propios y los que ya se están viendo no interrumpen.
      if (message.senderId === userId) return;
      if (pathnameRef.current?.startsWith("/dashboard/chat")) return;
      toast(`Mensaje de ${message.senderName || message.senderUsername || "un compañero"}`, {
        description: message.body,
        icon: <MessageSquare className="h-5 w-5" />,
      });
    };
```

Cambiarlo a (una sola línea nueva, la llamada a `ackDelivered`):

```ts
    const handleChatMessage = (message: ChatMessagePayload) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.all("chat") });
      ackDelivered(message);
      // Los mensajes propios y los que ya se están viendo no interrumpen.
      if (message.senderId === userId) return;
      if (pathnameRef.current?.startsWith("/dashboard/chat")) return;
      toast(`Mensaje de ${message.senderName || message.senderUsername || "un compañero"}`, {
        description: message.body,
        icon: <MessageSquare className="h-5 w-5" />,
      });
    };
```

(`ackDelivered` está definida ANTES de `handleChatMessage` en el archivo
final — moverla si el orden de declaración de `const` lo requiere, ya que
`handleChatMessage` la referencia.)

Registrar los listeners nuevos junto a los existentes (línea 177-180):

```ts
    socket.on("newOrderNotification", handleNewOrder);
    socket.on("newAssignedOrderNotification", handleAssignedOrder);
    socket.on("orderStatusChangeNotification", handleStatusChange);
    socket.on("chatMessage", handleChatMessage);
    socket.on("chatRead", handleChatRead);
    socket.on("chatDelivered", handleChatDelivered);
    socket.on("presenceChanged", handlePresenceChanged);
    socket.on("chatTyping", handleChatTyping);
    socket.on("chatStopTyping", handleChatStopTyping);
```

Y en el cleanup (línea 189-196):

```ts
    return () => {
      socket.off("newOrderNotification", handleNewOrder);
      socket.off("newAssignedOrderNotification", handleAssignedOrder);
      socket.off("orderStatusChangeNotification", handleStatusChange);
      socket.off("chatMessage", handleChatMessage);
      socket.off("chatRead", handleChatRead);
      socket.off("chatDelivered", handleChatDelivered);
      socket.off("presenceChanged", handlePresenceChanged);
      socket.off("chatTyping", handleChatTyping);
      socket.off("chatStopTyping", handleChatStopTyping);
      socket.disconnect();
      socketRef.current = null;
    };
```

- [ ] **Step 6: Verificar tipos y build**

Run: `cd apps/web && npx tsc --noEmit`
Expected: sin errores (packages/types se resuelve vía el workspace — si hay
un paso de build previo para `@emd/types`, correrlo antes; revisar
`packages/types/package.json` si `tsc --noEmit` sobre `apps/web` no ve los
campos nuevos).

- [ ] **Step 7: Commit**

```bash
git add packages/types/src/index.ts apps/web/src/hooks/useSocket.tsx apps/web/src/hooks/useChatTyping.ts apps/web/src/hooks/useChatTyping.test.ts
git commit -m "feat(chat): wiring de checks, presencia y escribiendo en el socket"
```

---

### Task 2: Checks (✓/✓✓/✓✓ azul) en las burbujas propias

**Files:**
- Modify: `apps/web/src/app/dashboard/chat/components/MessageThread.tsx`
- Test: `apps/web/src/app/dashboard/chat/components/MessageThread.test.tsx`

**Interfaces:**
- Consumes: `ChatMember.lastReadAt`/`deliveredAt` (Task 1). `members` ya
  llega como prop a `MessageThread` (ver `MessageThreadProps`, línea 66-78) —
  no hace falta pedirlo de nuevo.
- Produces: nada que otras tareas consuman.

**Contexto para quien implemente:** la regla de negocio (ya validada en el
plan de backend) es: un mensaje propio muestra ✓✓ azul (leído) cuando TODOS
los miembros no-monitor, EXCLUYENDO al emisor, tienen
`lastReadAt >= message.createdAt`; ✓✓ gris (entregado) cuando todos esos
mismos miembros tienen `deliveredAt >= message.createdAt` pero no todos
llegan al criterio de leído; ✓ simple (enviado) en cualquier otro caso — el
mensaje ya está persistido, así que "enviado" es siempre cierto para algo que
está en `messages`. `isMonitor` filtra a los admin/superuser que sólo
observan el canal (ver comentario de la sección 6.6 del spec) — si se los
cuenta, un mensaje nunca se marcaría leído.

- [ ] **Step 1: Escribir el test que define el comportamiento**

Crear `apps/web/src/app/dashboard/chat/components/MessageThread.test.tsx`.
Primero revisar la firma completa de `MessageThreadProps` (línea 66-78) y de
`ChatMessage`/`ChatConversation` en `@/types` para armar props mínimas
válidas; usar el mismo patrón de mocks que
`apps/web/src/components/orders/OrderStatusButtons.test.tsx` (Vitest +
Testing Library, sin mockear el propio componente).

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageThread } from "./MessageThread";
import type { ChatConversation, ChatMember, ChatMessage } from "@/types";

const conversation: ChatConversation = {
  id: 1,
  type: "direct",
  area: null,
  title: "Ana Gómez",
  otherUser: { id: 20, username: "ana", firstName: "Ana", lastName: "Gómez" },
  lastMessageAt: "2026-01-01T10:00:00.000Z",
  lastMessage: null,
  unreadCount: 0,
  isMonitor: false,
};

function makeMember(overrides: Partial<ChatMember>): ChatMember {
  return {
    id: 20,
    username: "ana",
    firstName: "Ana",
    lastName: "Gómez",
    isMonitor: false,
    lastReadAt: null,
    deliveredAt: null,
    isOnline: false,
    lastSeenAt: null,
    ...overrides,
  };
}

function makeMessage(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: 1,
    conversationId: 1,
    body: "Hola",
    createdAt: "2026-01-01T10:00:00.000Z",
    senderId: 10, // el usuario actual
    ...overrides,
  } as ChatMessage;
}

describe("MessageThread - checks de mensajes propios", () => {
  it("muestra un solo check cuando nadie más recibió el mensaje todavía", () => {
    const message = makeMessage({ id: 1 });
    render(
      <MessageThread
        conversation={conversation}
        messages={[message]}
        members={[makeMember({})]}
        isLoading={false}
        isSending={false}
        currentUserId={10}
        onSend={async () => {}}
      />
    );
    expect(screen.getByTestId("check-sent-1")).toBeInTheDocument();
    expect(screen.queryByTestId("check-delivered-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("check-read-1")).not.toBeInTheDocument();
  });

  it("muestra doble check gris cuando el otro miembro lo recibió pero no lo leyó", () => {
    const message = makeMessage({ id: 2, createdAt: "2026-01-01T10:00:00.000Z" });
    render(
      <MessageThread
        conversation={conversation}
        messages={[message]}
        members={[
          makeMember({ deliveredAt: "2026-01-01T10:00:05.000Z", lastReadAt: null }),
        ]}
        isLoading={false}
        isSending={false}
        currentUserId={10}
        onSend={async () => {}}
      />
    );
    expect(screen.getByTestId("check-delivered-2")).toBeInTheDocument();
    expect(screen.queryByTestId("check-read-2")).not.toBeInTheDocument();
  });

  it("muestra doble check azul cuando el otro miembro ya lo leyó", () => {
    const message = makeMessage({ id: 3, createdAt: "2026-01-01T10:00:00.000Z" });
    render(
      <MessageThread
        conversation={conversation}
        messages={[message]}
        members={[
          makeMember({
            deliveredAt: "2026-01-01T10:00:05.000Z",
            lastReadAt: "2026-01-01T10:00:10.000Z",
          }),
        ]}
        isLoading={false}
        isSending={false}
        currentUserId={10}
        onSend={async () => {}}
      />
    );
    expect(screen.getByTestId("check-read-3")).toBeInTheDocument();
  });

  it("ignora a los miembros monitor (isMonitor) para calcular el check", () => {
    const message = makeMessage({ id: 4, createdAt: "2026-01-01T10:00:00.000Z" });
    render(
      <MessageThread
        conversation={conversation}
        messages={[message]}
        members={[
          // el único miembro real no leyó...
          makeMember({ id: 20, lastReadAt: null, deliveredAt: null }),
          // ...pero un admin monitor sí "leyó" el canal (no debe alcanzar para el check azul)
          makeMember({ id: 99, isMonitor: true, lastReadAt: "2026-01-01T10:00:10.000Z" }),
        ]}
        isLoading={false}
        isSending={false}
        currentUserId={10}
        onSend={async () => {}}
      />
    );
    expect(screen.queryByTestId("check-read-4")).not.toBeInTheDocument();
  });

  it("no muestra checks en mensajes ajenos", () => {
    const message = makeMessage({ id: 5, senderId: 20 });
    render(
      <MessageThread
        conversation={conversation}
        messages={[message]}
        members={[makeMember({})]}
        isLoading={false}
        isSending={false}
        currentUserId={10}
        onSend={async () => {}}
      />
    );
    expect(screen.queryByTestId(/check-.*-5/)).not.toBeInTheDocument();
  });
});
```

Si algún prop de `ChatConversation`/`ChatMessage` no coincide con la
definición real en `@/types` (revisar `packages/types/src/index.ts`),
ajustar el mock — mantener el resto del test igual.

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd apps/web && npx vitest run MessageThread.test.tsx`
Expected: FAIL — los `data-testid="check-*"` no existen todavía.

- [ ] **Step 3: Implementar el cálculo y el render de checks**

En `apps/web/src/app/dashboard/chat/components/MessageThread.tsx`, agregar
una función helper antes de `renderBubble` (línea 400):

```ts
type MessageCheckState = "sent" | "delivered" | "read";

/**
 * ✓ enviado / ✓✓ entregado / ✓✓ azul leído para un mensaje propio, según la
 * regla del backend: se ignoran los miembros `isMonitor` (admin/superuser
 * que sólo observan el canal) y al propio emisor.
 */
function computeCheckState(
  message: ChatMessage,
  members: ChatMember[],
  currentUserId: number | null
): MessageCheckState {
  const others = members.filter(
    (m) => m.id !== currentUserId && !m.isMonitor
  );
  if (others.length === 0) return "sent";
  const createdAt = new Date(message.createdAt).getTime();
  const allRead = others.every(
    (m) => m.lastReadAt != null && new Date(m.lastReadAt).getTime() >= createdAt
  );
  if (allRead) return "read";
  const allDelivered = others.every(
    (m) => m.deliveredAt != null && new Date(m.deliveredAt).getTime() >= createdAt
  );
  if (allDelivered) return "delivered";
  return "sent";
}

function MessageCheck({ state, messageId }: { state: MessageCheckState; messageId: number }) {
  if (state === "sent") {
    return (
      <Check
        data-testid={`check-sent-${messageId}`}
        className="h-3.5 w-3.5"
        aria-label="Enviado"
      />
    );
  }
  return (
    <CheckCheck
      data-testid={`check-${state}-${messageId}`}
      className={cn("h-3.5 w-3.5", state === "read" && "text-sky-300")}
      aria-label={state === "read" ? "Leído" : "Entregado"}
    />
  );
}
```

Agregar `Check` y `CheckCheck` al import de `lucide-react` (línea 4-13).

En `renderBubble` (línea 400-455), la firma cambia para recibir `members`
(ya está disponible como prop del componente, sólo hay que pasarla dentro de
la función — revisar si `renderBubble` es una función interna que ya cierra
sobre `members` por scope, dado que `MessageThread` la recibe como prop; si
es así, no hace falta cambiar la firma, sólo usarla directo).

Donde hoy está el bloque del timestamp (línea 444-451):

```tsx
            <p
              className={cn(
                "pt-1 text-[10px]",
                mine ? "text-primary-foreground/70" : "text-muted-foreground"
              )}
            >
              {formatTime(message.createdAt)}
            </p>
```

Cambiarlo a:

```tsx
            <p
              className={cn(
                "flex items-center justify-end gap-1 pt-1 text-[10px]",
                mine ? "text-primary-foreground/70" : "text-muted-foreground"
              )}
            >
              {formatTime(message.createdAt)}
              {mine ? (
                <MessageCheck
                  state={computeCheckState(message, members, currentUserId)}
                  messageId={message.id}
                />
              ) : null}
            </p>
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd apps/web && npx vitest run MessageThread.test.tsx`
Expected: PASS (5/5).

- [ ] **Step 5: Correr la suite completa**

Run: `cd apps/web && npx vitest run`
Expected: PASS completo, sin regresiones.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/chat/components/MessageThread.tsx apps/web/src/app/dashboard/chat/components/MessageThread.test.tsx
git commit -m "feat(chat): checks de enviado/entregado/leído estilo WhatsApp"
```

---

### Task 3: Header del hilo — presencia + "escribiendo…"

**Files:**
- Modify: `apps/web/src/app/dashboard/chat/components/MessageThread.tsx`
- Test: extender `apps/web/src/app/dashboard/chat/components/MessageThread.test.tsx`

**Interfaces:**
- Consumes: `useChatTyping` (Task 1), `ChatMember.isOnline`/`lastSeenAt`
  (Task 1).
- Produces: nada que otras tareas consuman.

**Contexto para quien implemente:** revisar primero cómo `MessageThread`
arma hoy el header del hilo (buscar dónde usa `conversation.title` / el
nombre del otro usuario — no estaba en el rango de líneas ya leído en este
plan; leer el archivo completo de esa sección antes de tocarlo). La línea de
estado bajo el nombre debe decir, en este orden de prioridad: "escribiendo…"
si `useChatTyping(conversation?.id ?? null)` incluye al `otherUser.id` (sólo
tiene sentido en conversaciones directas, `conversation.type === "direct"`);
si no, "en línea" si el miembro que no es el usuario actual tiene
`isOnline: true`; si no, "última vez <hace X>" formateado a partir de
`lastSeenAt` (usar `date-fns` si ya está en dependencias — revisar imports
existentes del proyecto para el formato relativo en español, ej.
`formatDistanceToNow` con `locale: es`); si `lastSeenAt` es `null`, no
mostrar nada.

- [ ] **Step 1: Extender el test con los tres estados del header**

Agregar a `MessageThread.test.tsx` un nuevo `describe`:

```tsx
describe("MessageThread - estado del header (presencia y escribiendo)", () => {
  it('muestra "en línea" cuando el otro miembro está online', () => {
    render(
      <MessageThread
        conversation={conversation}
        messages={[]}
        members={[makeMember({ isOnline: true })]}
        isLoading={false}
        isSending={false}
        currentUserId={10}
        onSend={async () => {}}
      />
    );
    expect(screen.getByText(/en línea/i)).toBeInTheDocument();
  });

  it("muestra la última conexión cuando está offline y tiene lastSeenAt", () => {
    render(
      <MessageThread
        conversation={conversation}
        messages={[]}
        members={[makeMember({ isOnline: false, lastSeenAt: "2026-01-01T09:00:00.000Z" })]}
        isLoading={false}
        isSending={false}
        currentUserId={10}
        onSend={async () => {}}
      />
    );
    expect(screen.getByText(/última vez/i)).toBeInTheDocument();
  });

  it("no muestra nada de presencia si nunca se conectó (lastSeenAt null)", () => {
    render(
      <MessageThread
        conversation={conversation}
        messages={[]}
        members={[makeMember({ isOnline: false, lastSeenAt: null })]}
        isLoading={false}
        isSending={false}
        currentUserId={10}
        onSend={async () => {}}
      />
    );
    expect(screen.queryByText(/en línea/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/última vez/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd apps/web && npx vitest run MessageThread.test.tsx`
Expected: FAIL — el header no muestra nada de esto todavía.

- [ ] **Step 3: Implementar**

Leer el bloque completo del header del hilo en `MessageThread.tsx` antes de
editar (buscar `conversation.title` o el nombre renderizado arriba del
área de mensajes). Agregar el import de `useChatTyping` desde
`@/hooks/useChatTyping`, y calcular:

```ts
  const otherMember = members.find((m) => m.id !== currentUserId && !m.isMonitor);
  const typingUserIds = useChatTyping(conversation?.id ?? null);
  const otherIsTyping =
    conversation?.type === "direct" &&
    otherMember != null &&
    typingUserIds.includes(otherMember.id);

  const presenceLabel = (() => {
    if (otherIsTyping) return "escribiendo…";
    if (!otherMember) return null;
    if (otherMember.isOnline) return "en línea";
    if (otherMember.lastSeenAt) {
      return `última vez ${formatDistanceToNow(new Date(otherMember.lastSeenAt), {
        addSuffix: true,
        locale: es,
      })}`;
    }
    return null;
  })();
```

(Import `formatDistanceToNow` y `es` de `date-fns`/`date-fns/locale` —
revisar primero si el proyecto ya los usa en otro lado, ej.
`apps/web/src/lib/format.ts`, para seguir la misma forma de import.)

Renderizar `presenceLabel` en el header, sólo para conversaciones `direct`
(los canales de área no tienen "un" otro usuario, no aplica presencia
1:1) — ubicarlo donde hoy esté el nombre/título del hilo, como una línea
chica debajo, sólo si `presenceLabel` no es `null`.

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd apps/web && npx vitest run MessageThread.test.tsx`
Expected: PASS (todos los tests del archivo, incluidos los de Task 2).

- [ ] **Step 5: Correr la suite completa**

Run: `cd apps/web && npx vitest run`
Expected: PASS completo.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/chat/components/MessageThread.tsx apps/web/src/app/dashboard/chat/components/MessageThread.test.tsx
git commit -m "feat(chat): header del hilo muestra en línea/última vez/escribiendo"
```

---

### Task 4: Emitir `chatTyping`/`chatStopTyping` desde el composer

**Files:**
- Modify: `apps/web/src/app/dashboard/chat/components/MessageThread.tsx`
- Test: extender `apps/web/src/app/dashboard/chat/components/MessageThread.test.tsx`

**Interfaces:**
- Consumes: `socketRef` de `useSocket` (Task 1 ya agregó los listeners de
  entrada; esta tarea agrega la emisión de salida). `useSocket` está montado
  en el layout del dashboard, NO dentro de `MessageThread` — este componente
  necesita acceso al socket ya conectado. Revisar cómo el resto de la app
  accede al socket fuera del layout (buscar usos de `useSocket` o de un
  socket compartido vía contexto); si no hay un mecanismo así todavía,
  exportar `socketRef` desde donde `useSocket()` se invoca
  (`apps/web/src/app/dashboard/layout.tsx`) vía un contexto chico
  (`ChatSocketContext`) en vez de llamar `useSocket()` de nuevo acá (evita
  abrir una segunda conexión).
- Produces: nada que otras tareas consuman.

**Contexto para quien implemente:** el textarea del composer (buscar el
`<Textarea>` del archivo, ya visto parcialmente en las tareas anteriores)
dispara `chatTyping` la PRIMERA vez que el usuario escribe algo (no en cada
tecla — sería demasiado tráfico), y `chatStopTyping` a los 3 segundos sin
tipear más, o inmediatamente al enviar el mensaje. Patrón: un `setTimeout`
que se reinicia en cada `onChange`, sin re-emitir `chatTyping` si ya se
emitió y el timeout sigue vivo.

- [ ] **Step 1: Ubicar el mecanismo de acceso al socket**

Leer `apps/web/src/app/dashboard/layout.tsx` (dónde se llama `useSocket()`)
y `apps/web/src/hooks/useSocket.tsx` completo. Si no existe ya un contexto
que exponga el socket a componentes hijos, crear uno mínimo: un
`createContext<Socket | null>(null)` en `useSocket.tsx` mismo (exportar
`ChatSocketContext` y un `ChatSocketProvider` que envuelva
`socketRef.current`), usado por `dashboard/layout.tsx` para envolver a sus
hijos. Mantener el cambio mínimo — no reestructurar `useSocket` más de lo
necesario para exponer el socket ya conectado a `MessageThread`.

- [ ] **Step 2: Escribir el test de emisión con debounce**

Agregar a `MessageThread.test.tsx`:

```tsx
import { vi } from "vitest";
import userEvent from "@testing-library/user-event";
// import del contexto/provider del socket, según cómo haya quedado el Step 1

describe("MessageThread - emite chatTyping al escribir", () => {
  it("emite chatTyping una sola vez al empezar a escribir, y chatStopTyping tras el timeout", async () => {
    vi.useFakeTimers();
    const emit = vi.fn();
    const fakeSocket = { emit } as any;

    render(
      // envolver con el provider/contexto del socket, pasando fakeSocket
      <MessageThread
        conversation={conversation}
        messages={[]}
        members={[makeMember({})]}
        isLoading={false}
        isSending={false}
        currentUserId={10}
        onSend={async () => {}}
      />
    );

    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "hola", { delay: null });

    expect(emit).toHaveBeenCalledWith("chatTyping", { conversationId: conversation.id });
    expect(emit).toHaveBeenCalledTimes(1); // no reemite en cada tecla

    vi.advanceTimersByTime(3000);
    expect(emit).toHaveBeenCalledWith("chatStopTyping", { conversationId: conversation.id });

    vi.useRealTimers();
  });
});
```

Ajustar el test al mecanismo real de acceso al socket decidido en el Step 1
(si terminó siendo un contexto, envolver el render con su provider pasando
`fakeSocket`).

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `cd apps/web && npx vitest run MessageThread.test.tsx`
Expected: FAIL — todavía no se emite nada.

- [ ] **Step 4: Implementar el debounce de escritura**

En `MessageThread.tsx`, agregar un `useRef<ReturnType<typeof setTimeout> | null>` para el timeout y un `useRef<boolean>` para saber si ya se emitió `chatTyping` sin haber emitido `chatStopTyping` todavía. En el `onChange` del textarea:

```ts
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const socket = useContext(ChatSocketContext); // según cómo haya quedado el Step 1

  const handleComposerChange = (value: string) => {
    setDraft(value); // o el setter que ya use el textarea hoy — revisar el nombre real del estado
    if (!conversation) return;
    if (!isTypingRef.current) {
      socket?.emit("chatTyping", { conversationId: conversation.id });
      isTypingRef.current = true;
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket?.emit("chatStopTyping", { conversationId: conversation.id });
      isTypingRef.current = false;
    }, 3000);
  };
```

Conectar `handleComposerChange` al `onChange` real del `<Textarea>` (revisar
el nombre exacto del handler/estado que ya existe para el texto del
composer y adaptarlo, no duplicar estado).

En el `onSend`/submit del composer, antes o después de mandar el mensaje,
limpiar el timeout y emitir `chatStopTyping` de una si `isTypingRef.current`
es `true` (el usuario ya no está "escribiendo", está "enviado").

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `cd apps/web && npx vitest run MessageThread.test.tsx`
Expected: PASS, todos los tests del archivo (Tasks 2, 3 y 4).

- [ ] **Step 6: Correr la suite completa**

Run: `cd apps/web && npx vitest run`
Expected: PASS completo.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/dashboard/chat/components/MessageThread.tsx apps/web/src/app/dashboard/chat/components/MessageThread.test.tsx apps/web/src/hooks/useSocket.tsx apps/web/src/app/dashboard/layout.tsx
git commit -m "feat(chat): emite chatTyping/chatStopTyping desde el composer"
```

---

### Task 5: Lista de conversaciones — hora, punto de presencia, "escribiendo…"

**Files:**
- Modify: `apps/web/src/app/dashboard/chat/components/ConversationList.tsx`
- Test: `apps/web/src/app/dashboard/chat/components/ConversationList.test.tsx`

**Interfaces:**
- Consumes: `useChatTyping` (Task 1). `ChatConversation.lastMessageAt` ya
  existe. Presencia por conversación: como `ConversationList` no recibe la
  lista de `members` de CADA conversación (sólo `MessageThread` la tiene,
  para la conversación abierta), el punto de presencia en la lista se limita
  a mostrar "escribiendo…" en el preview (si `useChatTyping` devuelve algún
  userId para esa conversación) — no se agrega un punto verde por fila en
  esta tarea, porque requeriría pedir `members` de TODAS las conversaciones
  visibles, que es trabajo de backend/fetch adicional fuera del alcance de
  este plan. Dejarlo anotado como fuera de alcance, no inventarlo.
- Produces: nada que otras tareas consuman.

**Contexto para quien implemente:** revisar el componente completo (ya leído
en este plan, 20-151) antes de tocar — la función `renderGroup` arma cada
fila. Se agrega, sin cambiar la estructura de agrupación por canales/DMs:
(a) la hora del último mensaje arriba a la derecha de cada fila, (b) "está
escribiendo…" reemplazando el preview del último mensaje cuando aplica.

- [ ] **Step 1: Escribir el test**

Crear `apps/web/src/app/dashboard/chat/components/ConversationList.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConversationList } from "./ConversationList";
import { markUserTyping } from "@/hooks/useChatTyping";
import type { ChatConversation } from "@/types";

function makeConversation(overrides: Partial<ChatConversation>): ChatConversation {
  return {
    id: 1,
    type: "direct",
    area: null,
    title: "Ana Gómez",
    otherUser: { id: 20, username: "ana", firstName: "Ana", lastName: "Gómez" },
    lastMessageAt: "2026-01-01T10:00:00.000Z",
    lastMessage: { id: 1, conversationId: 1, body: "Hola", createdAt: "2026-01-01T10:00:00.000Z", senderId: 20 } as any,
    unreadCount: 0,
    isMonitor: false,
    ...overrides,
  };
}

describe("ConversationList", () => {
  it("muestra la hora del último mensaje", () => {
    render(
      <ConversationList
        conversations={[makeConversation({})]}
        isLoading={false}
        selectedId={null}
        onSelect={() => {}}
        onNewDirect={() => {}}
      />
    );
    // formatTime usa toLocaleTimeString es-AR, formato HH:MM — sólo se
    // verifica que aparezca algo con el patrón de hora, no un valor exacto
    // (depende de zona horaria del entorno de test).
    expect(screen.getByText(/^\d{1,2}:\d{2}/)).toBeInTheDocument();
  });

  it('reemplaza el preview por "escribiendo…" cuando el otro está tipeando', () => {
    markUserTyping(1, 20);
    render(
      <ConversationList
        conversations={[makeConversation({ id: 1 })]}
        isLoading={false}
        selectedId={null}
        onSelect={() => {}}
        onNewDirect={() => {}}
      />
    );
    expect(screen.getByText(/escribiendo/i)).toBeInTheDocument();
    expect(screen.queryByText("Hola")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd apps/web && npx vitest run ConversationList.test.tsx`
Expected: FAIL — ni la hora ni "escribiendo…" existen todavía.

- [ ] **Step 3: Implementar**

En `ConversationList.tsx`, importar `useChatTyping` desde
`@/hooks/useChatTyping`. Dentro de `renderGroup`, para cada `conversation`
del `.map`, calcular:

```ts
const typingUserIds = useChatTyping(conversation.id);
const isTyping = typingUserIds.length > 0;
```

(Nota: `renderGroup` está definida dentro del componente pero mapea un
array — un hook no puede llamarse dentro de un `.map` de forma condicional
sin violar las reglas de hooks. Resolverlo extrayendo cada fila a un
subcomponente propio, ej. `ConversationRow`, que reciba `conversation` como
prop y ahí sí llame a `useChatTyping(conversation.id)` — un componente por
fila, no un hook dentro de un callback de array.)

Formatear la hora reusando (o replicando, si no es exportable) la misma
lógica de `formatTime` que ya existe en `MessageThread.tsx` — si conviene
extraerla a un helper compartido (`@/lib/format.ts` o similar) para no
duplicar, hacerlo; si no, una función local idéntica en este archivo es
aceptable para no acoplar ambos componentes.

Agregar la hora en la fila (hoy la fila sólo tiene título + preview +
badge, línea 91-116) — ubicarla arriba a la derecha, en la misma línea que
el título, sin romper el layout `flex` existente.

Cambiar el preview (línea 100-108):

```tsx
                    {conversation.lastMessage ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {conversation.lastMessage.body}
                      </span>
                    ) : (
                      <span className="block truncate text-xs text-muted-foreground/70">
                        {conversation.type === "area" ? "Canal de área" : "Mensaje directo"}
                      </span>
                    )}
```

a mostrar "escribiendo…" primero si `isTyping`, antes que el resto de la
lógica condicional existente (sin borrar los otros dos casos).

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd apps/web && npx vitest run ConversationList.test.tsx`
Expected: PASS (2/2).

- [ ] **Step 5: Correr la suite completa**

Run: `cd apps/web && npx vitest run`
Expected: PASS completo, sin regresiones (prestar atención a
`data-table.test.tsx`, `CreateOrderDialog.test.tsx` y el resto de tests de
Fase 0, que no deberían verse afectados por estos cambios).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/chat/components/ConversationList.tsx apps/web/src/app/dashboard/chat/components/ConversationList.test.tsx
git commit -m "feat(chat): hora del último mensaje y escribiendo en la lista"
```

## Verificación final del plan

- [ ] **Suite completa:** `cd apps/web && npx vitest run`. Expected: PASS.
- [ ] **Build:** `pnpm --filter web build` desde la raíz del repo. Expected:
  sin errores (incluye typecheck + lint vía `next build`).
- [ ] **Backend desplegado primero:** confirmar que
  `chat-whatsapp-checks-presence.md` (repo `backend-emd`) ya está mergeado y
  en producción antes de mergear este plan — si no, los campos
  `lastReadAt`/`deliveredAt`/`isOnline`/`lastSeenAt` no existen todavía en
  las respuestas reales del backend y los checks se verían siempre como
  "enviado" (no es un bug del frontend, es orden de despliegue).

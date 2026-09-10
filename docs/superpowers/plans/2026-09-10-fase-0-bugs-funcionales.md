# Fase 0 — Bugs funcionales del chat/pedidos móvil: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir los 6 bugs funcionales (B1–B6) identificados en la auditoría
del frontend, que hoy rompen el trabajo del operario en planta, sin tocar
todavía el resto del rediseño responsive/iOS.

**Architecture:** Cada bug es una corrección aislada en `apps/web`, sin
dependencias entre tareas. No se toca `backend-emd` en esta fase. Cada tarea
sigue TDD: test que reproduce el bug, verificar que falla, arreglo mínimo,
verificar que pasa.

**Tech Stack:** Next.js 15, React 18, TypeScript, Vitest + Testing Library
(jsdom para `.test.tsx`, node para `.test.ts`), Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-09-10-frontend-ios-responsive-design.md`
(secciones 3.2 y 7, Fase 0)

## Global Constraints

- No modificar `backend-emd` en este plan.
- No introducir dependencias nuevas.
- Cada tarea es independiente: no debe asumir que otra tarea de este plan ya
  se aplicó.
- Seguir el estilo del repo: comentarios sólo donde el porqué no es obvio,
  español en textos de usuario y comentarios, sin `whitespace-nowrap` nuevo.
- Todo test nuevo sigue el patrón ya usado en
  `src/components/orders/OrderStatusButtons.test.tsx`: Vitest + Testing
  Library, `describe`/`it` en español, aserciones sobre el DOM renderizado.

---

### Task 1: Bug B5 — `superuser` no ve la sección Clientes

**Files:**
- Modify: `apps/web/src/components/app-sidebar.tsx:220-224`
- Test: `apps/web/src/components/app-sidebar.test.tsx`

**Interfaces:**
- Consumes: nada de otras tareas.
- Produces: nada que otras tareas consuman.

- [ ] **Step 1: Escribir el test que reproduce el bug**

Crear `apps/web/src/components/app-sidebar.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { roles: ["superuser"] } },
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/orders",
}));

vi.mock("@/hooks/useChat", () => ({
  useChatUnreadCount: () => 0,
}));

vi.mock("@/hooks/useNotifications", () => ({
  useUnreadNotificationsCount: () => ({ count: 0 }),
}));

vi.mock("@/hooks/useInstallPrompt", () => ({
  useInstallPrompt: () => ({ canInstall: false, promptInstall: vi.fn() }),
}));

vi.mock("@/components/BugReportDialog", () => ({
  BugReportDialog: () => null,
}));

function renderSidebar() {
  return render(
    <SidebarProvider>
      <AppSidebar />
    </SidebarProvider>
  );
}

describe("AppSidebar", () => {
  it("muestra Clientes a un usuario con rol superuser", () => {
    renderSidebar();
    expect(screen.getByRole("link", { name: /Clientes/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm run test -- app-sidebar.test.tsx` (desde `apps/web`)
Expected: FAIL — no encuentra un link con nombre accesible "Clientes".

- [ ] **Step 3: Aplicar el arreglo mínimo**

En `apps/web/src/components/app-sidebar.tsx`, la sección "Clientes" (alrededor
de la línea 216-226) hoy dice:

```tsx
    {
      groupLabel: "Clientes",
      items: [
        {
          title: "Clientes",
          url: "/dashboard/clientes",
          icon: UserRound,
          roles: ["admin", "recepcion"],
        },
      ],
    },
```

Cambiar la línea `roles: ["admin", "recepcion"],` de ese bloque a:

```tsx
          roles: ["admin", "recepcion", "superuser"],
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm run test -- app-sidebar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/app-sidebar.tsx apps/web/src/components/app-sidebar.test.tsx
git commit -m "fix: superuser ve la sección Clientes en el sidebar"
```

---

### Task 2: Bug B4 — el onboarding se autocancela en móvil y quema el flag

**Files:**
- Modify: `apps/web/src/components/OnboardingTour.tsx`
- Test: `apps/web/src/components/OnboardingTour.test.tsx`

**Interfaces:**
- Consumes: `useIsMobile` de `apps/web/src/hooks/use-mobile.tsx` (ya existe,
  sin cambios).
- Produces: nada que otras tareas consuman.

- [ ] **Step 1: Escribir el test que reproduce el bug**

Crear `apps/web/src/components/OnboardingTour.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { OnboardingTour } from "./OnboardingTour";

const updatePreferences = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: "authenticated" }),
}));

vi.mock("@/lib/motion", () => ({
  useMotionPreset: () => ({ reduced: false }),
}));

vi.mock("@/hooks/useUserPreferences", () => ({
  useUserPreferences: () => ({
    preferences: { hasSeenOnboarding: false },
    updatePreferences,
  }),
}));

const useIsMobileMock = vi.fn();
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => useIsMobileMock(),
}));

describe("OnboardingTour", () => {
  it("en móvil no se activa ni marca hasSeenOnboarding", async () => {
    useIsMobileMock.mockReturnValue(true);
    render(<OnboardingTour />);
    // El tour normalmente activa a los 400ms; esperamos más que eso.
    await new Promise((r) => setTimeout(r, 500));
    expect(updatePreferences).not.toHaveBeenCalled();
  });

  it("en escritorio sí se activa", async () => {
    useIsMobileMock.mockReturnValue(false);
    const { container } = render(<OnboardingTour />);
    await waitFor(
      () => {
        expect(container.querySelector(".fixed.inset-0")).toBeTruthy();
      },
      { timeout: 1000 }
    );
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm run test -- OnboardingTour.test.tsx`
Expected: FAIL en el primer caso — hoy el tour corre igual en móvil, no
encuentra el target `[data-tour="sidebar-nav"]` (no está en el DOM de este
test), se autosalta todos los pasos y llama `finish()`, que sí invoca
`updatePreferences`.

- [ ] **Step 3: Aplicar el arreglo mínimo**

En `apps/web/src/components/OnboardingTour.tsx`, agregar el import:

```tsx
import { useIsMobile } from "@/hooks/use-mobile";
```

Dentro de `OnboardingTour()`, agregar la línea junto a los demás hooks (cerca
de `const { reduced } = useMotionPreset();`):

```tsx
  const isMobile = useIsMobile();
```

Y cambiar `shouldRun` (hoy):

```tsx
  const shouldRun =
    status === "authenticated" &&
    !!preferences &&
    preferences.hasSeenOnboarding !== true &&
    !dismissed;
```

a:

```tsx
  const shouldRun =
    status === "authenticated" &&
    !!preferences &&
    preferences.hasSeenOnboarding !== true &&
    !dismissed &&
    !isMobile;
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm run test -- OnboardingTour.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/OnboardingTour.tsx apps/web/src/components/OnboardingTour.test.tsx
git commit -m "fix: el onboarding no se autocancela ni marca el flag en móvil"
```

---

### Task 3: Bug B2 — el chat tapa su propio campo de texto con el teclado de iOS

**Files:**
- Modify: `apps/web/src/app/dashboard/chat/page.tsx:146`
- Test: `apps/web/src/app/dashboard/chat/page.test.tsx`

**Interfaces:**
- Consumes: nada de otras tareas.
- Produces: nada que otras tareas consuman.

- [ ] **Step 1: Escribir el test que reproduce el bug**

Crear `apps/web/src/app/dashboard/chat/page.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import ChatPage from "./page";

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { id: "1" } } }),
}));

vi.mock("@/hooks/useChat", () => ({
  chatDisplayName: (u: { username: string }) => u.username,
  useChatConversations: () => ({
    conversations: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useChatMessages: () => ({ messages: [], isLoading: false }),
  useChatMembers: () => ({ members: [] }),
  useChatUsers: () => ({ users: [] }),
  useChatMutations: () => ({
    sendMessage: vi.fn(),
    isSending: false,
    markAsRead: vi.fn(),
    createDirect: vi.fn(),
  }),
}));

vi.mock("./components/ConversationList", () => ({
  ConversationList: () => <div data-testid="conversation-list" />,
}));

vi.mock("./components/MessageThread", () => ({
  MessageThread: () => <div data-testid="message-thread" />,
}));

describe("ChatPage", () => {
  it("usa una altura dinámica que se achica con el teclado de iOS", () => {
    const { container } = render(<ChatPage />);
    const shell = container.querySelector('[class*="calc(100dvh"]');
    expect(shell).toBeTruthy();
  });

  it("ya no usa 100vh, que no se achica con el teclado", () => {
    const { container } = render(<ChatPage />);
    const stale = container.querySelector('[class*="calc(100vh"]');
    expect(stale).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm run test -- apps/web/src/app/dashboard/chat/page.test.tsx`
Expected: FAIL — el primer caso no encuentra ningún elemento con `100dvh` (hoy
usa `100vh`); el segundo pasaría ya (no hace falta que ambos fallen, pero al
menos el primero debe fallar).

- [ ] **Step 3: Aplicar el arreglo mínimo**

En `apps/web/src/app/dashboard/chat/page.tsx:146`, cambiar:

```tsx
      <div className="flex h-[calc(100vh-16rem)] min-h-[420px] flex-col overflow-hidden rounded-2xl border bg-card shadow-soft md:flex-row">
```

a:

```tsx
      <div className="flex h-[calc(100dvh-16rem)] min-h-[420px] flex-col overflow-hidden rounded-2xl border bg-card shadow-soft md:flex-row">
```

`100dvh` (dynamic viewport height) se achica cuando la barra de herramientas
de Safari colapsa/aparece; `100vh` en iOS resuelve siempre contra el viewport
*grande* (barra colapsada), así que hoy siempre se pasa de alto. Soportado
desde iOS Safari 15.4.

**Corrección post-revisión (no cambia el alcance de esta tarea):** el teclado
virtual de iOS Safari **no** achica `dvh` en absoluto — `dvh` sigue la barra
de herramientas del navegador, no el teclado. Este fix por sí solo, entonces,
no resuelve del todo el problema de que el teclado tape el campo de texto en
iOS Safari; sigue siendo una mejora real sobre `100vh` (que en iOS siempre se
pasa de alto contra el viewport grande), y el ajuste del piso `min-h` (ver
hallazgo de revisión de rama completa: bajarlo de `420px` a `280px`) evita que
ese piso anule el cálculo dinámico en pantallas chicas. Pero la solución
completa requiere manejar `window.visualViewport`, que queda fuera de alcance
de esta tarea acotada y se deja como trabajo de seguimiento.

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm run test -- apps/web/src/app/dashboard/chat/page.test.tsx`
Expected: PASS (ambos casos)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/chat/page.tsx apps/web/src/app/dashboard/chat/page.test.tsx
git commit -m "fix: el chat usa 100dvh para no quedar tapado por el teclado de iOS"
```

---

### Task 4: Bug B3 — el botón de crear pedido se pierde con el scroll

**Files:**
- Modify: `apps/web/src/components/orders/CreateOrderDialog.tsx:766-777`
- Test: `apps/web/src/components/orders/CreateOrderDialog.test.tsx`

**Interfaces:**
- Consumes: `DialogFooter` de `apps/web/src/components/ui/dialog.tsx` (ya
  existe, sin cambios). `DialogContent` ya separa automáticamente el hijo de
  tipo `DialogFooter` del cuerpo scrolleable — ver `dialog.tsx:73-80`.
- Produces: nada que otras tareas consuman.

**Contexto para quien implemente:** `DialogContent` (en
`apps/web/src/components/ui/dialog.tsx:67-111`) recorre sus hijos directos y
separa automáticamente el que sea de tipo `DialogHeader` y el que sea de tipo
`DialogFooter` del resto (`body`), que es lo único que queda dentro del `div`
con scroll (línea 99). Hoy el bloque de botones de `CreateOrderDialog` es un
`div` normal, así que cae dentro de `body` y scrollea con el resto del
formulario. Basta con envolverlo en `DialogFooter` para que quede anclado.

- [ ] **Step 1: Escribir el test que reproduce el bug**

`CreateOrderDialogProps` (línea 140-145 de `CreateOrderDialog.tsx`) requiere
`open: boolean` y `onClose: () => void`, con `onCreated?` opcional. El
componente usa `usePermissions()` (destructura `session`),
`useEntityList` (para `clients`, `orderProductPresets`, `users`) y
`useEntityMutations` (para `create`).

Crear `apps/web/src/components/orders/CreateOrderDialog.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CreateOrderDialog } from "./CreateOrderDialog";

vi.mock("@/hooks/useEntity", () => ({
  useEntityList: () => ({ data: [] }),
  useEntityMutations: () => ({ create: vi.fn() }),
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ session: { user: { roles: ["admin"] } } }),
}));

describe("CreateOrderDialog", () => {
  it("el botón Crear Pedido vive dentro del footer anclado del diálogo", () => {
    render(
      <CreateOrderDialog open onClose={() => {}} onCreated={() => {}} />
    );
    const button = screen.getByRole("button", { name: /Crear Pedido/i });
    // DialogFooter es el único contenedor directo que NO tiene la clase de
    // scroll `overflow-y-auto` que sí tiene el body del diálogo.
    const scrollBody = button.closest(".overflow-y-auto");
    expect(scrollBody).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm run test -- CreateOrderDialog.test.tsx`
Expected: FAIL — hoy el botón sí está dentro de `.overflow-y-auto` (el `div`
del cuerpo scrolleable de `DialogContent`).

- [ ] **Step 3: Aplicar el arreglo mínimo**

En `apps/web/src/components/orders/CreateOrderDialog.tsx`, agregar
`DialogFooter` al import existente de `@/components/ui/dialog` (línea 6-11):

```tsx
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
```

Y cambiar el bloque de botones (líneas 766-776), de:

```tsx
            <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={handleClose} disabled={submitting} className="w-full sm:w-auto">
                Cancelar
              </Button>
              <motion.div className="w-full sm:w-auto" {...(submitting ? {} : formButtonMotion)}>
                <Button onClick={handleSubmit} disabled={submitting} className="w-full sm:w-auto">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {submitting ? "Guardando..." : "Crear Pedido"}
                </Button>
              </motion.div>
            </div>
```

a:

```tsx
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={handleClose} disabled={submitting} className="w-full sm:w-auto">
                Cancelar
              </Button>
              <motion.div className="w-full sm:w-auto" {...(submitting ? {} : formButtonMotion)}>
                <Button onClick={handleSubmit} disabled={submitting} className="w-full sm:w-auto">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {submitting ? "Guardando..." : "Crear Pedido"}
                </Button>
              </motion.div>
            </DialogFooter>
```

Nota: `DialogFooter` ya trae su propio `border-t`, `gap-2` y layout
`flex-col-reverse sm:flex-row sm:justify-end` (ver `dialog.tsx:50-64`), así
que las clases que sobran del `div` original no se trasladan.

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm run test -- CreateOrderDialog.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/orders/CreateOrderDialog.tsx apps/web/src/components/orders/CreateOrderDialog.test.tsx
git commit -m "fix: el botón Crear Pedido queda anclado en vez de perderse con el scroll"
```

---

### Task 5: Bug B6 — la lista móvil de Pedidos monta cientos de tarjetas a la vez

**Files:**
- Modify: `apps/web/src/components/data-table.tsx`
- Test: `apps/web/src/components/data-table.test.tsx`

**Interfaces:**
- Consumes: nada de otras tareas.
- Produces: nada que otras tareas consuman. No cambia la firma pública de
  `DataTable` (mismos props).

**Contexto para quien implemente:** `DataTable` ya virtualiza la tabla de
escritorio cuando `virtualize` es `true` (línea 57-63, vía
`@tanstack/react-virtual`), pero la rama móvil (líneas 242-284) ignora por
completo la virtualización y renderiza **todas** las filas como tarjetas. Hoy
sólo `apps/web/src/app/dashboard/orders/page.tsx:862` pasa `virtualize`, así
que el impacto de este cambio queda acotado a la pantalla de Pedidos.

El arreglo no intenta virtualizar de verdad la lista móvil (eso es trabajo de
Fase 5, con scroll infinito real) — sólo evita que se monten cientos de
tarjetas de una vez, paginando con un botón "Cargar más" cuando `virtualize`
está activo.

- [ ] **Step 1: Escribir el test que reproduce el bug**

Crear `apps/web/src/components/data-table.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "./data-table";

interface Row {
  id: number;
}

const columns: ColumnDef<Row, unknown>[] = [
  { accessorKey: "id", header: "ID", cell: ({ row }) => `Fila ${row.original.id}` },
];

const data: Row[] = Array.from({ length: 50 }, (_, i) => ({ id: i + 1 }));

describe("DataTable, lista móvil con virtualize activo", () => {
  it("monta sólo un lote de tarjetas al inicio, no las 50 de una vez", () => {
    render(<DataTable columns={columns} data={data} virtualize />);
    const mobileList = screen.getByTestId("mobile-card-list");
    expect(within(mobileList).getAllByText(/^Fila \d+$/)).toHaveLength(30);
  });

  it("el botón Cargar más revela el resto de las filas", async () => {
    render(<DataTable columns={columns} data={data} virtualize />);
    const mobileList = screen.getByTestId("mobile-card-list");
    await userEvent.click(screen.getByRole("button", { name: /Cargar más/i }));
    expect(within(mobileList).getAllByText(/^Fila \d+$/)).toHaveLength(50);
  });

  it("sin virtualize, se comporta igual que siempre (todas las filas)", () => {
    render(<DataTable columns={columns} data={data.slice(0, 10)} />);
    const mobileList = screen.getByTestId("mobile-card-list");
    expect(within(mobileList).getAllByText(/^Fila \d+$/)).toHaveLength(10);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm run test -- data-table.test.tsx`
Expected: FAIL — no existe el `data-testid="mobile-card-list"` todavía, y aun
agregándolo sin la paginación se montarían las 50 filas de una.

- [ ] **Step 3: Aplicar el arreglo mínimo**

En `apps/web/src/components/data-table.tsx`, cambiar el import de React
(línea 3):

```tsx
import { useRef } from "react";
```

a:

```tsx
import { useEffect, useRef, useState } from "react";
```

Agregar el import de `Button` junto a los demás imports de componentes
(después de la línea 20, junto al bloque de `@/components/ui/table`):

```tsx
import { Button } from "@/components/ui/button";
```

Definir la constante del tamaño de lote, antes de `export function DataTable`:

```tsx
const MOBILE_PAGE_SIZE = 30;
```

Dentro de `DataTable`, junto a los demás hooks (después de la línea
`const scrollRef = useRef<HTMLDivElement>(null);`), agregar el estado y su
reset cuando cambian los datos:

```tsx
  const [mobileVisibleCount, setMobileVisibleCount] = useState(MOBILE_PAGE_SIZE);
  useEffect(() => {
    setMobileVisibleCount(MOBILE_PAGE_SIZE);
  }, [data]);
```

Ahora hay que agregar `data-testid="mobile-card-list"` a **ambos** `div`
móviles (el de la rama `!virtualize`, línea 121, y el de la rama virtualizada,
línea 246), para que el test pueda ubicarlos igual en los dos casos. Cambiar:

```tsx
        <div className="flex flex-col gap-2.5 md:hidden">
```

(aparece dos veces, líneas 121 y 246) por:

```tsx
        <div className="flex flex-col gap-2.5 md:hidden" data-testid="mobile-card-list">
```

Finalmente, en la rama virtualizada (líneas 246-284), reemplazar el bloque
completo:

```tsx
      <div className="flex flex-col gap-2.5 md:hidden" data-testid="mobile-card-list">
        {rows.length ? (
          rows.map((row) => (
            <div
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              className={cn(
                "rounded-xl border bg-card p-3.5 shadow-soft transition-colors",
                onRowClick && "cursor-pointer active:bg-primary/[0.04]"
              )}
            >
              {row.getVisibleCells().map((cell) => {
                const rawHeader = cell.column.columnDef.header;
                const isLabeled = typeof rawHeader === "string";
                const headerLabel = isLabeled ? rawHeader : null;
                return (
                  <div
                    key={cell.id}
                    className="flex items-center justify-between gap-3 border-b border-border/60 py-1.5 last:border-b-0 last:pb-0 first:pt-0"
                  >
                    {isLabeled && (
                      <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {headerLabel}
                      </span>
                    )}
                    <div className={cn("min-w-0 text-sm", isLabeled ? "text-right" : "w-full")}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        ) : (
          <div className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
            No hay resultados.
          </div>
        )}
      </div>
```

por:

```tsx
      <div className="flex flex-col gap-2.5 md:hidden" data-testid="mobile-card-list">
        {rows.length ? (
          <>
            {rows.slice(0, mobileVisibleCount).map((row) => (
              <div
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={cn(
                  "rounded-xl border bg-card p-3.5 shadow-soft transition-colors",
                  onRowClick && "cursor-pointer active:bg-primary/[0.04]"
                )}
              >
                {row.getVisibleCells().map((cell) => {
                  const rawHeader = cell.column.columnDef.header;
                  const isLabeled = typeof rawHeader === "string";
                  const headerLabel = isLabeled ? rawHeader : null;
                  return (
                    <div
                      key={cell.id}
                      className="flex items-center justify-between gap-3 border-b border-border/60 py-1.5 last:border-b-0 last:pb-0 first:pt-0"
                    >
                      {isLabeled && (
                        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {headerLabel}
                        </span>
                      )}
                      <div className={cn("min-w-0 text-sm", isLabeled ? "text-right" : "w-full")}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            {rows.length > mobileVisibleCount && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setMobileVisibleCount((c) => c + MOBILE_PAGE_SIZE)}
              >
                Cargar más ({rows.length - mobileVisibleCount} restantes)
              </Button>
            )}
          </>
        ) : (
          <div className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
            No hay resultados.
          </div>
        )}
      </div>
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm run test -- data-table.test.tsx`
Expected: PASS

- [ ] **Step 5: Correr toda la suite de tests para descartar regresiones en otras pantallas que usan `DataTable`**

Run: `npm run test`
Expected: PASS — ninguna otra pantalla pasa `virtualize`, así que su
comportamiento no cambia (ver Step 3 del análisis: el único caller es
`orders/page.tsx:862`).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/data-table.tsx apps/web/src/components/data-table.test.tsx
git commit -m "fix: la lista móvil de Pedidos ya no monta cientos de tarjetas de una vez"
```

---

### Task 6: Bug B1 — la captura de fotos falla (HEIC rechazado, sin compresión)

**Files:**
- Modify: `apps/web/src/lib/fileInput.ts`
- Modify: `apps/web/src/components/orders/CreateOrderDialog.tsx`
- Modify: `apps/web/src/components/orders/DesignFlowSection.tsx`
- Test: `apps/web/src/lib/fileInput.test.ts`

**Interfaces:**
- Produces: `normalizeImageFile(file: File): Promise<File | null>` en
  `apps/web/src/lib/fileInput.ts`. Devuelve el PDF sin tocar; devuelve la
  imagen sin tocar si ya es PNG/JPEG y pesa ≤5MB; si no, intenta decodificarla
  (cubre HEIC, que Safari sí decodifica) y la reescribe como JPEG
  redimensionado a un máximo de 2000px en el lado mayor, calidad 0.8. Devuelve
  `null` si el navegador no puede decodificar el archivo (el llamador debe
  mostrar el error de formato existente).
- Consumes: nada de otras tareas.

**Contexto para quien implemente:** iOS entrega fotos de la cámara en formato
HEIC. `accept="image/*"` en `camera-capture-button.tsx` ya lo permite
seleccionar, pero los tres puntos de validación (`CreateOrderDialog.tsx`, y
dos veces en `DesignFlowSection.tsx`) sólo aceptan
`image/png`/`image/jpeg`/`application/pdf`, así que el operario recibe un
error de formato. Además ninguno comprime: una foto de 12MP puede pesar 4-8MB
contra el límite de 5MB.

La solución no cambia el límite ni los formatos aceptados por el backend: en
vez de eso, normaliza la imagen en el navegador ANTES de validar tipo y
tamaño. Como Safari (donde corre la PWA en iPhone) decodifica HEIC de forma
nativa en `<canvas>`, no hace falta ninguna librería: se decodifica con
`createImageBitmap`, se dibuja en un canvas redimensionado, y se exporta como
JPEG.

`CreateOrderDialog.tsx` hoy duplica su propia versión de estas constantes y de
la función de lectura a base64 (líneas 54-76) en vez de reusar
`apps/web/src/lib/fileInput.ts`, que es justamente el módulo que ya usa
`DesignFlowSection.tsx`. Esta tarea aprovecha el cambio para unificarlas: es
el mismo archivo que hay que tocar para el arreglo, y evita que el bug de HEIC
se vuelva a corregir sólo a medias.

- [ ] **Step 1: Escribir el test que reproduce el bug**

Crear `apps/web/src/lib/fileInput.test.ts` (nota el comentario
`@vitest-environment jsdom` en la primera línea: este archivo necesita DOM
—`document`, `HTMLCanvasElement`, `File`— pero por convención del repo los
`.test.ts` en `src/lib` corren en Node; el comentario fuerza jsdom sólo para
este archivo sin tocar `vitest.config.ts`):

```ts
/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  normalizeImageFile,
  isAllowedUploadMime,
  UPLOAD_FILE_MAX_BYTES,
} from "./fileInput";

function makeFile(name: string, type: string, sizeBytes: number): File {
  const content = new Uint8Array(sizeBytes);
  return new File([content], name, { type });
}

describe("normalizeImageFile", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 4000, height: 3000, close: vi.fn() })
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      (callback: BlobCallback) => {
        callback(new Blob(["contenido-comprimido"], { type: "image/jpeg" }));
      }
    );
  });

  it("deja pasar un PDF sin tocarlo", async () => {
    const pdf = makeFile("hoja.pdf", "application/pdf", 1024);
    const result = await normalizeImageFile(pdf);
    expect(result).toBe(pdf);
  });

  it("deja pasar un JPEG ya válido y liviano sin recomprimir", async () => {
    const jpeg = makeFile("foto.jpg", "image/jpeg", 1024);
    const result = await normalizeImageFile(jpeg);
    expect(result).toBe(jpeg);
  });

  it("convierte un HEIC de la cámara de iOS a JPEG dentro del límite", async () => {
    // Las fotos HEIC de iOS suelen pesar más que el límite de 5MB.
    const heic = makeFile("IMG_0001.HEIC", "image/heic", UPLOAD_FILE_MAX_BYTES + 1_000_000);
    const result = await normalizeImageFile(heic);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("image/jpeg");
    expect(isAllowedUploadMime(result!.type)).toBe(true);
  });

  it("recomprime un JPEG que supera el límite de tamaño", async () => {
    const jpegPesado = makeFile("foto.jpg", "image/jpeg", UPLOAD_FILE_MAX_BYTES + 1_000_000);
    const result = await normalizeImageFile(jpegPesado);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("image/jpeg");
  });

  it("devuelve null si el navegador no puede decodificar el archivo", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockRejectedValue(new Error("formato no soportado"))
    );
    const heic = makeFile("IMG_0002.HEIC", "image/heic", 2_000_000);
    const result = await normalizeImageFile(heic);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm run test -- fileInput.test.ts`
Expected: FAIL — `normalizeImageFile` no existe todavía en el módulo.

- [ ] **Step 3: Implementar `normalizeImageFile` en `apps/web/src/lib/fileInput.ts`**

Agregar al final de `apps/web/src/lib/fileInput.ts` (después de
`readFileAsUploadInput`):

```ts
const MAX_IMAGE_DIMENSION = 2000;
const IMAGE_JPEG_QUALITY = 0.8;

/**
 * Normaliza cualquier imagen (incluido HEIC de la cámara de iOS, que Safari
 * decodifica de forma nativa en <canvas>) a un JPEG liviano: redimensiona el
 * lado mayor a un máximo de 2000px y comprime a calidad 0.8. Los PDF y las
 * imágenes que ya cumplen el tipo y el límite de tamaño se devuelven sin
 * tocar. Si el navegador no puede decodificar el archivo (ej. HEIC en
 * Chrome, que no tiene soporte nativo), devuelve `null`.
 */
export async function normalizeImageFile(file: File): Promise<File | null> {
  if (file.type === "application/pdf") return file;
  if (isAllowedUploadMime(file.type) && file.size <= UPLOAD_FILE_MAX_BYTES) {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }

  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return null;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", IMAGE_JPEG_QUALITY)
  );
  if (!blob) return null;

  const jpegName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], jpegName, { type: "image/jpeg" });
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm run test -- fileInput.test.ts`
Expected: PASS

- [ ] **Step 5: Usar `normalizeImageFile` en `DesignFlowSection.tsx` (dos sitios)**

En `apps/web/src/components/orders/DesignFlowSection.tsx`, agregar
`normalizeImageFile` al import existente de `@/lib/fileInput` (línea 37-42):

```tsx
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  UPLOAD_FILE_MAX_BYTES,
  isAllowedUploadMime,
  normalizeImageFile,
  readFileAsUploadInput,
} from "@/lib/fileInput";
```

Cambiar `acceptFile` (líneas 426-443), de:

```tsx
  const acceptFile = async (f: File) => {
    if (!isAllowedUploadMime(f.type)) {
      toast.error("El montaje debe ser PNG, JPG o PDF.");
      return;
    }
    if (f.size > UPLOAD_FILE_MAX_BYTES) {
      toast.error("El montaje no puede pesar más de 5MB.");
      return;
    }
    try {
      const parsed = await readFileAsUploadInput(f);
      setFile(parsed);
      setFileLabel(f.name);
      setPreviewUrl(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
    } catch {
      toast.error("No se pudo leer el archivo. Intentar de nuevo.");
    }
  };
```

a:

```tsx
  const acceptFile = async (f: File) => {
    const normalized = await normalizeImageFile(f);
    if (!normalized) {
      toast.error("El montaje debe ser PNG, JPG o PDF.");
      return;
    }
    if (!isAllowedUploadMime(normalized.type)) {
      toast.error("El montaje debe ser PNG, JPG o PDF.");
      return;
    }
    if (normalized.size > UPLOAD_FILE_MAX_BYTES) {
      toast.error("El montaje no puede pesar más de 5MB.");
      return;
    }
    try {
      const parsed = await readFileAsUploadInput(normalized);
      setFile(parsed);
      setFileLabel(normalized.name);
      setPreviewUrl(
        normalized.type.startsWith("image/") ? URL.createObjectURL(normalized) : null
      );
    } catch {
      toast.error("No se pudo leer el archivo. Intentar de nuevo.");
    }
  };
```

Y cambiar `handleFileChange` (líneas 598-614), de:

```tsx
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!isAllowedUploadMime(f.type)) {
      toast.error("El adjunto debe ser PNG, JPG o PDF.");
      e.target.value = "";
      return;
    }
    if (f.size > UPLOAD_FILE_MAX_BYTES) {
      toast.error("El adjunto no puede pesar más de 5MB.");
      e.target.value = "";
      return;
    }
    const parsed = await readFileAsUploadInput(f);
    setFile(parsed);
    setFileLabel(f.name);
  };
```

a:

```tsx
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const normalized = await normalizeImageFile(f);
    if (!normalized) {
      toast.error("El adjunto debe ser PNG, JPG o PDF.");
      e.target.value = "";
      return;
    }
    if (!isAllowedUploadMime(normalized.type)) {
      toast.error("El adjunto debe ser PNG, JPG o PDF.");
      e.target.value = "";
      return;
    }
    if (normalized.size > UPLOAD_FILE_MAX_BYTES) {
      toast.error("El adjunto no puede pesar más de 5MB.");
      e.target.value = "";
      return;
    }
    const parsed = await readFileAsUploadInput(normalized);
    setFile(parsed);
    setFileLabel(normalized.name);
  };
```

- [ ] **Step 6: Unificar `CreateOrderDialog.tsx` sobre el mismo módulo y usar `normalizeImageFile`**

En `apps/web/src/components/orders/CreateOrderDialog.tsx`, eliminar el bloque
duplicado (líneas 54-76):

```tsx
const AUTHORIZATION_FILE_MAX_BYTES = 5 * 1024 * 1024; // 5MB, igual que el límite del backend.
const ALLOWED_AUTHORIZATION_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "application/pdf",
] as const;

/** Lee un File a `{ data, filename, mimeType }` (base64 sin el prefijo data:...;base64,). */
function readFileAsAuthorizationInput(file: File): Promise<AuthorizationFileInput> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const base64 = result.split(",")[1] ?? "";
      resolve({
        data: base64,
        filename: file.name,
        mimeType: file.type as AuthorizationFileInput["mimeType"],
      });
    };
    reader.readAsDataURL(file);
  });
}
```

y agregar en su lugar, cerca del resto de los imports (junto a la línea del
import de `CreatableCombobox`):

```tsx
import {
  isAllowedUploadMime,
  normalizeImageFile,
  readFileAsUploadInput,
  UPLOAD_FILE_MAX_BYTES,
} from "@/lib/fileInput";
```

`AuthorizationFileInput` (de `@/types`) y `UploadFileInput` (de
`@/lib/fileInput`) tienen exactamente la misma forma
(`{ data, filename, mimeType }` con `mimeType` limitado a
`"image/png" | "image/jpeg" | "application/pdf"`), así que lo que devuelve
`readFileAsUploadInput` sirve sin cambios donde antes se usaba
`readFileAsAuthorizationInput`.

Cambiar `handleAuthorizationFileChange` (líneas 211-243), de:

```tsx
  const handleAuthorizationFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (
      !ALLOWED_AUTHORIZATION_MIME_TYPES.includes(
        file.type as (typeof ALLOWED_AUTHORIZATION_MIME_TYPES)[number]
      )
    ) {
      toast.error("La hoja de autorización debe ser PNG, JPG o PDF.");
      e.target.value = "";
      return;
    }
    if (file.size > AUTHORIZATION_FILE_MAX_BYTES) {
      toast.error("La hoja de autorización no puede pesar más de 5MB.");
      e.target.value = "";
      return;
    }

    try {
      const parsedFile = await readFileAsAuthorizationInput(file);
      setAuthorizationFile(parsedFile);
      setAuthorizationFilePreview(
        file.type.startsWith("image/") ? URL.createObjectURL(file) : null
      );
    } catch {
      toast.error("No se pudo leer el archivo. Intentar de nuevo.");
    } finally {
      e.target.value = "";
    }
  };
```

a:

```tsx
  const handleAuthorizationFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const normalized = await normalizeImageFile(file);
    if (!normalized || !isAllowedUploadMime(normalized.type)) {
      toast.error("La hoja de autorización debe ser PNG, JPG o PDF.");
      e.target.value = "";
      return;
    }
    if (normalized.size > UPLOAD_FILE_MAX_BYTES) {
      toast.error("La hoja de autorización no puede pesar más de 5MB.");
      e.target.value = "";
      return;
    }

    try {
      const parsedFile = await readFileAsUploadInput(normalized);
      setAuthorizationFile(parsedFile);
      setAuthorizationFilePreview(
        normalized.type.startsWith("image/") ? URL.createObjectURL(normalized) : null
      );
    } catch {
      toast.error("No se pudo leer el archivo. Intentar de nuevo.");
    } finally {
      e.target.value = "";
    }
  };
```

- [ ] **Step 7: Correr toda la suite de tests para descartar regresiones**

Run: `npm run test`
Expected: PASS. Prestar atención especial a cualquier test existente de
`CreateOrderDialog` o `DesignFlowSection` que dependiera de los nombres
`AUTHORIZATION_FILE_MAX_BYTES` / `ALLOWED_AUTHORIZATION_MIME_TYPES` /
`readFileAsAuthorizationInput` eliminados en el Step 6; si alguno los importa
directamente, actualizarlo para usar los equivalentes de `@/lib/fileInput`.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/fileInput.ts apps/web/src/lib/fileInput.test.ts apps/web/src/components/orders/CreateOrderDialog.tsx apps/web/src/components/orders/DesignFlowSection.tsx
git commit -m "fix: la captura de fotos acepta HEIC de iOS y comprime antes de subir"
```

---

## Verificación final del plan

Después de aplicar las 6 tareas (en cualquier orden — son independientes):

- [ ] **Correr toda la suite:** `npm run test` desde `apps/web`. Expected:
  PASS completo.
- [ ] **Typecheck:** `npm run build` desde `apps/web` (Next.js corre
  typecheck como parte del build). Expected: sin errores de TypeScript.
- [ ] **Lint:** `npm run lint` desde `apps/web`. Expected: sin errores nuevos.

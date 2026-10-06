"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Inbox, Monitor, PartyPopper, UserRound, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GreetingHeader } from "@/components/admin/GreetingHeader";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/feedback/states";
import { TaskCard } from "@/components/tasks/TaskCard";
import { OrderDetailDialog } from "@/components/orders/OrderDetailDialog";
import { TasksTvMode } from "@/components/tasks/tv/TasksTvMode";
import { useAdvanceMyTask, useMyTasks } from "@/hooks/useMyTasks";
import { usePermissions } from "@/hooks/usePermissions";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import { useNow } from "@/hooks/useNow";
import { getAreaIcon, getAreaLabel } from "@/lib/areas";
import { formatRoleList } from "@/lib/roles";
import { groupMyTasks, taskAreas, taskDeadline } from "@/lib/myTasks";
import { cn } from "@/lib/utils";
import type { MyTask } from "@/types";

const ALL = "all";

/**
 * Escucha `?tv=1` (y `&demo=1`). Aparte y en `<Suspense>` porque
 * `useSearchParams` lo exige, y porque la paleta ⌘K navega a
 * `/dashboard/tareas?tv=1` estando ya aquí: la página no se vuelve a montar.
 */
function TareasUrlWatcher({ onChange }: { onChange: (params: URLSearchParams) => void }) {
  const query = useSearchParams().toString();
  useEffect(() => onChange(new URLSearchParams(query)), [query, onChange]);
  return null;
}

/** Quita un parámetro de la URL sin navegar (al cerrar el Modo TV). */
function clearUrlParams(...keys: string[]) {
  try {
    const url = new URL(window.location.href);
    if (!keys.some((k) => url.searchParams.has(k))) return;
    keys.forEach((k) => url.searchParams.delete(k));
    window.history.replaceState(null, "", url.toString());
  } catch {
    // Sin acceso a la URL: no afecta a la pantalla.
  }
}

/** Cabecera de grupo al estilo kanban: píldora con ícono, nombre y contador. */
function ColumnHeader({ id, icon: Icon, label, count }: { id: string; icon: LucideIcon; label: string; count: number }) {
  return (
    <div className="flex items-center rounded-2xl border border-border/60 bg-card px-3 py-2.5 dark:border-border">
      <h2
        id={id}
        className="inline-flex items-center gap-2 rounded-full bg-muted py-1 pl-2.5 pr-1 text-sm font-medium"
      >
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
        {label}
        <span className="rounded-full bg-card px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{count}</span>
      </h2>
    </div>
  );
}

/**
 * "Tareas asignadas": la pantalla de trabajo de Diseño y Producción. Una
 * tarjeta por TAREA (si un pedido pasa por Taller y DTF y la persona hace las
 * dos, ve dos), de todas sus áreas juntas. Sólo lo suyo y lo libre para
 * tomar; la gestión de pedidos completa queda en "Pedidos" (Recepción).
 */
export default function TareasPage() {
  const { roles, session } = usePermissions();
  const { tasks, isLoading, isError, refetch } = useMyTasks();
  const { advance, pendingKey } = useAdvanceMyTask();
  const { timeFormat } = useTimeFormat();
  const now = useNow(60_000);
  const [area, setArea] = useState<string>(ALL);
  const [openOrderId, setOpenOrderId] = useState<number | null>(null);
  const [tv, setTv] = useState<{ open: boolean; demo: boolean }>({ open: false, demo: false });

  // `?tv=1` queda en la URL mientras la tele esté abierta (un F5 la reabre) y se limpia al salir.
  const handleUrlParams = useCallback((params: URLSearchParams) => {
    if (params.get("tv") === "1") setTv({ open: true, demo: params.get("demo") === "1" });
  }, []);
  const closeTv = useCallback(() => {
    setTv({ open: false, demo: false });
    clearUrlParams("tv", "demo");
  }, []);

  const areas = useMemo(() => taskAreas(tasks, roles), [tasks, roles]);
  const activeArea = area !== ALL && areas.includes(area) ? area : null;
  const { mine, free } = useMemo(() => groupMyTasks(tasks, now, activeArea), [tasks, now, activeArea]);

  const description =
    tasks.length === 0
      ? `Tus tareas asignadas en ${formatRoleList(roles)}.`
      : `Tus tareas asignadas: ${mine.length} tuya${mine.length === 1 ? "" : "s"} · ${free.length} libre${
          free.length === 1 ? "" : "s"
        } para tomar en ${formatRoleList(roles)}.`;

  const renderList = (list: MyTask[]) => (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {list.map((task) => (
        <li key={task.key} className="min-w-0">
          <TaskCard
            task={task}
            state={taskDeadline(task, now)}
            timeFormat={timeFormat}
            onOpen={setOpenOrderId}
            onAdvance={advance}
            busy={pendingKey === task.key}
          />
        </li>
      ))}
    </ul>
  );

  return (
    <div className="space-y-8">
      <Suspense fallback={null}>
        <TareasUrlWatcher onChange={handleUrlParams} />
      </Suspense>
      <GreetingHeader firstName={session?.user?.first_name} subtitle={description} />

      <div className={cn("flex-wrap items-center gap-3", areas.length > 1 ? "flex" : "hidden sm:flex")}>
        {areas.length > 1 && (
          <ToggleGroup
            type="single"
            variant="segmented"
            size="sm"
            value={activeArea ?? ALL}
            onValueChange={(v) => v && setArea(v)}
            aria-label="Filtrar por área"
            className="flex-wrap justify-start rounded-full border bg-card p-1 sm:inline-flex"
          >
            <ToggleGroupItem value={ALL}>Todas</ToggleGroupItem>
            {areas.map((value) => {
              const Icon = getAreaIcon(value);
              return (
                <ToggleGroupItem key={value} value={value} className="gap-1.5">
                  {Icon && <Icon aria-hidden />}
                  {getAreaLabel(value)}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        )}
        {/* La tele del área (todo el trabajo, no sólo lo tuyo): no tiene sentido en un teléfono. */}
        <Button
          variant="outline"
          className="ml-auto hidden gap-2 sm:inline-flex"
          onClick={() => setTv({ open: true, demo: false })}
        >
          <Monitor className="h-4 w-4" />
          Modo TV
        </Button>
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-52 w-full rounded-2xl" />
          <Skeleton className="h-52 w-full rounded-2xl" />
          <Skeleton className="h-52 w-full rounded-2xl" />
        </div>
      ) : mine.length === 0 && free.length === 0 ? (
        <EmptyState
          icon={PartyPopper}
          title="Sin tareas por ahora"
          description="Cuando Recepción te asigne algo, o entre trabajo nuevo a tu área, aparece aquí."
        />
      ) : (
        <div className="space-y-8">
          <section className="space-y-4" aria-labelledby="tareas-mias">
            <ColumnHeader id="tareas-mias" icon={UserRound} label="Tuyas" count={mine.length} />
            {mine.length === 0 ? (
              <p className="px-1 text-sm text-muted-foreground">
                No tienes tareas a tu nombre. Toma una de las libres para empezar.
              </p>
            ) : (
              renderList(mine)
            )}
          </section>
          {free.length > 0 && (
            <section className="space-y-4" aria-labelledby="tareas-libres">
              <ColumnHeader id="tareas-libres" icon={Inbox} label="Libres para tomar" count={free.length} />
              {renderList(free)}
            </section>
          )}
        </div>
      )}

      {/* El Modo TV abre el detalle de un pedido encima de sí mismo (sin cerrarse). */}
      {tv.open && <TasksTvMode demo={tv.demo} onClose={closeTv} />}
      <OrderDetailDialog orderId={openOrderId} onClose={() => setOpenOrderId(null)} />
    </div>
  );
}

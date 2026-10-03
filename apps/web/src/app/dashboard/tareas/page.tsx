"use client";

import { useMemo, useState } from "react";
import { Inbox, PartyPopper, UserRound, type LucideIcon } from "lucide-react";
import { GreetingHeader } from "@/components/admin/GreetingHeader";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/feedback/states";
import { TaskCard } from "@/components/tasks/TaskCard";
import { OrderDetailDialog } from "@/components/orders/OrderDetailDialog";
import { useAdvanceMyTask, useMyTasks } from "@/hooks/useMyTasks";
import { usePermissions } from "@/hooks/usePermissions";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import { useNow } from "@/hooks/useNow";
import { getAreaIcon, getAreaLabel } from "@/lib/areas";
import { formatRoleList } from "@/lib/roles";
import { groupMyTasks, taskAreas, taskDeadline } from "@/lib/myTasks";
import type { MyTask } from "@/types";

const ALL = "all";

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
      <GreetingHeader firstName={session?.user?.first_name} subtitle={description} />

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
          description="Cuando Recepción te asigne algo, o entre trabajo nuevo a tu área, aparece acá."
        />
      ) : (
        <div className="space-y-8">
          <section className="space-y-4" aria-labelledby="tareas-mias">
            <ColumnHeader id="tareas-mias" icon={UserRound} label="Tuyas" count={mine.length} />
            {mine.length === 0 ? (
              <p className="px-1 text-sm text-muted-foreground">
                No tenés tareas a tu nombre. Tomá una de las libres para empezar.
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

      <OrderDetailDialog orderId={openOrderId} onClose={() => setOpenOrderId(null)} />
    </div>
  );
}

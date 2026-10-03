"use client";

import { useMemo, useState } from "react";
import { PartyPopper } from "lucide-react";
import Title from "@/components/Title";
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

/**
 * "Tareas asignadas": la pantalla de trabajo de Diseño y Producción. Una
 * tarjeta por TAREA (si un pedido pasa por Taller y DTF y la persona hace las
 * dos, ve dos), de todas sus áreas juntas. Sólo lo suyo y lo libre para
 * tomar; la gestión de pedidos completa queda en "Pedidos" (Recepción).
 */
export default function TareasPage() {
  const { roles } = usePermissions();
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
      ? `Tu trabajo en ${formatRoleList(roles)}.`
      : `${mine.length} tuya${mine.length === 1 ? "" : "s"} · ${free.length} libre${
          free.length === 1 ? "" : "s"
        } para tomar en ${formatRoleList(roles)}.`;

  const renderList = (list: MyTask[]) => (
    <ul className="space-y-2">
      {list.map((task) => (
        <li key={task.key}>
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
    <div className="space-y-6">
      <Title title="Tareas asignadas" description={description} />

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
        <div className="space-y-2">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : mine.length === 0 && free.length === 0 ? (
        <EmptyState
          icon={PartyPopper}
          title="Sin tareas por ahora"
          description="Cuando Recepción te asigne algo, o entre trabajo nuevo a tu área, aparece acá."
        />
      ) : (
        <div className="space-y-8">
          <section className="space-y-3" aria-labelledby="tareas-mias">
            <h2 id="tareas-mias" className="text-section-title">
              Tuyas <span className="font-normal tabular-nums text-muted-foreground">{mine.length}</span>
            </h2>
            {mine.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No tenés tareas a tu nombre. Tomá una de las libres para empezar.
              </p>
            ) : (
              renderList(mine)
            )}
          </section>
          {free.length > 0 && (
            <section className="space-y-3" aria-labelledby="tareas-libres">
              <h2 id="tareas-libres" className="text-section-title">
                Libres para tomar{" "}
                <span className="font-normal tabular-nums text-muted-foreground">{free.length}</span>
              </h2>
              {renderList(free)}
            </section>
          )}
        </div>
      )}

      <OrderDetailDialog orderId={openOrderId} onClose={() => setOpenOrderId(null)} />
    </div>
  );
}

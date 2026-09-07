"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { LayoutList, Rows3, PackageSearch } from "lucide-react";
import Title from "@/components/Title";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState, TableSkeleton } from "@/components/feedback/states";
import { OrderDetailDialog } from "@/components/orders/OrderDetailDialog";
import { AreaTaskCard } from "@/components/orders/AreaTaskCard";
import { useMyAreaTasks, type MyAreaTask } from "@/hooks/useMyAreaTasks";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { staggerContainerVariants } from "@/lib/motion";
import { getAreaLabel } from "@/lib/areas";
import { cn } from "@/lib/utils";

/**
 * "Mi trabajo": la bandeja de producción del usuario.
 *
 * Muestra únicamente las tareas de SUS áreas — si alguien es bordador y
 * laserista ve Bordado y Láser mezcladas, cada una etiquetada, y nada de otras
 * áreas. No hay una pantalla por área: la separación es sólo una preferencia
 * de visualización, personal de cada usuario (ver WORKFLOW.md §4 en el
 * backend).
 */
export default function MiTrabajoPage() {
  const { tasks, isLoading, isError, refetch } = useMyAreaTasks();
  const { preferences, updatePreferences } = useUserPreferences();
  const [openOrderId, setOpenOrderId] = useState<number | null>(null);

  const viewMode = preferences?.areaViewMode ?? "unified";

  /** Tareas agrupadas por área, para el modo "split". */
  const byArea = useMemo(() => {
    const groups = new Map<string, MyAreaTask[]>();
    tasks.forEach((task) => {
      const list = groups.get(task.area) ?? [];
      list.push(task);
      groups.set(task.area, list);
    });
    return [...groups.entries()].sort(([a], [b]) =>
      getAreaLabel(a).localeCompare(getAreaLabel(b))
    );
  }, [tasks]);

  const pendingCount = tasks.filter((t) => t.status !== "terminado").length;

  const setViewMode = (mode: "unified" | "split") => {
    if (mode === viewMode) return;
    updatePreferences({ areaViewMode: mode });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Title title="Mi trabajo" />
          <p className="text-sm text-muted-foreground">
            {pendingCount === 0
              ? "Sin tareas pendientes por ahora."
              : `${pendingCount} tarea${pendingCount === 1 ? "" : "s"} pendiente${
                  pendingCount === 1 ? "" : "s"
                } en tus áreas.`}
          </p>
        </div>

        {/* Preferencia personal: todo junto o separado por área. */}
        <div className="flex items-center gap-1 rounded-full border p-1">
          <Button
            type="button"
            size="sm"
            variant={viewMode === "unified" ? "default" : "ghost"}
            className={cn("gap-1.5 rounded-full text-xs")}
            onClick={() => setViewMode("unified")}
          >
            <LayoutList className="h-3.5 w-3.5" />
            Todo junto
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewMode === "split" ? "default" : "ghost"}
            className={cn("gap-1.5 rounded-full text-xs")}
            onClick={() => setViewMode("split")}
          >
            <Rows3 className="h-3.5 w-3.5" />
            Por área
          </Button>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : isError ? (
        <ErrorState
          title="No se pudieron cargar las tareas"
          description="Ocurrió un problema al comunicarse con el servidor."
          onRetry={() => refetch()}
        />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="No hay tareas asignadas a tus áreas"
          description="Cuando entre un pedido que necesite tu área, va a aparecer acá."
        />
      ) : viewMode === "split" ? (
        <div className="space-y-8">
          {byArea.map(([area, areaTasks]) => (
            <section key={area} className="space-y-3">
              <h2 className="flex items-center gap-2 font-heading text-base font-semibold">
                {getAreaLabel(area)}
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {areaTasks.length}
                </span>
              </h2>
              <motion.div
                className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
                variants={staggerContainerVariants}
                initial="hidden"
                animate="show"
              >
                {areaTasks.map((task) => (
                  <AreaTaskCard
                    key={task.id}
                    task={task}
                    // Agrupadas por área, repetir la etiqueta es ruido.
                    showAreaLabel={false}
                    onOpenOrder={setOpenOrderId}
                  />
                ))}
              </motion.div>
            </section>
          ))}
        </div>
      ) : (
        <motion.div
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
          variants={staggerContainerVariants}
          initial="hidden"
          animate="show"
        >
          {tasks.map((task) => (
            <AreaTaskCard key={task.id} task={task} onOpenOrder={setOpenOrderId} />
          ))}
        </motion.div>
      )}

      <OrderDetailDialog orderId={openOrderId} onClose={() => setOpenOrderId(null)} />
    </div>
  );
}

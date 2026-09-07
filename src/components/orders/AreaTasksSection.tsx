"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  CheckCircle2,
  Circle,
  Loader2,
  Play,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAreaTasks } from "@/hooks/useAreaTasks";
import { usePermissions } from "@/hooks/usePermissions";
import { useMotionPreset } from "@/lib/motion";
import { getAreaIcon, getAreaLabel, PRODUCTION_AREA_OPTIONS } from "@/lib/areas";
import { getErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { AreaTaskStatus, OrderAreaTask } from "@/types";

/** Roles que pueden agregar/quitar áreas y reasignar libremente. */
const MANAGER_ROLES = ["recepcion", "admin", "superuser"];

const STATUS_META: Record<
  AreaTaskStatus,
  { label: string; classes: string; icon: typeof Circle }
> = {
  pendiente: {
    label: "Pendiente",
    classes:
      "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
    icon: Circle,
  },
  en_proceso: {
    label: "En proceso",
    classes:
      "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
    icon: Play,
  },
  terminado: {
    label: "Terminado",
    classes:
      "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
    icon: CheckCircle2,
  },
};

/** Siguiente paso del ciclo corto pendiente → en proceso → terminado. */
function nextStatus(status: AreaTaskStatus): AreaTaskStatus | null {
  if (status === "pendiente") return "en_proceso";
  if (status === "en_proceso") return "terminado";
  return null;
}

function assignedLabel(task: OrderAreaTask): string {
  const user = task.assignedUser;
  if (!user) return "Sin asignar";
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username;
  return user.isSharedAccount ? `Área: ${name}` : name;
}

interface AreaTasksSectionProps {
  orderId: number;
}

/**
 * Áreas de producción de un pedido, cada una con su avance y su responsable.
 *
 * Varias áreas conviven y avanzan en paralelo: nadie espera a nadie. Cuando
 * todas quedan en "Terminado" el backend deja el pedido listo para entregar
 * (la entrega la confirma Recepción). Ver WORKFLOW.md §3 en el backend.
 */
export function AreaTasksSection({ orderId }: AreaTasksSectionProps) {
  const { roles, session } = usePermissions();
  const { staggerItemVariants } = useMotionPreset();
  const {
    tasks,
    isLoading,
    isUnavailable,
    setStatus,
    assign,
    addAreas,
    removeArea,
  } = useAreaTasks(orderId);
  const [areaToAdd, setAreaToAdd] = useState<string>("");

  const userId = session?.user?.id ? Number(session.user.id) : null;
  const isManager = roles.some((r) => MANAGER_ROLES.includes(r));

  const usedAreas = useMemo(() => new Set(tasks.map((t) => t.area)), [tasks]);
  const availableAreas = PRODUCTION_AREA_OPTIONS.filter(
    (option) => !usedAreas.has(option.value)
  );

  /** Un área ajena sólo se puede mirar; Recepción/admin pueden con todas. */
  const canWork = (area: string) => isManager || roles.includes(area);

  const handleAdvance = async (task: OrderAreaTask) => {
    const next = nextStatus(task.status);
    if (!next) return;
    try {
      await setStatus.mutateAsync({ taskId: task.id, status: next });
      toast.success(
        next === "terminado"
          ? `${getAreaLabel(task.area)} terminó su parte`
          : `${getAreaLabel(task.area)} en proceso`
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleTake = async (task: OrderAreaTask) => {
    if (userId === null) return;
    try {
      await assign.mutateAsync({ taskId: task.id, assignedUserId: userId });
      toast.success("Tarea tomada");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleAddArea = async () => {
    if (!areaToAdd) return;
    try {
      await addAreas.mutateAsync([areaToAdd]);
      setAreaToAdd("");
      toast.success(`${getAreaLabel(areaToAdd)} agregada al pedido`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleRemove = async (task: OrderAreaTask) => {
    try {
      await removeArea.mutateAsync(task.id);
      toast.success(`${getAreaLabel(task.area)} quitada del pedido`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  // El backend todavía no expone el endpoint: no se muestra nada en vez de un
  // error, para no ensuciar el detalle del pedido.
  if (isUnavailable) return null;

  const allDone = tasks.length > 0 && tasks.every((t) => t.status === "terminado");

  return (
    <section className="space-y-3 rounded-2xl border bg-muted/20 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-heading text-sm font-semibold">Áreas de producción</h3>
          <p className="text-xs text-muted-foreground">
            {tasks.length === 0
              ? "Todavía no hay áreas asignadas a este pedido."
              : allDone
              ? "Todas las áreas terminaron: el pedido está listo para entregar."
              : "Cada área avanza por su cuenta, sin esperar a las demás."}
          </p>
        </div>
        {allDone && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            LISTO PARA ENTREGAR
          </span>
        )}
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando áreas...</p>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {tasks.map((task) => {
              const meta = STATUS_META[task.status];
              const StatusIcon = meta.icon;
              const AreaIcon = getAreaIcon(task.area);
              const next = nextStatus(task.status);
              const editable = canWork(task.area);
              const isMine = task.assignedUserId === userId;

              return (
                <motion.li
                  key={task.id}
                  variants={staggerItemVariants}
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0, height: 0 }}
                  layout
                  className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 shadow-soft"
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    {AreaIcon && (
                      <AreaIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    )}
                    <span className="truncate text-sm font-semibold">
                      {getAreaLabel(task.area)}
                    </span>
                  </span>

                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                      meta.classes
                    )}
                  >
                    <StatusIcon className="h-3.5 w-3.5" />
                    {meta.label.toUpperCase()}
                  </span>

                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <UserRound className="h-3.5 w-3.5" />
                    <span className="max-w-[12rem] truncate">{assignedLabel(task)}</span>
                  </span>

                  <span className="ml-auto flex items-center gap-1.5">
                    {/* Tomar una tarea que está a nombre del área. */}
                    {editable && !isMine && task.status !== "terminado" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="rounded-full text-xs"
                        disabled={assign.isPending}
                        onClick={() => handleTake(task)}
                      >
                        Tomar
                      </Button>
                    )}
                    {editable && next && (
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-full text-xs shadow-soft"
                        disabled={setStatus.isPending}
                        onClick={() => handleAdvance(task)}
                      >
                        {setStatus.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : next === "en_proceso" ? (
                          "Empezar"
                        ) : (
                          "Terminar"
                        )}
                      </Button>
                    )}
                    {isManager && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
                        title={`Quitar ${getAreaLabel(task.area)} del pedido`}
                        disabled={removeArea.isPending}
                        onClick={() => handleRemove(task)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </span>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      {isManager && availableAreas.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Select value={areaToAdd} onValueChange={setAreaToAdd}>
            <SelectTrigger className="h-9 w-[200px] rounded-lg">
              <SelectValue placeholder="Agregar un área..." />
            </SelectTrigger>
            <SelectContent>
              {availableAreas.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5 rounded-full"
            disabled={!areaToAdd || addAreas.isPending}
            onClick={handleAddArea}
          >
            {addAreas.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Agregar
          </Button>
        </div>
      )}
    </section>
  );
}

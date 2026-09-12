"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useCalendarTasks,
  useCalendarTaskMutations,
  useUpdateCalendarTaskComplete,
} from "@/hooks/useCalendarTasks";
import { CalendarTaskDialog } from "./CalendarTaskDialog";
import { getErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { CalendarTask } from "@/types";

/**
 * Lista de tareas pendientes del calendario de equipo: actividades sin
 * fecha todavía definida. Contenido puro (sin chrome de panel/sheet) para
 * reusarse tal cual en el panel lateral de escritorio y en la hoja inferior
 * de mobile.
 */
export function CalendarTasksList() {
  const { data: tasks, isPending } = useCalendarTasks();
  const { setCompleted } = useUpdateCalendarTaskComplete();
  const { remove } = useCalendarTaskMutations();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<CalendarTask | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<CalendarTask | null>(null);

  const { pending, completed } = useMemo(() => {
    const pending = tasks.filter((t) => !t.completed);
    const completed = tasks.filter((t) => t.completed);
    return { pending, completed };
  }, [tasks]);

  const openCreate = () => {
    setEditingTask(null);
    setDialogOpen(true);
  };

  const openEdit = (task: CalendarTask) => {
    setEditingTask(task);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!taskToDelete) return;
    try {
      await remove(taskToDelete.id);
      toast.success("Tarea eliminada");
      setTaskToDelete(null);
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo eliminar la tarea."));
    }
  };

  const renderTask = (task: CalendarTask) => (
    <div
      key={task.id}
      className="group flex items-start gap-2.5 rounded-lg border p-2.5 transition-colors hover:bg-muted/50"
    >
      <Checkbox
        checked={task.completed}
        onCheckedChange={(checked) => setCompleted(task.id, checked === true)}
        aria-label={task.completed ? "Marcar como pendiente" : "Marcar como completada"}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-medium",
            task.completed && "text-muted-foreground line-through"
          )}
        >
          {task.title}
        </p>
        {task.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => openEdit(task)}
          aria-label="Editar tarea"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => setTaskToDelete(task)}
          aria-label="Eliminar tarea"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-full flex-col gap-3">
      <Button onClick={openCreate} size="sm" className="w-full gap-1.5">
        <Plus className="h-4 w-4" />
        Nueva tarea
      </Button>

      <div className="-mx-1 flex-1 space-y-4 overflow-y-auto px-1">
        {isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="No tienes tareas pendientes"
            description="Registrá acá lo que hay que hacer aunque todavía no tenga fecha."
            action={{ label: "Crear tarea", onClick: openCreate, icon: Plus }}
            className="mt-2"
          />
        ) : (
          <>
            {pending.length > 0 && <div className="space-y-2">{pending.map(renderTask)}</div>}
            {completed.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Completadas
                </p>
                <div className="space-y-2">{completed.map(renderTask)}</div>
              </div>
            )}
          </>
        )}
      </div>

      <CalendarTaskDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        task={editingTask}
      />

      <AlertDialog open={Boolean(taskToDelete)} onOpenChange={(next) => !next && setTaskToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tarea?</AlertDialogTitle>
            <AlertDialogDescription>
              {taskToDelete ? `"${taskToDelete.title}" se borra para todo el equipo.` : ""} Esta
              acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

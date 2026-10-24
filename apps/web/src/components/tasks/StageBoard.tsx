"use client";

import {
  CheckCircle2,
  FlaskConical,
  Hammer,
  PenTool,
  type LucideIcon,
} from "lucide-react";
import { LayoutGroup } from "framer-motion";
import { MovingItem } from "@/components/motion/MovingItem";
import { TaskCard } from "@/components/tasks/TaskCard";
import {
  stageColumns,
  type StageBoard as Board,
  type StageColumnKind,
} from "@/lib/stageBoard";
import { taskDeadline } from "@/lib/myTasks";
import type { TimeFormatPreference } from "@/lib/format";
import type { AreaTaskStatus, MyTask } from "@/types";

/** Ícono de cada tipo de columna: trabajo, revisión, producción y terminado. */
export const STAGE_COLUMN_ICON: Record<StageColumnKind, LucideIcon> = {
  work: PenTool,
  review: FlaskConical,
  production: Hammer,
  done: CheckCircle2,
};

interface StageBoardProps {
  /** Área del tablero (de ella salen las columnas). */
  area: string;
  board: Board;
  now: number;
  timeFormat: TimeFormatPreference;
  onOpen: (orderId: number) => void;
  onAdvance: (task: MyTask, status: AreaTaskStatus) => void;
  pendingKey: string | null;
  canMovePrep: boolean;
}

/**
 * "Tareas asignadas" de un área con etapas (en Bordado: Digitalizado, En
 * pruebas, En producción, Terminado): cada tarjeta se ve en la etapa en la que
 * está y trae el botón del siguiente paso.
 */
export function StageTasksBoard({
  area,
  board,
  now,
  timeFormat,
  onOpen,
  onAdvance,
  pendingKey,
  canMovePrep,
}: StageBoardProps) {
  const columns = stageColumns(area);
  return (
    <LayoutGroup id={`tablero-${area}`}>
      <div
        className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:[grid-template-columns:repeat(var(--stage-columns),minmax(0,1fr))]"
        style={{ "--stage-columns": columns.length } as React.CSSProperties}
      >
        {columns.map((column) => {
          const Icon = STAGE_COLUMN_ICON[column.kind];
          const list = board[column.id] ?? [];
          const headingId = `${area}-${column.id.replace(":", "-")}`;
          return (
            <section
              key={column.id}
              aria-labelledby={headingId}
              className="min-w-0 space-y-3"
            >
              <div className="rounded-2xl border border-border/60 bg-[hsl(var(--surface-sunken))] px-3.5 py-3 dark:border-border">
                <h2
                  id={headingId}
                  className="flex items-center gap-2 font-heading text-sm font-semibold tracking-tight"
                >
                  <span aria-hidden className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </span>
                  {column.label}
                  <span className="ml-auto rounded-full bg-card px-2 py-0.5 font-sans text-xs font-medium tabular-nums text-muted-foreground shadow-soft-xs">
                    {list.length}
                  </span>
                </h2>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {column.hint}
                </p>
              </div>
              {list.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
                  Nada por aquí.
                </p>
              ) : (
                <ul className="space-y-3">
                  {list.map((task) => (
                    <MovingItem
                      key={task.key}
                      id={`${area}-${task.key}`}
                      className="min-w-0"
                    >
                      <TaskCard
                        task={task}
                        state={taskDeadline(task, now)}
                        timeFormat={timeFormat}
                        onOpen={onOpen}
                        onAdvance={onAdvance}
                        busy={pendingKey === task.key}
                        canMovePrep={canMovePrep}
                      />
                    </MovingItem>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

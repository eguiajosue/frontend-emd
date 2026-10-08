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
  EMBROIDERY_COLUMNS,
  type EmbroideryBoard as Board,
  type EmbroideryColumnId,
} from "@/lib/embroideryBoard";
import { taskDeadline } from "@/lib/myTasks";
import type { TimeFormatPreference } from "@/lib/format";
import type { AreaTaskStatus, MyTask } from "@/types";

export const EMBROIDERY_COLUMN_ICON: Record<EmbroideryColumnId, LucideIcon> = {
  digitalizado: PenTool,
  en_pruebas: FlaskConical,
  produccion: Hammer,
  terminado: CheckCircle2,
};

interface EmbroideryBoardProps {
  board: Board;
  now: number;
  timeFormat: TimeFormatPreference;
  onOpen: (orderId: number) => void;
  onAdvance: (task: MyTask, status: AreaTaskStatus) => void;
  pendingKey: string | null;
  canMovePrep: boolean;
}

/**
 * "Tareas asignadas" de Bordado en cuatro columnas (Digitalizado, En pruebas,
 * En producción, Terminado): cada tarjeta se ve en la etapa en la que está y
 * trae el botón del siguiente paso.
 */
export function EmbroideryTasksBoard({
  board,
  now,
  timeFormat,
  onOpen,
  onAdvance,
  pendingKey,
  canMovePrep,
}: EmbroideryBoardProps) {
  return (
    <LayoutGroup id="tablero-bordado">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {EMBROIDERY_COLUMNS.map((column) => {
          const Icon = EMBROIDERY_COLUMN_ICON[column.id];
          const list = board[column.id];
          const headingId = `bordado-${column.id}`;
          return (
            <section
              key={column.id}
              aria-labelledby={headingId}
              className="min-w-0 space-y-3"
            >
              <div className="rounded-2xl border border-border/60 bg-card px-3 py-2.5 dark:border-border">
                <h2
                  id={headingId}
                  className="inline-flex items-center gap-2 rounded-full bg-muted py-1 pl-2.5 pr-1 text-sm font-medium"
                >
                  <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                  {column.label}
                  <span className="rounded-full bg-card px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                    {list.length}
                  </span>
                </h2>
                <p className="mt-1.5 px-1 text-xs text-muted-foreground">
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
                      id={`bordado-${task.key}`}
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

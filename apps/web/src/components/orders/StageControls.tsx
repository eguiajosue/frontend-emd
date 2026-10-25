"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  StageDialog,
  type StageDialogMode,
} from "@/components/orders/StageDialog";
import { advanceLabel, stageNeighbors } from "@/lib/stageBoard";
import { useSampleTestPhoto } from "@/hooks/useAreaTasks";
import { cn } from "@/lib/utils";
import type { AreaStage, AreaTaskSampleTest, OrderAreaTask } from "@/types";

/** Etiqueta y color del chip de una tarea en una etapa previa a producción. */
export function stageChip(stage: AreaStage) {
  return {
    label: stage.name,
    classes:
      stage.kind === "review"
        ? "bg-info-soft text-info"
        : "bg-magenta-soft text-magenta-ink",
  };
}

function personName(
  p?: { firstName?: string | null; lastName?: string | null } | null,
) {
  return p ? [p.firstName, p.lastName].filter(Boolean).join(" ") : "";
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : format(date, "d MMM, HH:mm", { locale: es });
}

/** Foto de una ronda, que se baja recién cuando se pide verla. */
function SampleTestPhoto({
  orderId,
  taskId,
  test,
}: {
  orderId: number;
  taskId: number;
  test: AreaTaskSampleTest;
}) {
  const [open, setOpen] = useState(false);
  const query = useSampleTestPhoto(orderId, taskId, test.id, open);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-1 h-7 gap-1.5 text-xs"
        onClick={() => setOpen(true)}
      >
        <ImageIcon className="h-3.5 w-3.5" aria-hidden />
        Ver foto
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Foto de la revisión {test.round}</DialogTitle>
            <DialogDescription>{test.photoName}</DialogDescription>
          </DialogHeader>
          {query.isLoading && (
            <p className="text-sm text-muted-foreground">Cargando foto...</p>
          )}
          {query.isError && (
            <p className="text-sm text-destructive">
              No se pudo cargar la foto.
            </p>
          )}
          {query.data && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={query.data.dataUrl}
              alt={`Revisión ${test.round}`}
              className="max-h-[70vh] w-full rounded-lg object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

interface StageControlsProps {
  orderId: number;
  task: OrderAreaTask;
  /** Quien trabaja el área (o Recepción/admin) puede mover las etapas. */
  canAct: boolean;
}

/**
 * Acciones de las etapas previas a producción de una tarea (en Bordado:
 * digitalizado → pruebas → producción) y el registro de las rondas de
 * revisión.
 */
export function StageControls({ orderId, task, canAct }: StageControlsProps) {
  const [mode, setMode] = useState<StageDialogMode | null>(null);
  const tests: AreaTaskSampleTest[] = task.sampleTests ?? [];
  const stage = task.stage ?? null;
  if (!stage && tests.length === 0) return null;
  const { next } = stage
    ? stageNeighbors(task.area, stage)
    : { next: null };

  return (
    <div className="order-last basis-full space-y-2">
      {canAct && stage?.kind === "work" && (
        <Button
          type="button"
          size="sm"
          className="text-xs"
          onClick={() => setMode("advance")}
        >
          {advanceLabel(next)}
        </Button>
      )}
      {canAct && stage?.kind === "review" && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            className="text-xs"
            onClick={() => setMode("approve")}
          >
            Aprobar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => setMode("reject")}
          >
            Rechazar
          </Button>
        </div>
      )}

      {tests.length > 0 && (
        <ol aria-label="Registro de revisiones" className="space-y-1.5 text-xs">
          {tests.map((test) => (
            <li
              key={test.id}
              className="rounded-lg bg-card px-3 py-2 shadow-soft"
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-semibold">Revisión {test.round}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 font-medium",
                    test.result === "aprobada" &&
                      "bg-success-soft text-success",
                    test.result === "rechazada" &&
                      "bg-destructive/10 text-destructive",
                    !test.result &&
                      "bg-info-soft text-info",
                  )}
                >
                  {test.result === "aprobada"
                    ? "Aprobada"
                    : test.result === "rechazada"
                      ? "Rechazada"
                      : "En curso"}
                </span>
              </div>
              <p className="text-muted-foreground">
                Enviada {formatDate(test.sentAt)}
                {personName(test.sentBy) && ` por ${personName(test.sentBy)}`}
                {test.sentNotes && ` — ${test.sentNotes}`}
              </p>
              {test.photoName && (
                <SampleTestPhoto
                  orderId={orderId}
                  taskId={task.id}
                  test={test}
                />
              )}
              {test.result && (
                <p className="text-muted-foreground">
                  {test.result === "aprobada" ? "Aprobada" : "Rechazada"}{" "}
                  {formatDate(test.decidedAt)}
                  {personName(test.decidedBy) &&
                    ` por ${personName(test.decidedBy)}`}
                  {test.resultNotes && ` — ${test.resultNotes}`}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}

      {stage && (
        <StageDialog
          orderId={orderId}
          taskId={task.id}
          area={task.area}
          stage={stage}
          mode={mode}
          onClose={() => setMode(null)}
        />
      )}
    </div>
  );
}

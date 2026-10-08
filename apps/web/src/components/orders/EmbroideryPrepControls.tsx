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
  EmbroideryPrepDialog,
  type PrepDialogMode,
} from "@/components/orders/EmbroideryPrepDialog";
import { useSampleTestPhoto } from "@/hooks/useAreaTasks";
import { cn } from "@/lib/utils";
import type { AreaTaskSampleTest, OrderAreaTask } from "@/types";

/** Etiqueta y color del chip de una tarea de Bordado en digitalización/pruebas. */
export const PREP_STAGE_META = {
  digitalizado: {
    label: "Digitalizado",
    classes: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  en_pruebas: {
    label: "En pruebas",
    classes: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
} as const;

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
            <DialogTitle>Foto de la prueba {test.round}</DialogTitle>
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
              alt={`Prueba ${test.round}`}
              className="max-h-[70vh] w-full rounded-lg object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

interface EmbroideryPrepControlsProps {
  orderId: number;
  task: OrderAreaTask;
  /** Quien trabaja Bordado (o Recepción/admin) puede mover las etapas. */
  canAct: boolean;
}

/**
 * Acciones de las etapas previas a producción de Bordado (digitalizado →
 * pruebas → producción) y el registro de las rondas de prueba.
 */
export function EmbroideryPrepControls({
  orderId,
  task,
  canAct,
}: EmbroideryPrepControlsProps) {
  const [mode, setMode] = useState<PrepDialogMode | null>(null);
  const tests: AreaTaskSampleTest[] = task.sampleTests ?? [];
  if (!task.prepStage && tests.length === 0) return null;

  return (
    <div className="order-last basis-full space-y-2">
      {canAct && task.prepStage === "digitalizado" && (
        <Button
          type="button"
          size="sm"
          className="text-xs"
          onClick={() => setMode("send")}
        >
          Mandar a pruebas
        </Button>
      )}
      {canAct && task.prepStage === "en_pruebas" && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            className="text-xs"
            onClick={() => setMode("approve")}
          >
            Aprobar prueba
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => setMode("reject")}
          >
            Rechazar prueba
          </Button>
        </div>
      )}

      {tests.length > 0 && (
        <ol aria-label="Registro de pruebas" className="space-y-1.5 text-xs">
          {tests.map((test) => (
            <li
              key={test.id}
              className="rounded-lg bg-card px-3 py-2 shadow-soft"
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-semibold">Prueba {test.round}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 font-medium",
                    test.result === "aprobada" &&
                      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                    test.result === "rechazada" &&
                      "bg-red-500/10 text-red-700 dark:text-red-300",
                    !test.result &&
                      "bg-sky-500/10 text-sky-700 dark:text-sky-300",
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

      <EmbroideryPrepDialog
        orderId={orderId}
        taskId={task.id}
        mode={mode}
        onClose={() => setMode(null)}
      />
    </div>
  );
}

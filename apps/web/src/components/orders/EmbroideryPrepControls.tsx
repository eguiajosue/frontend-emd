"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Camera, ImageIcon, Loader2, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CameraCaptureButton } from "@/components/ui/camera-capture-button";
import { useAreaTasks, useSampleTestPhoto } from "@/hooks/useAreaTasks";
import { normalizeImageFile, readFileAsUploadInput } from "@/lib/fileInput";
import { getErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  AreaTaskSampleTest,
  OrderAreaTask,
  SampleTestResult,
} from "@/types";

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

type DialogMode = "send" | "approve" | "reject";

const DIALOG_COPY: Record<
  DialogMode,
  {
    title: string;
    description: string;
    confirm: string;
    required: boolean;
    placeholder: string;
  }
> = {
  send: {
    title: "Mandar a pruebas",
    description:
      "Se abre una ronda nueva en el registro de pruebas de este pedido.",
    confirm: "Mandar a pruebas",
    required: false,
    placeholder:
      "Qué se corrigió o con qué parámetros se hace la prueba (opcional)",
  },
  approve: {
    title: "Aprobar la prueba",
    description: "La tarea queda lista para que Bordado empiece la producción.",
    confirm: "Aprobar prueba",
    required: false,
    placeholder: "Observaciones (opcional)",
  },
  reject: {
    title: "Rechazar la prueba",
    description:
      "La tarea regresa a digitalizado para corregirse y volver a pruebas.",
    confirm: "Rechazar prueba",
    required: true,
    placeholder: "Qué hay que corregir",
  },
};

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
  const { sendToTest, decideTest } = useAreaTasks(orderId);
  const [mode, setMode] = useState<DialogMode | null>(null);
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // Vista previa local de la foto elegida; se libera al cambiarla o cerrar.
  useEffect(() => {
    if (!photo) {
      setPhotoUrl(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const tests: AreaTaskSampleTest[] = task.sampleTests ?? [];
  const pending = sendToTest.isPending || decideTest.isPending;
  if (!task.prepStage && tests.length === 0) return null;

  const close = () => {
    setMode(null);
    setNotes("");
    setPhoto(null);
  };

  const handlePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    if (!picked) return;
    if (!picked.type.startsWith("image/")) {
      toast.error("La foto debe ser una imagen.");
      return;
    }
    // Las fotos del celular pesan varios MB: se reducen a un JPEG liviano.
    const normalized = await normalizeImageFile(picked);
    if (!normalized) {
      toast.error("No se pudo leer esa foto. Prueba con otra.");
      return;
    }
    setPhoto(normalized);
  };

  const submit = async () => {
    if (!mode) return;
    const text = notes.trim();
    if (DIALOG_COPY[mode].required && !text) return;
    try {
      if (mode === "send") {
        await sendToTest.mutateAsync({
          taskId: task.id,
          notes: text || undefined,
          photo: photo ? await readFileAsUploadInput(photo) : undefined,
        });
        toast.success("Enviado a pruebas");
      } else {
        const result: SampleTestResult =
          mode === "approve" ? "aprobada" : "rechazada";
        await decideTest.mutateAsync({
          taskId: task.id,
          result,
          notes: text || undefined,
        });
        toast.success(
          mode === "approve"
            ? "Prueba aprobada: ya puede producir"
            : "Prueba rechazada: vuelve a digitalizado",
        );
      }
      close();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const copy = mode ? DIALOG_COPY[mode] : null;

  return (
    <div className="order-last basis-full space-y-2">
      {canAct && task.prepStage === "digitalizado" && (
        <Button
          type="button"
          size="sm"
          className="text-xs"
          disabled={pending}
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
            disabled={pending}
            onClick={() => setMode("approve")}
          >
            Aprobar prueba
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-xs"
            disabled={pending}
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

      <Dialog open={mode !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy?.title}</DialogTitle>
            <DialogDescription>{copy?.description}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder={copy?.placeholder}
            aria-label="Observaciones"
          />
          {mode === "send" && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Foto de la prueba (opcional)
              </p>
              {photoUrl && (
                <div className="relative w-fit">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoUrl}
                    alt="Vista previa de la prueba"
                    className="max-h-48 rounded-lg border"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="absolute right-1 top-1 h-7 w-7 rounded-full"
                    aria-label="Quitar foto"
                    onClick={() => setPhoto(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <CameraCaptureButton onChange={handlePhoto} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  asChild
                >
                  <label className="cursor-pointer">
                    <Paperclip className="h-4 w-4" />
                    Elegir de la galería
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhoto}
                    />
                  </label>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                <Camera className="mr-1 inline h-3 w-3" aria-hidden />
                Recepción la ve para revisar y autorizar la prueba.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={close}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant={mode === "reject" ? "destructive" : "default"}
              disabled={pending || (!!copy?.required && !notes.trim())}
              onClick={submit}
            >
              {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {copy?.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

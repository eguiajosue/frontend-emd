"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { Camera, Loader2, Paperclip, X } from "lucide-react";
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
import { useAreaTasks } from "@/hooks/useAreaTasks";
import { normalizeImageFile, readFileAsUploadInput } from "@/lib/fileInput";
import { getErrorMessage } from "@/lib/api";
import { advanceLabel, stageNeighbors } from "@/lib/stageBoard";
import type { AreaStage, SampleTestResult } from "@/types";

export type StageDialogMode = "advance" | "approve" | "reject";

interface DialogCopy {
  title: string;
  description: string;
  confirm: string;
  required: boolean;
  placeholder: string;
  /** Si pide observaciones (y foto, al abrir una revisión). */
  askNotes: boolean;
  askPhoto: boolean;
}

/** Textos del diálogo según la acción y las etapas vecinas de la tarea. */
function dialogCopy(
  mode: StageDialogMode,
  stage: AreaStage,
  next: AreaStage | null,
  previous: AreaStage | null,
): DialogCopy {
  if (mode === "advance") {
    const review = next?.kind === "review";
    return {
      title: advanceLabel(next),
      description: review
        ? "Se abre una ronda nueva en el registro de revisiones de este pedido."
        : next
          ? `La tarea pasa de «${stage.name}» a «${next.name}».`
          : `Se completa «${stage.name}» y la tarea queda lista para que el área empiece la producción.`,
      confirm: advanceLabel(next),
      required: false,
      placeholder: "Qué se corrigió o con qué parámetros se hace (opcional)",
      askNotes: review,
      askPhoto: review,
    };
  }
  if (mode === "approve") {
    return {
      title: `Aprobar «${stage.name}»`,
      description: next
        ? `La tarea pasa a «${next.name}».`
        : "La tarea queda lista para que el área empiece la producción.",
      confirm: "Aprobar",
      required: false,
      placeholder: "Observaciones (opcional)",
      askNotes: true,
      askPhoto: false,
    };
  }
  return {
    title: `Rechazar «${stage.name}»`,
    description: previous
      ? `La tarea regresa a «${previous.name}» para corregirse y volver a revisión.`
      : "La tarea regresa a la etapa anterior para corregirse.",
    confirm: "Rechazar",
    required: true,
    placeholder: "Qué hay que corregir",
    askNotes: true,
    askPhoto: false,
  };
}

interface StageDialogProps {
  orderId: number;
  taskId: number;
  area: string;
  /** Etapa en la que está la tarea. */
  stage: AreaStage;
  /** null = cerrado. */
  mode: StageDialogMode | null;
  onClose: () => void;
}

/**
 * Diálogo de las acciones de las etapas previas: pasar a la siguiente (con
 * foto y notas si es una revisión), aprobar y rechazar (con el motivo
 * obligatorio). Lo comparten el detalle del pedido, las tarjetas de Tareas y
 * el Modo TV.
 */
export function StageDialog({
  orderId,
  taskId,
  area,
  stage,
  mode,
  onClose,
}: StageDialogProps) {
  const { advanceStage, decideStage } = useAreaTasks(orderId);
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const { next, previous } = stageNeighbors(area, stage);

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

  const pending = advanceStage.isPending || decideStage.isPending;

  const close = () => {
    setNotes("");
    setPhoto(null);
    onClose();
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
    if (copy?.required && !text) return;
    try {
      if (mode === "advance") {
        await advanceStage.mutateAsync({
          taskId,
          notes: text || undefined,
          photo: photo ? await readFileAsUploadInput(photo) : undefined,
        });
        toast.success(
          next ? `Pasó a «${next.name}»` : "Lista para producir",
        );
      } else {
        const result: SampleTestResult =
          mode === "approve" ? "aprobada" : "rechazada";
        await decideStage.mutateAsync({
          taskId,
          result,
          notes: text || undefined,
        });
        toast.success(
          mode === "approve"
            ? next
              ? `«${stage.name}» aprobada: pasa a «${next.name}»`
              : `«${stage.name}» aprobada: ya puede producir`
            : previous
              ? `«${stage.name}» rechazada: vuelve a «${previous.name}»`
              : `«${stage.name}» rechazada`,
        );
      }
      close();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const copy = mode ? dialogCopy(mode, stage, next, previous) : null;

  return (
    <Dialog open={mode !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy?.title}</DialogTitle>
          <DialogDescription>{copy?.description}</DialogDescription>
        </DialogHeader>
        {copy?.askNotes && (
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder={copy.placeholder}
            aria-label="Observaciones"
          />
        )}
        {copy?.askPhoto && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Foto para la revisión (opcional)</p>
            {photoUrl && (
              <div className="relative w-fit">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrl}
                  alt="Vista previa de la foto"
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
              Recepción la ve para revisar y autorizar.
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
  );
}

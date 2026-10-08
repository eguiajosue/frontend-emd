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
import type { SampleTestResult } from "@/types";

export type PrepDialogMode = "send" | "approve" | "reject";

const DIALOG_COPY: Record<
  PrepDialogMode,
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

interface EmbroideryPrepDialogProps {
  orderId: number;
  taskId: number;
  /** null = cerrado. */
  mode: PrepDialogMode | null;
  onClose: () => void;
}

/**
 * Diálogo de las tres acciones de las etapas previas de Bordado: mandar a
 * pruebas (con foto y notas), aprobar y rechazar (con el motivo obligatorio).
 * Lo comparten el detalle del pedido, las tarjetas de Tareas y el Modo TV.
 */
export function EmbroideryPrepDialog({
  orderId,
  taskId,
  mode,
  onClose,
}: EmbroideryPrepDialogProps) {
  const { sendToTest, decideTest } = useAreaTasks(orderId);
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

  const pending = sendToTest.isPending || decideTest.isPending;

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
    if (DIALOG_COPY[mode].required && !text) return;
    try {
      if (mode === "send") {
        await sendToTest.mutateAsync({
          taskId,
          notes: text || undefined,
          photo: photo ? await readFileAsUploadInput(photo) : undefined,
        });
        toast.success("Enviado a pruebas");
      } else {
        const result: SampleTestResult =
          mode === "approve" ? "aprobada" : "rechazada";
        await decideTest.mutateAsync({
          taskId,
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
            <p className="text-sm font-medium">Foto de la prueba (opcional)</p>
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
  );
}

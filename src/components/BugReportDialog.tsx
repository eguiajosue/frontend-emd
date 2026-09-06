"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { request } from "@/lib/api";
import { useAuthToken } from "@/hooks/useEntity";

const MIN_DESCRIPTION_LENGTH = 10;

/**
 * Formulario "Reportar un error", accesible para todos los roles.
 * El backend completa usuario y fecha; acá sólo se manda la descripción.
 */
export function BugReportDialog() {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const token = useAuthToken();

  const mutation = useMutation({
    mutationFn: () =>
      request<{ success: boolean }>("bug-reports", {
        method: "POST",
        token,
        body: { description },
      }),
    onSuccess: () => {
      toast.success("Reporte enviado, gracias");
      setDescription("");
      setOpen(false);
    },
    // El toast de error (incluido el mensaje del backend, ej. servicio de
    // email no configurado todavía) lo dispara el manejo global de
    // mutaciones en providers.tsx.
  });

  const isValid = description.trim().length >= MIN_DESCRIPTION_LENGTH;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setDescription("");
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" className="w-full justify-start gap-2">
          <Bug className="h-4 w-4" />
          Reportar un error
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reportar un error</DialogTitle>
          <DialogDescription>
            Contanos qué pasó. Tu usuario y la fecha se agregan automáticamente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Textarea
            placeholder="Describí el problema (mínimo 10 caracteres)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!isValid || mutation.isPending}
          >
            {mutation.isPending ? "Enviando..." : "Enviar reporte"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

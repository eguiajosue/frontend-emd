"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Bug, Loader2 } from "lucide-react";
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
import { FormField } from "@/components/ui/form-field";
import { request } from "@/lib/api";
import { useAuthToken } from "@/hooks/useEntity";
import { useMotionPreset } from "@/lib/motion";

const MIN_DESCRIPTION_LENGTH = 10;

/**
 * Formulario "Reportar un error", accesible para todos los roles.
 * El backend completa usuario y fecha; acá sólo se manda la descripción.
 */
export function BugReportDialog() {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [touched, setTouched] = useState(false);
  const token = useAuthToken();
  const { formButtonMotion } = useMotionPreset();

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
  const remaining = MIN_DESCRIPTION_LENGTH - description.trim().length;
  const error = touched && !isValid ? `Faltan ${Math.max(remaining, 0)} caracteres` : undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setDescription("");
          setTouched(false);
        }
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
        <FormField
          htmlFor="bug-description"
          error={error}
          hint={!error ? "Mínimo 10 caracteres" : undefined}
        >
          <Textarea
            id="bug-description"
            placeholder="Describí el problema (mínimo 10 caracteres)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => setTouched(true)}
            rows={5}
            autoFocus
            className="focus-visible:ring-0 focus-visible:border-primary transition-colors"
          />
        </FormField>
        <DialogFooter>
          <motion.div {...(mutation.isPending ? {} : formButtonMotion)}>
            <Button
              onClick={() => {
                setTouched(true);
                if (isValid) mutation.mutate();
              }}
              disabled={!isValid || mutation.isPending}
            >
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {mutation.isPending ? "Enviando..." : "Enviar reporte"}
            </Button>
          </motion.div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

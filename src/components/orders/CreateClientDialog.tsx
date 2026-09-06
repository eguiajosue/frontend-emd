"use client";

import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useEntityMutations } from "@/hooks/useEntity";
import type { Client, CreateClientPayload } from "@/types";

const quickClientSchema = z.object({
  first_name: z.string().min(1, "El nombre es requerido"),
  last_name: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
});

interface CreateClientDialogProps {
  open: boolean;
  onClose: () => void;
  /** Se llama con el cliente recién creado, para auto-seleccionarlo en el formulario de pedido. */
  onCreated: (client: Client) => void;
}

/**
 * Alta rápida de cliente sin salir del formulario de pedido. Sólo pide
 * `first_name` (único campo obligatorio en el backend); el resto es opcional.
 */
export function CreateClientDialog({ open, onClose, onCreated }: CreateClientDialogProps) {
  const { create } = useEntityMutations<Client, CreateClientPayload>("clients");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setFirstName("");
    setLastName("");
    setPhone("");
    setEmail("");
    setErrors({});
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    const parsed = quickClientSchema.safeParse({
      first_name: firstName,
      last_name: lastName,
      phone,
      email,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        fieldErrors[String(issue.path[0])] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const client = await create({
        first_name: parsed.data.first_name,
        last_name: parsed.data.last_name || undefined,
        phone: parsed.data.phone || undefined,
        email: parsed.data.email || undefined,
      });
      toast.success("Cliente creado correctamente");
      onCreated(client);
      reset();
      onClose();
    } catch {
      // El toast de error lo dispara el manejo global de mutaciones.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>
              Nombre <span className="text-destructive">*</span>
            </Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus />
            {errors.first_name && (
              <p className="text-sm text-destructive">{errors.first_name}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Apellido</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Teléfono</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Guardando..." : "Crear cliente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

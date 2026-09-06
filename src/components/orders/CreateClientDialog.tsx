"use client";

import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { User, Phone, Mail, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { useEntityMutations } from "@/hooks/useEntity";
import { useMotionPreset } from "@/lib/motion";
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
  const { formButtonMotion } = useMotionPreset();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  const validate = (values: { first_name: string; last_name: string; phone: string; email: string }) => {
    const parsed = quickClientSchema.safeParse(values);
    const fieldErrors: Record<string, string> = {};
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        fieldErrors[String(issue.path[0])] = issue.message;
      });
    }
    return fieldErrors;
  };

  const reset = () => {
    setFirstName("");
    setLastName("");
    setPhone("");
    setEmail("");
    setErrors({});
    setTouched({});
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const liveErrors = validate({ first_name: firstName, last_name: lastName, phone, email });

  const handleSubmit = async () => {
    setTouched({ first_name: true, last_name: true, phone: true, email: true });
    if (Object.keys(liveErrors).length > 0) {
      setErrors(liveErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const client = await create({
        first_name: firstName.trim(),
        last_name: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
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

  const err = (field: string) => (touched[field] || errors[field] ? errors[field] || liveErrors[field] : undefined);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <FormField label="Nombre" htmlFor="cc-first-name" icon={User} required error={err("first_name")}>
            <Input
              id="cc-first-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, first_name: true }))}
              autoFocus
              className="focus-visible:ring-0 focus-visible:border-primary transition-colors"
            />
          </FormField>
          <FormField label="Apellido" htmlFor="cc-last-name" icon={User}>
            <Input
              id="cc-last-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="focus-visible:ring-0 focus-visible:border-primary transition-colors"
            />
          </FormField>
          <FormField label="Teléfono" htmlFor="cc-phone" icon={Phone}>
            <Input
              id="cc-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="focus-visible:ring-0 focus-visible:border-primary transition-colors"
            />
          </FormField>
          <FormField label="Email" htmlFor="cc-email" icon={Mail} error={err("email")}>
            <Input
              id="cc-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              className="focus-visible:ring-0 focus-visible:border-primary transition-colors"
            />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <motion.div {...(submitting ? {} : formButtonMotion)}>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Guardando..." : "Crear cliente"}
            </Button>
          </motion.div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

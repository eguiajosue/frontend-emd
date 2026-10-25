import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mensaje de validación bajo un campo. Pensado para vincularse con
 * `aria-describedby={fieldErrorId(id)}` y `aria-invalid` en el control.
 * No renderiza nada sin mensaje (no reserva altura ni ensucia el DOM).
 */
export function fieldErrorId(fieldId: string): string {
  return `${fieldId}-error`;
}

export function FieldError({
  id,
  message,
  className,
}: {
  /** Id del campo (el mensaje queda con id `${id}-error`). */
  id?: string;
  message?: string | null;
  className?: string;
}) {
  if (!message) return null;
  return (
    <p
      id={id ? fieldErrorId(id) : undefined}
      role="alert"
      className={cn("flex items-start gap-1 text-xs font-medium text-destructive", className)}
    >
      <AlertCircle className="mt-px size-3 shrink-0" aria-hidden />
      <span>{message}</span>
    </p>
  );
}

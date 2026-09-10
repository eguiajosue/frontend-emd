"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Check, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMotionPreset } from "@/lib/motion";

/**
 * Wrapper visual compartido para campos de formulario en toda la app.
 *
 * Da un lenguaje visual único: label con icono opcional, anillo de foco
 * animado con spring (en vez de un simple :focus de Tailwind), y feedback de
 * validación inline (borde rojo + icono + mensaje) que aparece mientras el
 * usuario escribe/al perder foco, no sólo al enviar el formulario.
 *
 * El input/select/textarea real se pasa como children; este componente sólo
 * agrega el contenedor con el anillo animado (vía onFocus/onBlur en el
 * wrapper, que funciona para cualquier control nativo o de shadcn/ui).
 */
interface FormFieldProps {
  label?: React.ReactNode;
  htmlFor?: string;
  icon?: LucideIcon;
  required?: boolean;
  error?: string;
  success?: boolean;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function FormField({
  label,
  htmlFor,
  icon: Icon,
  required,
  error,
  success,
  hint,
  className,
  children,
}: FormFieldProps) {
  const [focused, setFocused] = React.useState(false);
  const { reduced } = useMotionPreset();

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="flex items-center gap-1.5 text-sm font-medium text-foreground"
        >
          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
          {label}
          {required && <span className="text-destructive">*</span>}
        </label>
      )}
      <motion.div
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={() => setFocused(false)}
        animate={
          reduced
            ? undefined
            : {
                boxShadow: error
                  ? "0 0 0 3px hsl(var(--destructive) / 0.18)"
                  : focused
                  ? "0 0 0 3px hsl(var(--ring) / 0.25)"
                  : "0 0 0 0px hsl(var(--ring) / 0)",
              }
        }
        transition={{ type: "spring", bounce: 0, duration: 0.22 }}
        className={cn(
          "rounded-lg transition-colors",
          error && "ring-1 ring-destructive/60 rounded-lg"
        )}
      >
        {children}
      </motion.div>
      <AnimatePresence mode="wait" initial={false}>
        {error ? (
          <motion.p
            key="error"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-1 text-xs font-medium text-destructive"
          >
            <AlertCircle className="h-3 w-3 shrink-0" />
            {error}
          </motion.p>
        ) : success ? (
          <motion.p
            key="success"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"
          >
            <Check className="h-3 w-3 shrink-0" />
            Correcto
          </motion.p>
        ) : hint ? (
          <p key="hint" className="text-xs text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** Encabezado de sección para formularios largos (agrupa campos con icono + título + separador). */
export function FormSection({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="relative flex items-center gap-3 pb-3">
        {/* Barra de acento: da jerarquía sin depender sólo del borde inferior. */}
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-primary/40 via-border to-transparent"
        />
        {Icon && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
            <Icon className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-none tracking-tight text-foreground">
            {title}
          </h3>
          {description && (
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

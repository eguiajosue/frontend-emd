"use client";

import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ImageUp, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBranchLogoMutations } from "@/hooks/useBranchLogos";
import { getErrorMessage } from "@/lib/api";
import { checkLogoFile, LOGO_ACCEPT_ATTR, LOGO_MAX_BYTES, type LogoVariantKey } from "@/lib/branchLogoFile";
import { cn } from "@/lib/utils";

interface BranchLogoUploaderProps {
  branchId: number;
  branchName: string;
  variant: LogoVariantKey;
  /** Logo actual (data URL) o `null`. */
  current: string | null;
  /**
   * La sucursal tiene este logo cargado (`hasLogoOn…` de GET /branches) aunque
   * no venga su imagen: `GET /branches/logos` sólo trae sucursales activas.
   */
  hasLogo?: boolean;
}

const COPY: Record<LogoVariantKey, { title: string; hint: string; previewClass: string }> = {
  onLight: {
    title: "Logo para fondos claros (negro)",
    hint: "Se usa en la interfaz clara, hojas impresas y PDF.",
    previewClass: "bg-white border-neutral-200",
  },
  onDark: {
    title: "Logo para fondos oscuros (blanco)",
    hint: "Se usa en el tema oscuro y en el Modo TV. Mejor con fondo transparente.",
    previewClass: "bg-neutral-900 border-neutral-700",
  },
};

/** Cargador de UNA variante del logo de una sucursal, con vista previa sobre el fondo que le toca. */
export function BranchLogoUploader({ branchId, branchName, variant, current, hasLogo = false }: BranchLogoUploaderProps) {
  const { upload, remove } = useBranchLogoMutations();
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const copy = COPY[variant];
  const loaded = Boolean(current) || hasLogo;
  const busy = checking || upload.isPending || remove.isPending;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setWarning(null);
    setChecking(true);
    try {
      const check = await checkLogoFile(file, variant);
      if (!check.ok) {
        setError(check.error);
        return;
      }
      try {
        await upload.mutateAsync({ branchId, variant, imageDataUrl: check.dataUrl });
        setWarning(check.warning);
        toast.success(`Logo de ${branchName} actualizado`);
      } catch (e) {
        setError(getErrorMessage(e, "No se pudo subir el logo"));
      }
    } finally {
      setChecking(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onRemove = async () => {
    setError(null);
    setWarning(null);
    try {
      await remove.mutateAsync({ branchId, variant });
      toast.success("Logo quitado");
    } catch (e) {
      setError(getErrorMessage(e, "No se pudo quitar el logo"));
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-border/60 p-3" data-testid={`logo-uploader-${branchId}-${variant}`}>
      <div>
        <p className="text-sm font-medium">{copy.title}</p>
        <p className="text-meta">{copy.hint}</p>
      </div>

      <div
        className={cn("flex h-20 items-center justify-center rounded-lg border p-2", copy.previewClass)}
        data-testid={`logo-preview-${variant}`}
      >
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current} alt={`Logo de ${branchName} (${variant === "onLight" ? "fondos claros" : "fondos oscuros"})`} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className={cn("text-xs", variant === "onDark" ? "text-neutral-400" : "text-neutral-500")}>
            {hasLogo ? "Logo cargado (sin vista previa)" : "Sin logo"}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={LOGO_ACCEPT_ATTR}
          className="sr-only"
          aria-label={`${copy.title} de ${branchName}`}
          disabled={busy}
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()} className="gap-1.5">
          {busy && !remove.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}
          {loaded ? "Reemplazar" : "Subir logo"}
        </Button>
        {loaded && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => void onRemove()}
            aria-label={`Quitar ${copy.title.toLowerCase()} de ${branchName}`}
            className="gap-1.5 text-muted-foreground"
          >
            {remove.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Quitar
          </Button>
        )}
        <span className="ml-auto text-meta">PNG, JPEG o WebP · máx. {LOGO_MAX_BYTES / 1024} KB · 2000×2000 px</span>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {warning && (
        <p role="status" className="flex items-start gap-1.5 text-sm text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {warning}
        </p>
      )}
    </div>
  );
}

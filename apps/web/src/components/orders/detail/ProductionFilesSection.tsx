"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Download, FileArchive, Loader2, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ConfirmDeleteDialog } from "@/components/crud/ConfirmDeleteDialog";
import { DetailSection } from "@/components/orders/detail/DetailSection";
import { getErrorMessage } from "@/lib/api";
import { useAuthToken } from "@/hooks/useEntity";
import { UploadCancelledError } from "@/lib/multipartUpload";
import {
  formatBytes,
  PRODUCTION_FILE_ACCEPT,
  PRODUCTION_FILE_MAX_BYTES,
  startProductionDownload,
  useDeleteProductionFile,
  useProductionFiles,
  useUploadProductionFile,
  type ProductionFile,
} from "@/hooks/useProductionFiles";
import type { Order } from "@/types";

/**
 * Archivo final para producción (zip/eps/svg/dxf/imágenes, hasta 5 GB).
 * Diseño (y Recepción/admin) lo sube; Impresiones, Láser y demás áreas lo
 * descargan. Si no hay archivos y el usuario no puede subir, no se muestra.
 */
export function ProductionFilesSection({ order, canUpload }: { order: Order; canUpload: boolean }) {
  const token = useAuthToken();
  const { files, isLoading } = useProductionFiles(order.id);
  const upload = useUploadProductionFile(order.id);
  const remove = useDeleteProductionFile(order.id);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<{ name: string; loaded: number; total: number } | null>(null);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<ProductionFile | null>(null);
  const uploading = upload.isPending;

  // Subiendo un archivo grande, cerrar la pestaña lo cancelaría a medias.
  useEffect(() => {
    if (!uploading) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [uploading]);

  if (!canUpload && !isLoading && files.length === 0) return null;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > PRODUCTION_FILE_MAX_BYTES) {
      toast.error(`El archivo pesa ${formatBytes(file.size)}; el máximo es ${formatBytes(PRODUCTION_FILE_MAX_BYTES)}.`);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setProgress({ name: file.name, loaded: 0, total: file.size });
    try {
      await upload.mutateAsync({
        file,
        signal: controller.signal,
        onProgress: ({ loaded, total }) => setProgress({ name: file.name, loaded, total }),
      });
      toast.success(`Archivo de producción subido: ${file.name}`);
    } catch (error) {
      if (error instanceof UploadCancelledError) toast.info("Subida cancelada");
      else toast.error(getErrorMessage(error, "No se pudo subir el archivo. Intenta de nuevo."));
    } finally {
      abortRef.current = null;
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const download = async (file: ProductionFile) => {
    setDownloading(file.id);
    try {
      await startProductionDownload(token, order.id, file.id);
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo iniciar la descarga."));
    } finally {
      setDownloading(null);
    }
  };

  const confirmDelete = async () => {
    const target = deleting;
    if (!target) return;
    setDeleting(null);
    try {
      await remove.mutateAsync(target.id);
      toast.success("Archivo eliminado");
    } catch {
      // El aviso de error lo muestra el manejo global de mutaciones.
    }
  };

  const percent = progress && progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : 0;

  return (
    <>
      <DetailSection
        id="order-section-production-files"
        title="Archivo para producción"
        action={
          canUpload ? (
            <>
              <input
                ref={inputRef}
                type="file"
                accept={PRODUCTION_FILE_ACCEPT}
                className="sr-only"
                aria-label="Seleccionar archivo para producción"
                onChange={(event) => void pick(event.target.files?.[0])}
              />
              <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
                {uploading ? <Loader2 className="animate-spin" /> : <Upload />} Subir archivo
              </Button>
            </>
          ) : undefined
        }
      >
        {progress && (
          <div className="mb-4 space-y-2 rounded-xl bg-muted/50 p-3" role="status" aria-live="polite">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate font-medium">{progress.name}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => abortRef.current?.abort()}>
                <X /> Cancelar
              </Button>
            </div>
            <Progress value={percent} />
            <p className="text-xs text-muted-foreground">
              {formatBytes(progress.loaded)} de {formatBytes(progress.total)} ({percent}%). No cierres esta pestaña
              hasta que termine.
            </p>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : files.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin archivo todavía. Formatos: ZIP, EPS, SVG, DXF, AI, PDF, JPG y PNG (hasta {formatBytes(PRODUCTION_FILE_MAX_BYTES)}).
          </p>
        ) : (
          <ul className="space-y-2" aria-label="Archivos para producción">
            {files.map((file, index) => (
              <li key={file.id} className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
                <FileArchive className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    v{file.version}
                    {index === 0 && files.length > 1 ? " (última)" : ""} · {formatBytes(file.sizeBytes)}
                    {file.completedAt ? ` · ${format(new Date(file.completedAt), "d MMM, HH:mm", { locale: es })}` : ""}
                  </p>
                  {file.notes && <p className="mt-1 text-xs">{file.notes}</p>}
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={downloading === file.id}
                  onClick={() => void download(file)}
                  aria-label={`Descargar ${file.fileName}`}
                >
                  {downloading === file.id ? <Loader2 className="animate-spin" /> : <Download />} Descargar
                </Button>
                {canUpload && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleting(file)}
                    aria-label={`Eliminar ${file.fileName}`}
                  >
                    <Trash2 />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </DetailSection>

      <ConfirmDeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={confirmDelete}
        title="¿Eliminar este archivo?"
        description="Se borra del almacenamiento y producción ya no podrá descargarlo. Esta acción no se puede deshacer."
      />
    </>
  );
}

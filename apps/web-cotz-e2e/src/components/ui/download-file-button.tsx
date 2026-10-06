"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadFromUrl } from "@/lib/download";

/**
 * Botón "Descargar" sobre una URL ya disponible (`data:` o `blob:`).
 *
 * NO es un `<a download>`: iOS Safari ignora `download` sobre una `data:` URL
 * y corta las largas, así que un montaje de varios MB no se bajaba. Se delega
 * en `downloadFromUrl`, que pasa el contenido a una blob URL propia antes de
 * disparar la descarga — que es lo que Recepción necesita para reenviarle la
 * hoja de autorización al cliente.
 */
export function DownloadFileButton({
  href,
  filename,
  label = "Descargar",
  className,
}: {
  href: string;
  filename: string;
  label?: string;
  className?: string;
}) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleClick = async () => {
    setIsDownloading(true);
    try {
      await downloadFromUrl(href, filename);
    } catch {
      toast.error("No se pudo descargar el archivo.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      disabled={isDownloading}
      aria-label={`Descargar ${filename}`}
      onClick={() => void handleClick()}
    >
      {isDownloading ? (
        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="mr-2 h-3.5 w-3.5" />
      )}
      {label}
    </Button>
  );
}

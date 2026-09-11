"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Botón "Descargar" sobre una URL ya disponible (`data:` o `blob:`). Es un
 * ancla de verdad con `download`, así que el navegador guarda el archivo con
 * su nombre original en vez de abrirlo en una pestaña — que es lo que
 * Recepción necesita para reenviarle la hoja de autorización al cliente.
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
  return (
    <Button variant="outline" size="sm" asChild className={className}>
      <a href={href} download={filename} aria-label={`Descargar ${filename}`}>
        <Download className="mr-2 h-3.5 w-3.5" />
        {label}
      </a>
    </Button>
  );
}

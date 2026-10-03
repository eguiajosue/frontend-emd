"use client";

import { ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PreviewImage } from "@/components/ui/preview-image";
import { cn } from "@/lib/utils";

interface ZoomableImageProps {
  src: string;
  alt: string;
  onZoom: (src: string) => void;
  /** Nombre accesible del botón (por defecto "Ampliar {alt}"). */
  label?: string;
  className?: string;
  imageClassName?: string;
}

/**
 * Miniatura que se amplía al hacer click (montajes, archivo del cliente).
 * Antes eran tres `<button>` a mano con el mismo markup.
 */
export function ZoomableImage({ src, alt, onZoom, label, className, imageClassName }: ZoomableImageProps) {
  return (
    <Button
      type="button"
      variant="bare"
      size="bare"
      onClick={() => onZoom(src)}
      aria-label={label ?? `Ampliar ${alt}`}
      className={cn("group relative overflow-hidden rounded-md border", className)}
    >
      <PreviewImage
        src={src}
        alt={alt}
        loading="lazy"
        className={cn("max-h-48 max-w-full object-contain", imageClassName)}
      />
      <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
        <ZoomIn className="h-5 w-5" aria-hidden />
      </span>
    </Button>
  );
}

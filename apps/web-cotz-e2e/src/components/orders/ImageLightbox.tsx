"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

interface ImageLightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
}

/**
 * Lightbox simple para ampliar un adjunto del pedido cuando es una imagen
 * (los archivos del cliente del alta y el montaje de cada ronda de diseño).
 * Se carga con next/dynamic (ver OrderDetailDialog) porque sólo hace falta
 * cuando el usuario hace click para ampliar.
 */
export default function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  // Escape cierra, como cualquier otra capa de la app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.img
          src={src}
          alt={alt}
          className="max-h-full max-w-full rounded-2xl object-contain shadow-soft-lg"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
        />
        <button
          type="button"
          aria-label="Cerrar imagen"
          onClick={onClose}
          className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top))] flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

"use client";

import { AnimatePresence, motion } from "framer-motion";

interface ImageLightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
}

/**
 * Lightbox simple para ampliar la hoja de autorización cuando es una imagen.
 * Se carga con next/dynamic (ver OrderDetailDialog) porque sólo hace falta
 * cuando el usuario hace click para ampliar.
 */
export default function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
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
          className="max-h-full max-w-full rounded-md object-contain shadow-2xl"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
        />
      </motion.div>
    </AnimatePresence>
  );
}

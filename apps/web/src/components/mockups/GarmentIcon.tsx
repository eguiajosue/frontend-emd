import type { Garment } from "@/lib/mockups/types";
import { cn } from "@/lib/utils";

/**
 * Miniaturas de línea para el selector de prenda (SVG en código: sin
 * imágenes que descargar). Usan `currentColor`.
 */
const PATHS: Record<Garment, string[]> = {
  tshirt: ["M9 4l3 2 3-2 5 3-2 4-2-1v10H8V10l-2 1-2-4z"],
  hoodie: ["M9 4c1 2 5 2 6 0l5 3-2 4-2-1v10H8V10l-2 1-2-4z", "M10 15h4"],
  "dress-shirt": ["M9 4l3 3 3-3 5 3-2 4-2-1v10H8V10l-2 1-2-4z", "M12 7v13"],
  cap: ["M4 15c0-5 3.5-8 8-8s8 3 8 8z", "M4 15c3 0 6 1 9 3h7", "M12 7v-1"],
  termo: ["M7 6h10l-1 15H8z", "M6.5 3.5h11v2.5h-11z", "M10 3.5V2.5h4v1"],
  taza: ["M5 6h11v11a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z", "M16 9h1.5a2.5 2.5 0 0 1 0 5H16"],
};

export function GarmentIcon({ garment, className }: { garment: Garment; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      data-garment-icon={garment}
      className={cn("h-6 w-6", className)}
    >
      {PATHS[garment].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

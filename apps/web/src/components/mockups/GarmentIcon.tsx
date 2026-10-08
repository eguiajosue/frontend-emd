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
  mousepad: ["M4 8.5l2-2h14v9l-2 2H4z", "M18 15.5v-9"],
  car: ["M3 16v-3l2-4.5h10l3.5 4.5H21v3z", "M6.5 8.5l1.2 4.5H16", "M7 16.5a1.8 1.8 0 1 0 .01 0", "M16 16.5a1.8 1.8 0 1 0 .01 0"],
  minivan: ["M2.5 16v-4l3-5h9l5 4.5h2v4.5z", "M9 7.5V13", "M7 16.5a1.8 1.8 0 1 0 .01 0", "M17 16.5a1.8 1.8 0 1 0 .01 0"],
  pickup: ["M2.5 16v-3.5L5 12l2.5-4H12v8", "M12 11h9v5H2.5", "M6 16.5a1.8 1.8 0 1 0 .01 0", "M17.5 16.5a1.8 1.8 0 1 0 .01 0"],
  trailer: ["M10 16V8h11v8", "M2.5 16v-4.5l2-3H10V16z", "M5 16.5a1.6 1.6 0 1 0 .01 0", "M14 16.5a1.6 1.6 0 1 0 .01 0", "M18 16.5a1.6 1.6 0 1 0 .01 0"],
  bicycle: ["M6 17a3.5 3.5 0 1 0 .01 0", "M18 17a3.5 3.5 0 1 0 .01 0", "M6 17l4-7h5l3 7", "M10 10l3 7", "M14 7h2.5"],
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

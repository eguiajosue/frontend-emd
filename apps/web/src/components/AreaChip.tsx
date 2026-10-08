import { getAreaIcon, getAreaLabel } from "@/lib/areas";
import { cn } from "@/lib/utils";

/** Etiqueta de un área con su color de marca (ver `[data-area]` en globals.css). */
export function AreaChip({ area, className, large = false }: { area: string; className?: string; large?: boolean }) {
  const Icon = getAreaIcon(area);
  return (
    <span data-area={area} className={cn("area-chip", large && "px-2.5 py-1 text-sm", className)}>
      {Icon && <Icon className={large ? "h-4 w-4" : "h-3 w-3"} aria-hidden />}
      {getAreaLabel(area)}
    </span>
  );
}

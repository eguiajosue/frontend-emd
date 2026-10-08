import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Logo de EMD marketing & design. En modo oscuro el azul marino del logo pasa a
 * blanco (variante `emd-logo-dark.png`); los tres cuadros de color se mantienen.
 * Ambas imágenes se renderizan y el tema decide cuál se ve, así no hay parpadeo
 * ni desajuste de hidratación.
 */
export function BrandLogo({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <span className={cn("inline-flex shrink-0", className)}>
      <Image
        src="/brand/emd-logo.png"
        alt="EMD marketing & design"
        width={546}
        height={118}
        priority={priority}
        className="h-full w-auto dark:hidden"
      />
      <Image
        src="/brand/emd-logo-dark.png"
        alt="EMD marketing & design"
        width={546}
        height={118}
        priority={priority}
        className="hidden h-full w-auto dark:block"
        aria-hidden
      />
    </span>
  );
}

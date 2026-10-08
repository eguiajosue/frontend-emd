import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // Brillo que recorre el bloque (con un toque de cian y magenta de la
        // marca) en vez de parpadear; con "reducir movimiento" queda quieto.
        "relative overflow-hidden rounded-md bg-muted dark:bg-secondary",
        "before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-[hsl(var(--brand-cyan)/0.18)] before:to-transparent before:content-['']",
        "motion-safe:before:animate-shimmer motion-reduce:before:hidden",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Base: 150ms ease-out, foco visible con anillo (magenta claro / cian oscuro),
  // press = escala .97, deshabilitado sin eventos. En táctil el alto mínimo es 44px.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-[color,background-color,border-color,box-shadow,transform,filter] duration-150 ease-out-expo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /** Acción principal: marino (cian en oscuro). */
        default:
          "bg-primary text-primary-foreground shadow-soft-xs hover:bg-primary/90 hover:shadow-soft",
        /** Acento de marca (magenta EMD): UNA acción estrella por pantalla. */
        brand:
          "bg-accent-gradient text-white shadow-soft-xs hover:shadow-glow-magenta hover:brightness-110",
        destructive:
          "bg-destructive text-destructive-foreground shadow-soft-xs hover:bg-destructive/90",
        outline:
          "border border-input bg-card text-foreground hover:border-primary/40 hover:bg-accent",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        /** Acción secundaria tintada con el primario (marino claro / cian suave). */
        soft:
          "bg-primary/10 text-primary hover:bg-primary/15 dark:bg-primary/15 dark:hover:bg-primary/25",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        /** Ver `BARE_BUTTON_CLASS`: no pasa por las clases base. */
        bare: "",
      },
      size: {
        default: "h-10 px-4 py-2 [@media(pointer:coarse)]:min-h-11",
        sm: "h-9 px-3 text-[0.8125rem] [@media(pointer:coarse)]:min-h-10",
        lg: "h-12 px-6 text-[0.9375rem]",
        icon: "h-10 w-10 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11",
        bare: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/**
 * `variant="bare"`: superficie clicable sin aspecto de botón (celda de
 * calendario, tarjeta entera, miniatura). Mantiene foco visible, teclado y
 * semántica de Button, pero NO hereda las clases base (tamaño forzado de
 * íconos, nowrap, alto fijo): el contenido define cómo se ve.
 */
const BARE_BUTTON_CLASS =
  "rounded-lg text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={
          variant === "bare"
            ? cn(BARE_BUTTON_CLASS, className)
            : cn(buttonVariants({ variant, size, className }))
        }
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

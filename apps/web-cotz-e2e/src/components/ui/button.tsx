import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /** Acción principal: tinta (negro en claro, blanco en oscuro). */
        default:
          "bg-ink text-ink-foreground shadow-sm hover:bg-ink/85",
        /** Acento de marca (magenta EMD), para la acción estrella de una pantalla. */
        brand:
          "bg-gradient-to-r from-primary to-[hsl(345_88%_60%)] text-primary-foreground shadow-sm shadow-primary/25 hover:brightness-105",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-border bg-card hover:bg-muted hover:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        /** Ver `BARE_BUTTON_CLASS`: no pasa por las clases base. */
        bare: "",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-[0.8125rem]",
        lg: "h-11 px-6 text-[0.9375rem]",
        icon: "h-9 w-9",
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
  "rounded-md text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"

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

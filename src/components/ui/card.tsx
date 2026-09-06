import * as React from "react"

import { cn } from "@/lib/utils"

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * "glass" aplica el material translúcido Liquid Glass (peso medio, ver
   * apple-design §12). Úsalo en cards de contenido (dashboard, Ayuda, stats)
   * — evítalo en tablas/listas densas donde la legibilidad manda.
   */
  variant?: "solid" | "glass"
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "solid", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl text-card-foreground shadow-soft transition-shadow duration-200",
        variant === "glass"
          ? "glass-medium border-x border-b border-border/40"
          : "border bg-card",
        className
      )}
      {...props}
    />
  )
)
Card.displayName = "Card"

/** Atajo para <Card variant="glass" />. */
const GlassCard = React.forwardRef<
  HTMLDivElement,
  Omit<CardProps, "variant">
>((props, ref) => <Card ref={ref} variant="glass" {...props} />)
GlassCard.displayName = "GlassCard"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, GlassCard, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }

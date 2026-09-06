"use client"

import { CheckCircle2, AlertTriangle, Info, XCircle, Loader2 } from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

/**
 * Íconos propios por tipo de toast (en vez de los genéricos de sonner), para
 * que éxito/error/info/advertencia se distingan de un vistazo con los mismos
 * tokens de color del sistema — no el verde/rojo default de la librería.
 */
const TOAST_ICONS: ToasterProps["icons"] = {
  success: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  error: <XCircle className="h-4 w-4 text-destructive" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  info: <Info className="h-4 w-4 text-primary" />,
  loading: <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />,
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={TOAST_ICONS}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "group-[.toast]:border-l-2 group-[.toast]:border-l-emerald-500",
          error: "group-[.toast]:border-l-2 group-[.toast]:border-l-destructive",
          warning: "group-[.toast]:border-l-2 group-[.toast]:border-l-amber-500",
          info: "group-[.toast]:border-l-2 group-[.toast]:border-l-primary",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

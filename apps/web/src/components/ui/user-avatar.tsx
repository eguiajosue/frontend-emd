"use client"

import * as React from "react"
import { blobatarUri } from "blobatar/uri"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface UserAvatarProps
  extends Omit<React.ComponentPropsWithoutRef<typeof Avatar>, "children"> {
  /**
   * Cadena de la que sale el blobatar (el `username`: es estable y único, así
   * la misma persona se ve igual en toda la app). Vacía = sólo iniciales.
   */
  seed?: string | null
  /** Iniciales que se muestran mientras carga el blobatar o si no hay semilla. */
  children?: React.ReactNode
  /** Clases del respaldo de iniciales (color de fondo, tamaño de letra…). */
  fallbackClassName?: string
}

/**
 * Avatar de persona: blobatar determinístico generado en el cliente (sin
 * red ni almacenamiento). Las iniciales quedan de respaldo, que es también lo
 * que ven los tests porque jsdom no carga imágenes.
 */
const UserAvatar = React.forwardRef<
  React.ElementRef<typeof Avatar>,
  UserAvatarProps
>(({ seed, children, className, fallbackClassName, ...props }, ref) => {
  const src = React.useMemo(
    () => (seed?.trim() ? blobatarUri(seed) : undefined),
    [seed]
  )

  return (
    <Avatar ref={ref} className={cn("bg-muted", className)} {...props}>
      {src ? <AvatarImage src={src} alt="" /> : null}
      <AvatarFallback className={fallbackClassName}>{children}</AvatarFallback>
    </Avatar>
  )
})
UserAvatar.displayName = "UserAvatar"

export { UserAvatar }

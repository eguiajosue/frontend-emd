"use client"

import * as React from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { avatarDataUri, avatarSeedFor } from "@/lib/avatar"

interface UserAvatarProps {
  user?: { id?: number | string | null; avatarSeed?: string | null } | null
  /** Iniciales que se ven mientras carga la imagen, si falla o si no hay semilla. */
  initials: string
  className?: string
  title?: string
  fallbackClassName?: string
}

/** Avatar generado del usuario; las iniciales quedan de respaldo. */
export function UserAvatar({ user, initials, className, fallbackClassName, title }: UserAvatarProps) {
  const seed = avatarSeedFor(user)
  return (
    <Avatar className={className} title={title}>
      {seed ? <AvatarImage src={avatarDataUri(seed)} alt="" /> : null}
      <AvatarFallback className={fallbackClassName}>{initials}</AvatarFallback>
    </Avatar>
  )
}

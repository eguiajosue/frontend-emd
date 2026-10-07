"use client";

/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text --
   Los logos son data URLs que sube el admin: `next/image` no los optimiza, y el `alt`
   (nombre de la sucursal) viaja en `common`. */

import type { ReactNode } from "react";
import { Store } from "lucide-react";
import { useBranchLogos } from "@/hooks/useBranchLogos";
import { cn } from "@/lib/utils";

/**
 * Fondo sobre el que se dibuja el logo:
 *  - "auto": sigue el tema (claro/oscuro) de la interfaz.
 *  - "light": fondo claro fijo (papel, tickets, PDF): logo NEGRO.
 *  - "dark": fondo oscuro fijo (Modo TV): logo BLANCO.
 */
export type BranchLogoSurface = "auto" | "light" | "dark";
export type BranchLogoSize = "sm" | "md" | "lg" | "xl";

/** Alto fijo por tamaño: el logo (≈4:1) se ajusta con `object-contain`, sin saltos de layout. */
const HEIGHT: Record<BranchLogoSize, string> = {
  sm: "h-5 max-w-[5.5rem]",
  md: "h-6 max-w-[7rem]",
  lg: "h-8 max-w-[9rem]",
  xl: "h-12 max-w-[13rem]",
};

interface BranchLogoProps {
  /** Sucursal de origen; sin ella (pedido de matriz) no se dibuja nada. */
  branchId: number | null | undefined;
  /** Nombre: es el `alt` del logo y el texto del badge cuando no hay logo cargado. */
  name: string | null | undefined;
  surface?: BranchLogoSurface;
  size?: BranchLogoSize;
  className?: string;
  /** `lazy` para listas largas; `eager` donde el logo es lo primero que se ve. */
  loading?: "lazy" | "eager";
}

/** Texto de respaldo: el badge con el nombre de la sucursal (lo de siempre). */
export function BranchNameBadge({
  name,
  surface = "auto",
  className,
}: {
  name: string;
  surface?: BranchLogoSurface;
  className?: string;
}) {
  return (
    <span
      data-testid="branch-badge"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        surface === "dark"
          ? "border-white/25 bg-transparent text-white/90"
          : "border-border/60 bg-card text-foreground",
        className
      )}
    >
      <Store
        className={cn("h-3 w-3", surface === "dark" ? "text-white/70" : "text-muted-foreground")}
        aria-hidden
      />
      {name}
    </span>
  );
}

function BranchLogoImage({ branchId, name, surface = "auto", size = "md", className, loading = "lazy" }: Omit<BranchLogoProps, "branchId" | "name"> & { branchId: number; name: string }) {
  const { getLogos } = useBranchLogos();
  const logos = getLogos(branchId);

  const imgClass = cn("w-auto object-contain object-left", HEIGHT[size]);
  const common = { alt: name, loading, decoding: "async" as const, draggable: false };

  const onLight = logos?.logoOnLight ?? null;
  const onDark = logos?.logoOnDark ?? null;

  // La variante que contrasta con el fondo. Si sólo está la otra, se usa sobre
  // un "chip" del color que sí le contrasta (negro sobre blanco, blanco sobre
  // negro); sin ninguna, cae al badge con el nombre.
  let content: ReactNode = null;
  let variant = "";
  if (surface === "light" && onLight) {
    variant = "light";
    content = <img {...common} src={onLight} className={imgClass} data-variant="light" />;
  } else if (surface === "dark" && onDark) {
    variant = "dark";
    content = <img {...common} src={onDark} className={imgClass} data-variant="dark" />;
  } else if (surface === "auto" && onLight && onDark) {
    variant = "auto";
    content = (
      <>
        {/* Impreso desde el navegador (Ctrl+P) el papel es blanco: siempre el logo claro. */}
        <img {...common} src={onLight} className={cn(imgClass, "dark:hidden print:block")} data-variant="light" />
        <img
          {...common}
          src={onDark}
          alt={name}
          className={cn(imgClass, "hidden dark:block print:hidden")}
          data-variant="dark"
        />
      </>
    );
  } else if (surface === "auto" && onLight) {
    // Sólo hay logo negro: en tema oscuro se pondría sobre un "chip" claro para que se lea.
    variant = "light-chip";
    content = (
      <span className="inline-flex rounded-md dark:bg-white dark:px-1.5 dark:py-0.5">
        <img {...common} src={onLight} className={imgClass} data-variant="light" />
      </span>
    );
  } else if (surface === "auto" && onDark) {
    // Sólo hay logo blanco: en tema claro iría blanco sobre blanco; chip oscuro.
    variant = "dark-chip";
    content = (
      <span className="inline-flex rounded-md bg-neutral-900 px-1.5 py-0.5 dark:bg-transparent dark:px-0 dark:py-0">
        <img {...common} src={onDark} className={imgClass} data-variant="dark" />
      </span>
    );
  } else if (surface === "light" && onDark) {
    variant = "dark-chip";
    content = (
      <span className="inline-flex rounded-md bg-neutral-900 px-1.5 py-0.5">
        <img {...common} src={onDark} className={imgClass} data-variant="dark" />
      </span>
    );
  } else if (surface === "dark" && onLight) {
    variant = "light-chip";
    content = (
      <span className="inline-flex rounded-md bg-white px-1.5 py-0.5">
        <img {...common} src={onLight} className={imgClass} data-variant="light" />
      </span>
    );
  }

  if (!content) return <BranchNameBadge name={name} surface={surface} className={className} />;

  return (
    <span
      data-testid="branch-logo"
      data-surface={surface}
      data-logo-variant={variant}
      className={cn("inline-flex shrink-0 items-center", className)}
    >
      {content}
    </span>
  );
}

/**
 * Logo de la sucursal que levantó el pedido. Se resuelve por `branchId` contra
 * los logos compartidos (`useBranchLogos`: una sola query para toda la app) y
 * cae al badge con el nombre si la sucursal no tiene logo cargado. Con el
 * pedido de la matriz (`branchId` vacío) no dibuja nada ni toca la red.
 */
export function BranchLogo(props: BranchLogoProps) {
  const { branchId, name } = props;
  if (branchId == null || !name) return null;
  return <BranchLogoImage {...props} branchId={branchId} name={name} />;
}

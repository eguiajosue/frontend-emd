"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Search } from "lucide-react";
import { openCommandPalette } from "@/components/CommandPalette";
import { Button } from "@/components/ui/button";
import { useNavGroups } from "@/hooks/useVisibleNavItems";
import { buildBreadcrumbs, type Breadcrumb } from "@/lib/navMenu";

/** Migas de la ruta actual, derivadas del mismo registro que el menú. */
export function useBreadcrumbs(): Breadcrumb[] {
  const pathname = usePathname();
  return buildBreadcrumbs(useNavGroups(), pathname);
}

/**
 * Lado izquierdo de la barra superior: "dónde estoy" (Operación › Pedidos ›
 * #123). Sólo escritorio: en móvil el título grande de cada página ya cumple
 * ese rol y la barra no tiene ancho para las dos cosas.
 */
export function AppBreadcrumbs({ crumbs }: { crumbs: Breadcrumb[] }) {
  if (crumbs.length === 0) return null;
  return (
    <nav aria-label="Ruta" className="hidden min-w-0 md:block">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <Fragment key={`${crumb.label}-${index}`}>
              {index > 0 && (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
              )}
              <li className="min-w-0 truncate">
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    className={isLast ? "font-medium text-foreground" : "text-muted-foreground"}
                    aria-current={isLast ? "page" : undefined}
                  >
                    {crumb.label}
                  </span>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Botón visible de la paleta de comandos. Antes ⌘K existía pero nada lo
 * anunciaba, y en móvil (sin teclado) no había forma de abrirla.
 */
export function SearchButton() {
  const [shortcut, setShortcut] = useState("Ctrl K");
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) setShortcut("⌘K");
  }, []);

  return (
    <Button
      variant="outline"
      onClick={openCommandPalette}
      aria-label="Buscar pantalla, pedido o cliente"
      className="h-9 justify-start gap-2 rounded-full bg-card px-2.5 font-normal text-muted-foreground hover:bg-card hover:text-foreground sm:w-56 sm:px-3"
    >
      <Search className="h-4 w-4 shrink-0" aria-hidden />
      <span className="hidden flex-1 text-left sm:inline">Buscar…</span>
      <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 font-sans text-xs font-medium sm:inline">
        {shortcut}
      </kbd>
    </Button>
  );
}

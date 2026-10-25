"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { SPRING_LAYOUT } from "@/lib/motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Bug, ChevronDown, Download, LogOut, Settings } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/NotificationBell";
import { SearchButton } from "@/components/AppHeaderNav";
import { BugReportDialog } from "@/components/BugReportDialog";
import { useVisibleNavItems } from "@/hooks/useVisibleNavItems";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { findActiveNavUrl } from "@/lib/navMenu";
import { orderGroupItems } from "@/lib/navPreferences";
import { useNavPreferences } from "@/hooks/useNavPreferences";
import { formatAccessList } from "@/lib/roles";
import { logout } from "@/lib/logout";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/BrandLogo";

/** Marca en móvil (en escritorio vive en la cabecera del riel marino). */
function BrandPill() {
  return (
    <Link
      href="/dashboard"
      aria-label="EMD marketing & design, inicio"
      className="flex h-10 shrink-0 items-center rounded-xl px-1 transition-opacity duration-150 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 md:hidden"
    >
      <BrandLogo className="h-6" />
    </Link>
  );
}

/**
 * Pestañas de la sección actual (ej. Operación: Panel · Pedidos · Calendario ·
 * Historial). El riel sólo muestra íconos; aquí se leen los nombres de lo que
 * está "al lado" de la pantalla abierta. El resalte activo se desliza entre
 * pestañas (layoutId compartido).
 */
function SectionNav() {
  const pathname = usePathname();
  const items = useVisibleNavItems();
  const reduced = useReducedMotion();
  const activeUrl = findActiveNavUrl(
    items.map((i) => i.url),
    pathname
  );
  const { prefs } = useNavPreferences();
  const activeGroup = items.find((i) => i.url === activeUrl)?.group;
  // Mismo orden que el usuario eligió para el grupo en la barra lateral, sin
  // sus ocultos (salvo la pantalla abierta, que siempre se ve).
  const siblings = activeGroup
    ? orderGroupItems(
        { groupLabel: activeGroup, items: items.filter((i) => i.group === activeGroup) },
        prefs
      ).filter((i) => i.url === activeUrl || !prefs.hidden.includes(i.url))
    : [];
  if (siblings.length < 2) return null;

  return (
    <nav aria-label={activeGroup} className="hidden min-w-0 items-center gap-0.5 lg:flex">
      {siblings.map((item) => {
        const active = item.url === activeUrl;
        return (
          <Link
            key={item.url}
            href={item.url}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-9 items-center whitespace-nowrap rounded-lg px-3.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
              active && "font-semibold text-primary hover:text-primary"
            )}
          >
            {active && (
              <motion.span
                layoutId="section-nav-active"
                aria-hidden
                className="absolute inset-0 rounded-lg bg-primary/10 dark:bg-primary/15"
                transition={reduced ? { duration: 0 } : SPRING_LAYOUT}
              />
            )}
            <span className="relative">{item.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Avatar con menú de cuenta: quién soy, configuración, reportar, salir. */
function UserMenu() {
  const { data: session } = useSession();
  const { canInstall, promptInstall } = useInstallPrompt();
  const [bugOpen, setBugOpen] = useState(false);
  const user = session?.user;
  const initials = (user?.first_name?.[0] ?? user?.username?.[0] ?? "?") + (user?.last_name?.[0] ?? user?.username?.[1] ?? "");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="bare"
            aria-label="Cuenta"
            className="flex h-10 items-center gap-1.5 rounded-xl border border-border/70 bg-card p-1 pr-2 shadow-soft-xs transition-colors duration-150 hover:border-primary/40"
          >
            <span className="relative">
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg bg-primary text-xs font-semibold uppercase text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span
                aria-hidden
                className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-lime ring-2 ring-card"
              />
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="font-normal">
            <span className="block truncate text-sm font-semibold">
              {user?.first_name} {user?.last_name}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {formatAccessList({ roles: user?.roles, areas: user?.areas })} · @{user?.username}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/dashboard/configuracion">
              <Settings /> Configuración
            </Link>
          </DropdownMenuItem>
          {canInstall && (
            <DropdownMenuItem onSelect={() => void promptInstall()}>
              <Download /> Instalar app
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setBugOpen(true)}>
            <Bug /> Reportar un error
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => void logout()}
            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            <LogOut /> Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <BugReportDialog open={bugOpen} onOpenChange={setBugOpen} />
    </>
  );
}

/**
 * Barra superior: marca a la izquierda, pestañas de la sección al centro y
 * buscador / avisos / cuenta a la derecha, todo en píldoras sobre el lienzo.
 * En móvil queda fija con fondo translúcido y sólo marca + buscar + avisos
 * (la cuenta vive en "Más").
 */
export function AppTopBar({ title }: { title?: string | null }) {
  // Teléfono: al bajar, el título grande de la pantalla se va y aparece uno
  // compacto en la barra (como el "large title" de iOS), con una línea fina
  // que separa la barra del contenido.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 64);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      data-scrolled={scrolled || undefined}
      className="sticky top-0 z-30 flex items-center gap-3 border-b border-transparent bg-background/80 px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] backdrop-blur-md transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none md:h-[4.25rem] md:px-6 md:pb-0 md:pt-0 data-[scrolled]:border-border/70"
    >
      <BrandPill />
      <div className="relative flex min-w-0 flex-1 justify-center self-stretch md:justify-start">
        <SectionNav />
        {title && (
          <span
            aria-hidden={!scrolled}
            className={cn(
              "pointer-events-none absolute inset-0 flex items-center justify-center truncate px-1 font-heading text-base font-semibold transition-[opacity,transform] duration-200 md:hidden",
              scrolled ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
            )}
          >
            <span className="truncate">{title}</span>
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <SearchButton />
        <NotificationBell />
        <span className="hidden md:block">
          <UserMenu />
        </span>
      </div>
    </header>
  );
}

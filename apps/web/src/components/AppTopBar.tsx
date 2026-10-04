"use client";

import { useState } from "react";
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
import { formatRoleList } from "@/lib/roles";
import { logout } from "@/lib/logout";
import { cn } from "@/lib/utils";

/** Marca: píldora con el monograma magenta y el nombre de la app. */
function BrandPill() {
  return (
    <Link
      href="/dashboard"
      aria-label="EMD HUB, inicio"
      className="flex h-11 shrink-0 items-center gap-2.5 rounded-full border border-border/60 bg-card py-1.5 pl-1.5 pr-4 shadow-soft transition-colors hover:bg-card/80 dark:border-border"
    >
      <span
        aria-hidden
        className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[hsl(345_88%_60%)] font-heading text-sm font-bold text-primary-foreground shadow-sm shadow-primary/30"
      >
        E
      </span>
      <span className="font-heading text-[0.9375rem] font-semibold tracking-tight">EMD HUB</span>
    </Link>
  );
}

/**
 * Pestañas de la sección actual (ej. Operación: Panel · Pedidos · Calendario ·
 * Historial). El riel sólo muestra íconos; aquí se leen los nombres de lo que
 * está "al lado" de la pantalla abierta, como la barra central de la
 * referencia.
 */
function SectionNav() {
  const pathname = usePathname();
  const items = useVisibleNavItems();
  const activeUrl = findActiveNavUrl(
    items.map((i) => i.url),
    pathname
  );
  const activeGroup = items.find((i) => i.url === activeUrl)?.group;
  const siblings = activeGroup ? items.filter((i) => i.group === activeGroup) : [];
  if (siblings.length < 2) return null;

  return (
    <nav
      aria-label={activeGroup}
      className="hidden min-w-0 items-center gap-0.5 rounded-full border border-border/60 bg-card p-1.5 shadow-soft dark:border-border lg:flex"
    >
      {siblings.map((item) => {
        const active = item.url === activeUrl;
        return (
          <Link
            key={item.url}
            href={item.url}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-8 items-center whitespace-nowrap rounded-full px-4 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
              active && "bg-muted font-semibold text-foreground dark:bg-secondary"
            )}
          >
            {item.title}
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
            className="flex h-11 items-center gap-1.5 rounded-full border border-border/60 bg-card p-1 pr-2.5 shadow-soft dark:border-border"
          >
            <span className="relative">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-gradient-to-br from-primary to-[hsl(345_88%_60%)] text-xs font-semibold uppercase text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span
                aria-hidden
                className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card"
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
              {formatRoleList(user?.roles ?? [])} · @{user?.username}
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
export function AppTopBar() {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 bg-background/85 px-4 pb-2 md:-ml-[5.75rem] md:pr-6 pt-[calc(0.5rem+env(safe-area-inset-top))] backdrop-blur-md md:h-[4.75rem] md:pb-0 md:pt-0">
      <BrandPill />
      <div className="flex min-w-0 flex-1 justify-center">
        <SectionNav />
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

"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { ThemeToggle } from "./ThemeToggle";
import { BugReportDialog } from "./BugReportDialog";
import { ConfiguracionLink, InstallAppButton } from "./app-sidebar";
import { logout } from "@/lib/logout";
import { cn } from "@/lib/utils";
import { TAB_PRIORITY_URLS, MAX_PRIMARY_TABS, findActiveNavUrl } from "@/lib/navMenu";
import { formatRoleList } from "@/lib/roles";
import { useVisibleNavItems } from "@/hooks/useVisibleNavItems";

interface MobileMoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Bottom sheet del tab "Más" en móvil. Reemplaza al viejo Sheet lateral del
 * `Sidebar` primitive (ahora inerte en móvil, ver `app-sidebar.tsx`): mismo
 * contenido — resto del menú, config, tema, reporte de error, logout,
 * identidad — pero en una hoja propia que sube desde abajo en vez de un
 * drawer con forma de rail. Estado propio (`open`/`onOpenChange` los maneja
 * `MobileTabBar.tsx`), no `useSidebar()`'s `openMobile`: esa plomería
 * pertenece al `Sidebar` primitive, que ya no se monta en móvil.
 */
export function MobileMoreSheet({ open, onOpenChange }: MobileMoreSheetProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const userRoles = session?.user?.roles || [];
  const visibleItems = useVisibleNavItems();

  // Mismo criterio de prioridad que usa `MobileTabBar` para sus 4 tabs
  // (fuente compartida en `navMenu.ts`): todo lo que no entra ahí, entra aquí,
  // en el mismo orden relativo de `useVisibleNavItems()`.
  const primaryUrls = new Set(
    TAB_PRIORITY_URLS.filter((url) =>
      visibleItems.some((item) => item.url === url)
    ).slice(0, MAX_PRIMARY_TABS)
  );
  const remainingItems = visibleItems.filter((item) => !primaryUrls.has(item.url));
  const activeUrl = findActiveNavUrl(visibleItems.map((item) => item.url), pathname);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[85dvh] flex-col gap-0 rounded-t-[1.75rem] border-t-0 bg-card p-0 pb-[env(safe-area-inset-bottom)] shadow-soft-lg"
      >
        {/* Asa del sheet: indica que la hoja se descarta deslizando/tocando afuera. */}
        <span aria-hidden className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-muted" />
        <SheetHeader className="space-y-0 px-4 pb-3 pt-3 text-left">
          {/* Título sólo para lectores de pantalla: la tarjeta de identidad de
              abajo ya cumple el rol visual de encabezado. */}
          <SheetTitle className="sr-only">Más opciones</SheetTitle>
          {/* Misma tarjeta de identidad que llevaba el Sheet del rail en
              móvil, para que la superficie se sienta continua con lo que
              existía antes. */}
          <div className="flex items-center gap-3 rounded-2xl bg-muted/70 p-3">
            <div className="relative shrink-0">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-gradient-to-br from-primary to-[hsl(345_88%_60%)] text-sm font-semibold text-primary-foreground">
                  {session?.user?.username?.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span
                aria-hidden
                className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-muted"
              />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold">
                {session?.user?.first_name} {session?.user?.last_name}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {formatRoleList(userRoles)}
                {session?.user?.username ? ` · @${session.user.username}` : ""}
              </span>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {remainingItems.length > 0 && (
            <nav aria-label="Más opciones de navegación" className="mb-3 flex flex-col gap-0.5">
              {remainingItems.map((item) => {
                const active = activeUrl === item.url;
                return (
                  <Link
                    key={item.url}
                    href={item.url}
                    aria-current={active ? "page" : undefined}
                    onClick={() => onOpenChange(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-full py-1.5 pl-1.5 pr-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                      active ? "bg-muted font-medium text-foreground" : "text-foreground hover:bg-muted/70"
                    )}
                  >
                    {/* Ícono en círculo, como el riel: tinta si es la pantalla actual. */}
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                        active
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                    </span>
                    <span className="flex-1">{item.title}</span>
                    {item.unreadCount > 0 && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                        {item.unreadCount > 99 ? "99+" : item.unreadCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          )}

          <Separator className="mb-2 bg-border/60" />

          <InstallAppButton />
          <ConfiguracionLink pathname={pathname} />
          <BugReportDialog />

          <div className="my-2 flex items-center justify-between rounded-full bg-muted/70 py-1.5 pl-4 pr-1.5">
            <span className="text-sm">Tema</span>
            <ThemeToggle />
          </div>

          <Button
            variant="ghost"
            className="mt-1 w-full justify-start gap-3 px-4 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={() => void logout()}
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

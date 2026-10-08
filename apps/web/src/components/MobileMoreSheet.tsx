"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut, Share } from "lucide-react";
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
import { haptic } from "@/lib/haptics";
import { isIOSInstallRequired } from "@/lib/push";
import { formatRoleList } from "@/lib/roles";
import { useVisibleNavItems } from "@/hooks/useVisibleNavItems";
import { useNavLayout } from "@/hooks/useNavLayout";

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
/** Cuánto hay que bajar la hoja con el dedo para cerrarla. */
const SWIPE_CLOSE_PX = 90;

/**
 * iPhone/iPad no tienen botón de "Instalar": se explica cómo agregarla a la
 * pantalla de inicio (sólo si todavía no se abrió como app).
 */
function IosInstallHint() {
  const [show, setShow] = useState(false);
  useEffect(() => setShow(isIOSInstallRequired()), []);
  if (!show) return null;
  return (
    <div className="mb-2 flex items-start gap-3 rounded-2xl bg-primary/10 p-3 text-sm">
      <Share className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      <p>
        <span className="font-semibold">Instálala en tu iPhone:</span> toca{" "}
        <span className="font-medium">Compartir</span> en Safari y luego{" "}
        <span className="font-medium">“Agregar a inicio”</span>. Se abre como app y te llegan los avisos.
      </p>
    </div>
  );
}

export function MobileMoreSheet({ open, onOpenChange }: MobileMoreSheetProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const userRoles = session?.user?.roles || [];
  const visibleItems = useVisibleNavItems();

  // Mismos tabs principales que `MobileTabBar` (fuente única `useNavLayout`:
  // favoritos primero, sin ocultos): todo lo que no entra ahí — incluidos los
  // ocultos — entra aquí, en el mismo orden relativo de `useVisibleNavItems()`.
  const { primaryTabUrls, activeUrl } = useNavLayout();
  const primaryUrls = new Set(primaryTabUrls);
  const remainingItems = visibleItems.filter((item) => !primaryUrls.has(item.url));

  // Deslizar hacia abajo desde el asa/encabezado cierra la hoja, como en iOS/Android.
  const [drag, setDrag] = useState(0);
  const dragStart = useRef<number | null>(null);
  const dragHandlers = {
    onTouchStart: (e: React.TouchEvent) => {
      dragStart.current = e.touches[0].clientY;
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (dragStart.current == null) return;
      setDrag(Math.max(0, e.touches[0].clientY - dragStart.current));
    },
    onTouchEnd: () => {
      if (drag > SWIPE_CLOSE_PX) {
        haptic("light");
        onOpenChange(false);
      }
      dragStart.current = null;
      setDrag(0);
    },
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[85dvh] flex-col gap-0 rounded-t-[1.75rem] border-t-0 bg-card p-0 pb-[env(safe-area-inset-bottom)] shadow-soft-lg"
        style={drag ? { transform: `translateY(${drag}px)`, transition: "none" } : undefined}
      >
        <div {...dragHandlers} className="touch-none">
        {/* Asa del sheet: indica que la hoja se descarta deslizando/tocando afuera. */}
        <span aria-hidden className="mx-auto mt-2.5 block h-1.5 w-10 shrink-0 rounded-full bg-muted" />
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
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
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
          <IosInstallHint />
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

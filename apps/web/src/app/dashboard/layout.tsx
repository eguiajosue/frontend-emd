"use client";

import { AppSidebar, RAIL_OFFSET_COLLAPSED, RAIL_OFFSET_EXPANDED } from "@/components/app-sidebar";
import { MobileTabBar } from "@/components/MobileTabBar";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useSocket, ChatSocketContext } from "@/hooks/useSocket";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { usePermissions } from "@/hooks/usePermissions";
import { isBranchAllowedPath } from "@/lib/navMenu";
import { useMotionPreset } from "@/lib/motion";
import { CommandPalette } from "@/components/CommandPalette";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { OnboardingTour } from "@/components/OnboardingTour";
import { AppTopBar } from "@/components/AppTopBar";
import { useBreadcrumbs } from "@/components/AppHeaderNav";
import { pageTitleFromBreadcrumbs } from "@/lib/navMenu";
import { useNavPreferences } from "@/hooks/useNavPreferences";

import { useEffect } from "react";
import { useUnreadNotificationsCount } from "@/hooks/useNotifications";

const BASE_TITLE = "EMD HUB";

export default function Layout({ children }: { children: React.ReactNode }) {
  // Keeps the real-time notifications socket alive across every dashboard page.
  const socketRef = useSocket();
  const pathname = usePathname();
  const router = useRouter();
  const { isBranch } = usePermissions();
  const { routeTransition } = useMotionPreset();
  const { count } = useUnreadNotificationsCount();
  const crumbs = useBreadcrumbs();
  const pageTitle = pageTitleFromBreadcrumbs(crumbs);
  // Barra expandida (con títulos): preferencia del usuario. También la
  // controla Ctrl+B (atajo propio de `SidebarProvider`).
  const { expanded, setExpanded } = useNavPreferences();

  // La cuenta de sucursal sólo entra a Pedidos, Mockups y su Configuración
  // personal: cualquier otra ruta la devuelve a "Mis pedidos" (el backend
  // igual responde 403 a lo demás).
  useEffect(() => {
    if (isBranch && !isBranchAllowedPath(pathname)) router.replace("/dashboard/orders");
  }, [isBranch, pathname, router]);

  // Mientras la cuenta de sucursal está en una ruta que no le toca (el
  // redirect de arriba aún no se aplicó) no se monta la página: así no dispara
  // sus consultas, que el backend contesta con 403.
  const blockedForBranch = isBranch && !isBranchAllowedPath(pathname);

  // Pestaña con la página y las no leídas, ej. "(3) Pedidos #12 · EMD HUB":
  // con varias pestañas abiertas antes todas decían sólo "EMD HUB".
  useEffect(() => {
    const unread = count > 0 ? `(${count > 99 ? "99+" : count}) ` : "";
    document.title = `${unread}${pageTitle ? `${pageTitle} · ` : ""}${BASE_TITLE}`;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [count, pageTitle]);

  return (
    <ChatSocketContext.Provider value={socketRef}>
      <SidebarProvider open={expanded} onOpenChange={setExpanded}>
        <AppSidebar />
        <MobileTabBar />
        {/* Riel fijo a la izquierda (`AppSidebar`, sólo escritorio): el
            contenido deja su ancho (3.75rem, o 14.5rem expandido) + márgenes
            (1rem a cada lado). `--rail-offset` lo reutiliza `AppTopBar`. */}
        <main
          data-rail={expanded ? "expanded" : "collapsed"}
          style={{ "--rail-offset": expanded ? RAIL_OFFSET_EXPANDED : RAIL_OFFSET_COLLAPSED } as React.CSSProperties}
          className="relative w-full min-w-0 overflow-x-hidden transition-[padding] duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none md:pl-[var(--rail-offset)]"
        >
          <AppTopBar />
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={routeTransition.initial}
              animate={routeTransition.animate}
              exit={routeTransition.exit}
              transition={routeTransition.transition}
              // La barra flotante (`MobileTabBar`, `md:hidden`) ocupa ~4.5rem
              // de alto (píldora + su margen inferior) más un respiro de
              // 0.75rem antes del contenido — de ahí los 5.5rem extra sobre
              // el padding base, hasta el mismo breakpoint `md` en el que la
              // barra desaparece y el padding vuelve al de siempre.
              className="mx-auto mt-4 max-w-[110rem] px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:mt-2 md:pb-8 md:pl-0 md:pr-6"
            >
              {blockedForBranch ? (
                <div data-testid="branch-redirecting" aria-busy="true" className="space-y-3">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-64 w-full rounded-xl" />
                </div>
              ) : (
                children
              )}
            </motion.div>
          </AnimatePresence>
        </main>
        <CommandPalette />
        <KeyboardShortcuts />
        <OnboardingTour />
      </SidebarProvider>
    </ChatSocketContext.Provider>
  );
}

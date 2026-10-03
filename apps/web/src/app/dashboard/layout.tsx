"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { MobileTabBar } from "@/components/MobileTabBar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useSocket, ChatSocketContext } from "@/hooks/useSocket";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useMotionPreset } from "@/lib/motion";
import { CommandPalette } from "@/components/CommandPalette";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { OnboardingTour } from "@/components/OnboardingTour";
import { AppTopBar } from "@/components/AppTopBar";
import { useBreadcrumbs } from "@/components/AppHeaderNav";
import { pageTitleFromBreadcrumbs } from "@/lib/navMenu";

import { useEffect } from "react";
import { useUnreadNotificationsCount } from "@/hooks/useNotifications";

const BASE_TITLE = "EMD HUB";

export default function Layout({ children }: { children: React.ReactNode }) {
  // Keeps the real-time notifications socket alive across every dashboard page.
  const socketRef = useSocket();
  const pathname = usePathname();
  const { routeTransition } = useMotionPreset();
  const { count } = useUnreadNotificationsCount();
  const crumbs = useBreadcrumbs();
  const pageTitle = pageTitleFromBreadcrumbs(crumbs);

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
      <SidebarProvider defaultOpen={false}>
        <AppSidebar />
        <MobileTabBar />
        {/* Riel fijo a la izquierda (`AppSidebar`, sólo escritorio): el
            contenido deja su ancho (3.75rem) + márgenes (1rem a cada lado). */}
        <main className="relative w-full min-w-0 overflow-x-hidden md:pl-[5.75rem]">
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
              {children}
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

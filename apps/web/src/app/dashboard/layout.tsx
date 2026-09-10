"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { MobileTabBar } from "@/components/MobileTabBar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useSocket, ChatSocketContext } from "@/hooks/useSocket";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useMotionPreset } from "@/lib/motion";
import { CommandPalette } from "@/components/CommandPalette";
import { OnboardingTour } from "@/components/OnboardingTour";
import { NotificationBell } from "@/components/NotificationBell";

import { useEffect } from "react";
import { useUnreadNotificationsCount } from "@/hooks/useNotifications";

const BASE_TITLE = "EMD Bordados";

export default function Layout({ children }: { children: React.ReactNode }) {
  // Keeps the real-time notifications socket alive across every dashboard page.
  const socketRef = useSocket();
  const pathname = usePathname();
  const { routeTransition } = useMotionPreset();
  const { count } = useUnreadNotificationsCount();

  // Refleja el conteo de no leídas en el título de la pestaña, ej. "(3) EMD Bordados".
  useEffect(() => {
    document.title = count > 0 ? `(${count > 99 ? "99+" : count}) ${BASE_TITLE}` : BASE_TITLE;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [count]);

  return (
    <ChatSocketContext.Provider value={socketRef}>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar />
        <MobileTabBar />
        <main className="relative w-full min-w-0 overflow-x-hidden">
          {/*
           * En móvil es la barra superior de la app: queda fija, despeja el notch
           * y el contenido pasa por debajo. En escritorio vuelve a ser la fila
           * suelta de siempre.
           */}
          <div className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border bg-background/90 px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:px-6 sm:pb-0 sm:pt-6 sm:backdrop-blur-none">
            <SidebarTrigger />
            <NotificationBell />
          </div>
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
              className="mt-4 px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-6"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
        <CommandPalette />
        <OnboardingTour />
      </SidebarProvider>
    </ChatSocketContext.Provider>
  );
}

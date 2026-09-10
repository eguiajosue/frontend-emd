"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useSocket } from "@/hooks/useSocket";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useMotionPreset } from "@/lib/motion";
import { CommandPalette } from "@/components/CommandPalette";
import { OnboardingTour } from "@/components/OnboardingTour";
import { NotificationBell } from "@/components/NotificationBell";

import { ReactNode, useEffect } from "react";
import { useUnreadNotificationsCount } from "@/hooks/useNotifications";

const BASE_TITLE = "EMD Bordados";

export default function Layout({ children }: { children: ReactNode }) {
  // Keeps the real-time notifications socket alive across every dashboard page.
  useSocket();
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
    <SidebarProvider defaultOpen={false}>
      <AppSidebar />
      <main className="relative w-full min-w-0 overflow-x-hidden p-4 sm:p-6">
        <div className="flex items-center justify-between">
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
            className="mt-4"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      <CommandPalette />
      <OnboardingTour />
    </SidebarProvider>
  );
}

"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useSocket } from "@/hooks/useSocket";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useMotionPreset } from "@/lib/motion";
import { CommandPalette } from "@/components/CommandPalette";
import { OnboardingTour } from "@/components/OnboardingTour";

import { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  // Keeps the real-time notifications socket alive across every dashboard page.
  useSocket();
  const pathname = usePathname();
  const { routeTransition } = useMotionPreset();

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="relative w-full min-w-0 overflow-x-hidden p-4 sm:p-6">
        <SidebarTrigger />
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

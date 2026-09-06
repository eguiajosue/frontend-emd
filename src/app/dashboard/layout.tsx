"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useSocket } from "@/hooks/useSocket";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";

import { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  // Keeps the real-time notifications socket alive across every dashboard page.
  useSocket();
  const pathname = usePathname();

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="w-full min-w-0 p-4 sm:p-6">
        <SidebarTrigger />
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="mt-4"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </SidebarProvider>
  );
}

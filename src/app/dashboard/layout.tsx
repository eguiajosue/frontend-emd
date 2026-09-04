"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useSocket } from "@/hooks/useSocket";

import { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  // Keeps the real-time notifications socket alive across every dashboard page.
  useSocket();

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="w-full min-w-0 p-4 sm:p-6">
        <SidebarTrigger />
        <div className="mt-4">{children}</div>
      </main>
    </SidebarProvider>
  );
}

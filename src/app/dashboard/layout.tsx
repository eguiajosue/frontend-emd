import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

import { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
     <SidebarProvider>
      <AppSidebar/>
        <main className="w-full p-6">
          <SidebarTrigger/>
          <div className="">
           {children}
          </div>
        </main>
      </SidebarProvider>
    </>
  )
}

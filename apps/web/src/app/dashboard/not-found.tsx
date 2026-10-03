import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardNotFound() {
  return (
    <div className="mx-auto mt-10 flex max-w-xl flex-col items-center gap-4 rounded-[1.75rem] border border-border/60 bg-card px-6 py-10 shadow-soft sm:px-10 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Compass className="h-6 w-6 text-muted-foreground" aria-hidden />
      </span>
      <h2 className="font-heading text-2xl font-semibold leading-tight tracking-tight">404 — Sección no encontrada</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        La pantalla que buscás no existe o fue movida.
      </p>
      <Button asChild>
        <Link href="/dashboard">Volver al inicio</Link>
      </Button>
    </div>
  );
}

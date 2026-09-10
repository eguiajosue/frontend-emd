import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardNotFound() {
  return (
    <div className="mt-10 flex flex-col items-center gap-4 rounded-md border border-dashed p-10 text-center">
      <h2 className="text-2xl font-bold leading-tight tracking-tight">404 — Sección no encontrada</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        La pantalla que buscás no existe o fue movida.
      </p>
      <Button asChild>
        <Link href="/dashboard">Volver al inicio</Link>
      </Button>
    </div>
  );
}

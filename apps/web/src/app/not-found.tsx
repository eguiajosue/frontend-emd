import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-[1.75rem] border border-border/60 bg-card px-6 py-10 shadow-soft sm:px-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Compass className="h-6 w-6 text-muted-foreground" aria-hidden />
        </span>
        <div>
          <h1 className="font-heading text-6xl font-semibold tracking-tight text-foreground">404</h1>
          <p className="mt-3 text-lg font-semibold text-foreground">Página no encontrada</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Parece que la página que buscas no existe. Por favor, verifica la URL o
            regresa a la página principal.
          </p>
        </div>
        <Button asChild size="lg" className="mt-2">
          <Link href="/dashboard">Volver al inicio</Link>
        </Button>
      </div>
    </div>
  );
}

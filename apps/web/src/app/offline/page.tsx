import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-[1.75rem] border border-border/60 bg-card px-6 py-10 shadow-soft sm:px-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <WifiOff className="h-6 w-6 text-muted-foreground" aria-hidden />
        </span>
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">Sin conexión</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            No hay red en este momento. Los pedidos y tareas cargados
            anteriormente siguen disponibles; el resto se sincronizará solo en
            cuanto vuelva la conexión.
          </p>
        </div>
      </div>
    </div>
  );
}

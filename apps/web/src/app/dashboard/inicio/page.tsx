"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ReceptionHome } from "@/components/home/ReceptionHome";
import { DesignHome } from "@/components/home/DesignHome";
import { ProductionHome } from "@/components/home/ProductionHome";
import { usePermissions } from "@/hooks/usePermissions";
import { homeKindsFor, type HomeKind } from "@/lib/homeDashboard";

const KIND_KEY = "emd:homeKind";
const KIND_LABEL: Record<HomeKind, string> = { reception: "Recepción", design: "Diseño", production: "Producción" };

/**
 * Inicio por rol: Recepción (y admin) ven el control en vivo de todas las
 * áreas; Diseño y Producción, su trabajo por prioridad. Quien trabaja en
 * Diseño y en un área de producción elige cuál ver (se recuerda).
 */
export default function InicioPage() {
  const { roles, session, isSessionLoading } = usePermissions();
  const kinds = homeKindsFor(roles);
  const [chosen, setChosen] = useState<HomeKind | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KIND_KEY) as HomeKind | null;
      if (saved) setChosen(saved);
    } catch {
      // Sin localStorage (modo privado): se arranca con el primero.
    }
  }, []);

  const active = chosen && kinds.includes(chosen) ? chosen : kinds[0];
  const firstName = session?.user?.first_name;

  if (isSessionLoading) {
    return (
      <div className="space-y-6" aria-hidden>
        <Skeleton className="h-16 w-2/3 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!active) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-16 text-center">
        <LayoutDashboard className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
        <h1 className="text-page-title">Sin inicio para tu rol</h1>
        <p className="text-sm text-muted-foreground">Pedile a un administrador que te asigne un área.</p>
        <Button asChild variant="outline">
          <Link href="/dashboard/ayuda">Ir a Ayuda</Link>
        </Button>
      </div>
    );
  }

  const switcher =
    kinds.length > 1 ? (
      <ToggleGroup
        type="single"
        variant="segmented"
        size="sm"
        value={active}
        onValueChange={(value) => {
          if (!value) return;
          setChosen(value as HomeKind);
          try {
            window.localStorage.setItem(KIND_KEY, value);
          } catch {
            // No crítico.
          }
        }}
        aria-label="Qué inicio ver"
        className="rounded-full border bg-card p-1"
      >
        {kinds.map((kind) => (
          <ToggleGroupItem key={kind} value={kind}>
            {KIND_LABEL[kind]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    ) : null;

  if (active === "reception") return <ReceptionHome firstName={firstName} switcher={switcher} />;
  if (active === "design") return <DesignHome firstName={firstName} switcher={switcher} />;
  return <ProductionHome firstName={firstName} roles={roles} switcher={switcher} />;
}

"use client";

import { useState } from "react";
import { Shirt } from "lucide-react";
import Title from "@/components/Title";
import { EmptyState } from "@/components/ui/empty-state";
import { MockupStudio } from "@/components/mockups/MockupStudio";
import { AttachToOrderDialog } from "@/components/mockups/AttachToOrderDialog";
import { usePermissions } from "@/hooks/usePermissions";
import type { MockupStudioResult } from "@/lib/mockups/studio";

/**
 * Creador de mockups 3D (docs/plans/mockups-3d.md): Recepción arma una
 * playera o gorra con el color y los diseños del cliente, y la descarga o la
 * adjunta a un pedido. Sólo Recepción, administración y la cuenta de sucursal (Punto Madero); el backend también lo hace cumplir al adjuntar.
 */
export default function MockupsPage() {
  const { canManageOperations, isBranch, isSessionLoading, roles } = usePermissions();
  const noAccess = !isSessionLoading && roles.length > 0 && !canManageOperations && !isBranch;
  const [pending, setPending] = useState<MockupStudioResult | null>(null);

  if (noAccess) {
    return (
      <EmptyState
        icon={Shirt}
        title="Sin acceso a Mockups"
        description="Los mockups los arman Recepción, administración y las sucursales."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Title title="Mockups" />
      <MockupStudio attachLabel="Adjuntar a pedido" onAttach={(result) => setPending(result)} />
      <AttachToOrderDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        result={pending}
      />
    </div>
  );
}

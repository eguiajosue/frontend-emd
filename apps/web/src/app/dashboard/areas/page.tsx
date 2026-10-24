"use client";

import { useState } from "react";
import { Boxes, Pencil, Plus, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";
import type { AreaOverview } from "@emd/types";
import Title from "@/components/Title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/crud/ConfirmDeleteDialog";
import { AreaEditDialog } from "@/components/areas/AreaEditDialog";
import { AreaWizard } from "@/components/areas/AreaWizard";
import { ErrorState, TableSkeleton } from "@/components/feedback/states";
import { EmptyState } from "@/components/ui/empty-state";
import { useAreaAdminMutations, useAreaOverview } from "@/hooks/useAreaAdmin";
import { usePermissions } from "@/hooks/usePermissions";
import { getAreaIcon } from "@/lib/areas";
import { deactivationBlocker } from "@/lib/areaForm";
import { cn } from "@/lib/utils";

function AreaCard({
  area,
  onEdit,
  onToggle,
}: {
  area: AreaOverview;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const Icon = getAreaIcon(area.slug);
  const blocker = area.active ? deactivationBlocker(area) : null;
  return (
    <li
      data-area={area.slug}
      className={cn("area-stripe flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-card px-4 py-3", !area.active && "opacity-60")}
    >
      <span className="area-chip">
        {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
        {area.name}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs text-muted-foreground">
          <span className="font-mono">{area.slug}</span> · {area.users} persona{area.users === 1 ? "" : "s"}
          {area.hasSharedAccount ? " · con cuenta compartida" : " · sin cuenta compartida"}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {!area.active && <Badge variant="outline">Desactivada</Badge>}
          {area.isDesign && <Badge variant="secondary">Fase previa</Badge>}
          {area.isProductionDestination && <Badge variant="secondary">Producción</Badge>}
          {area.hasInventory && <Badge variant="secondary">Inventario</Badge>}
          {area.stages.length > 0 && (
            <Badge variant="secondary" title={area.stages.map((stage) => stage.name).join(" → ")}>
              {area.stages.length} etapa{area.stages.length === 1 ? "" : "s"}
            </Badge>
          )}
          {!area.generalViewEnabled && <Badge variant="secondary">Vista por persona</Badge>}
          {(area.openOrders > 0 || area.openTasks > 0) && (
            <Badge variant="outline">
              {area.openOrders} pedido{area.openOrders === 1 ? "" : "s"} · {area.openTasks} tarea{area.openTasks === 1 ? "" : "s"}
            </Badge>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Button type="button" variant="outline" size="sm" onClick={onEdit} aria-label={`Editar ${area.name}`}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Editar
        </Button>
        {!area.isDesign && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggle}
            disabled={Boolean(blocker)}
            title={blocker ?? undefined}
            aria-label={`${area.active ? "Desactivar" : "Activar"} ${area.name}`}
          >
            {area.active ? <PowerOff className="mr-1.5 h-3.5 w-3.5" aria-hidden /> : <Power className="mr-1.5 h-3.5 w-3.5" aria-hidden />}
            {area.active ? "Desactivar" : "Activar"}
          </Button>
        )}
      </div>
    </li>
  );
}

/**
 * Áreas de trabajo (administración): dar de alta con el wizard, editar y
 * desactivar. Un área nunca se borra: sus pedidos, tareas e inventario se
 * conservan.
 */
export default function AreasPage() {
  const { canManageUsers, isSessionLoading } = usePermissions();
  const { areas, isPending, isError, refetch } = useAreaOverview(canManageUsers);
  const { update } = useAreaAdminMutations();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing] = useState<AreaOverview | null>(null);
  const [toDeactivate, setToDeactivate] = useState<AreaOverview | null>(null);

  if (!isSessionLoading && !canManageUsers) {
    return (
      <div className="space-y-4">
        <Title title="Áreas" />
        <EmptyState icon={Boxes} title="Sin acceso" description="Sólo administración puede gestionar las áreas." />
      </div>
    );
  }

  const handleToggle = async (area: AreaOverview) => {
    try {
      await update(area.id, { active: !area.active });
      toast.success(area.active ? `"${area.name}" desactivada` : `"${area.name}" activada`);
    } catch {
      // El error del backend ya se avisa con un toast global.
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Title title="Áreas" />
        <Button type="button" onClick={() => setWizardOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden />
          Nueva área
        </Button>
      </div>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Cada área define dónde trabaja el equipo: su bandeja de tareas, su inventario y su canal de chat. Un área
        desactivada deja de ofrecerse, pero sus pedidos, tareas e inventario se conservan.
      </p>

      {isPending ? (
        <TableSkeleton rows={6} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : areas.length === 0 ? (
        <EmptyState icon={Boxes} title="Todavía no hay áreas" description="Crea la primera con “Nueva área”." />
      ) : (
        <ul className="space-y-2" aria-label="Áreas">
          {areas.map((area) => (
            <AreaCard
              key={area.id}
              area={area}
              onEdit={() => setEditing(area)}
              onToggle={() => (area.active ? setToDeactivate(area) : handleToggle(area))}
            />
          ))}
        </ul>
      )}

      <AreaWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
      <AreaEditDialog area={editing} onClose={() => setEditing(null)} />
      <ConfirmDeleteDialog
        open={toDeactivate !== null}
        onOpenChange={(open) => !open && setToDeactivate(null)}
        title={`¿Desactivar ${toDeactivate?.name ?? "el área"}?`}
        description="Deja de ofrecerse al crear pedidos y de dar acceso. Sus pedidos, tareas e inventario se conservan y se puede volver a activar."
        confirmLabel="Desactivar"
        onConfirm={() => {
          const area = toDeactivate;
          setToDeactivate(null);
          if (area) void handleToggle(area);
        }}
      />
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/crud/ConfirmDeleteDialog";
import { useEntityDetail } from "@/hooks/useEntity";
import { useClientOrderTemplates, useOrderTemplateMutations } from "@/hooks/useOrderTemplates";
import { getErrorMessage } from "@/lib/api";
import { getAreaLabel } from "@/lib/areas";
import { describeOrderProducts, MAX_TEMPLATE_NAME_LENGTH } from "@/lib/createOrderForm";
import { getClientName } from "@/lib/format";
import type { Client, OrderTemplate } from "@/types";

interface ClientTemplatesDialogProps {
  clientId: number | null;
  onClose: () => void;
}

/**
 * Plantillas de pedido de un cliente: ver qué guarda cada una, renombrar,
 * borrar y arrancar un pedido nuevo con ella. Se crean (y se actualizan con
 * lo que cambió) desde "Nuevo pedido" → "Guardar como plantilla".
 */
export function ClientTemplatesDialog({ clientId, onClose }: ClientTemplatesDialogProps) {
  const open = clientId !== null;
  const { data: client } = useEntityDetail<Client>("clients", clientId ?? undefined, {
    enabled: open,
  });
  const { templates, isLoading, isError, refetch } = useClientOrderTemplates(open ? clientId : null);
  const { update, remove } = useOrderTemplateMutations();
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [draftName, setDraftName] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<OrderTemplate | null>(null);

  const clientName = client ? getClientName(client) : "cliente";

  const startRename = (t: OrderTemplate) => {
    setRenamingId(t.id);
    setDraftName(t.name);
    setRenameError(null);
  };

  const saveRename = async (t: OrderTemplate) => {
    const name = draftName.trim();
    if (!name) {
      setRenameError("Pon un nombre");
      return;
    }
    if (name === t.name) {
      setRenamingId(null);
      return;
    }
    try {
      await update.mutateAsync({ id: t.id, payload: { name } });
      setRenamingId(null);
    } catch (error) {
      setRenameError(getErrorMessage(error, "No se pudo renombrar la plantilla."));
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent className="sm:max-h-[85vh] sm:max-w-2xl sm:overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Plantillas de {clientName}</DialogTitle>
            <DialogDescription>
              Lo que este cliente suele pedir. Se crean desde «Nuevo pedido» → «Guardar como plantilla».
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : isError ? (
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">No se pudieron cargar las plantillas.</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Reintentar
                </Button>
              </div>
            ) : templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {clientName} todavía no tiene plantillas. Al cargar un pedido suyo, toca «Guardar como
                plantilla» y la próxima vez queda a un toque.
              </p>
            ) : (
              <ul className="divide-y divide-border/60" aria-label={`Plantillas de ${clientName}`}>
                {templates.map((t) => {
                  const route = t.requiresDesign
                    ? "Con diseño"
                    : t.productionAreas.map((a) => getAreaLabel(a)).join(", ");
                  const materials =
                    t.materials.length > 0
                      ? `${t.materials.length} ${t.materials.length === 1 ? "material" : "materiales"}`
                      : null;
                  const uses = t.useCount === 1 ? "usada 1 vez" : t.useCount > 1 ? `usada ${t.useCount} veces` : null;
                  return (
                    <li key={t.id} className="flex flex-wrap items-center gap-3 py-3">
                      <div className="min-w-0 flex-1 space-y-0.5">
                        {renamingId === t.id ? (
                          <form
                            className="flex items-center gap-1.5"
                            onSubmit={(e) => {
                              e.preventDefault();
                              void saveRename(t);
                            }}
                          >
                            <label htmlFor={`template-name-${t.id}`} className="sr-only">
                              Nombre de la plantilla
                            </label>
                            <Input
                              id={`template-name-${t.id}`}
                              autoFocus
                              value={draftName}
                              maxLength={MAX_TEMPLATE_NAME_LENGTH}
                              aria-invalid={Boolean(renameError)}
                              onChange={(e) => {
                                setDraftName(e.target.value);
                                setRenameError(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") {
                                  e.stopPropagation();
                                  setRenamingId(null);
                                }
                              }}
                              className="h-9"
                            />
                            <Button
                              type="submit"
                              size="icon"
                              variant="ghost"
                              className="size-9 shrink-0"
                              aria-label="Guardar nombre"
                              disabled={update.isPending}
                            >
                              {update.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-9 shrink-0"
                              aria-label="Cancelar"
                              onClick={() => setRenamingId(null)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </form>
                        ) : (
                          <p className="truncate text-sm font-medium">{t.name}</p>
                        )}
                        {renamingId === t.id && renameError && (
                          <p role="alert" className="text-xs font-medium text-red-700 dark:text-red-400">
                            {renameError}
                          </p>
                        )}
                        <p className="truncate text-sm text-foreground/80">{describeOrderProducts(t.products, 3)}</p>
                        <p className="truncate text-meta">
                          {[route, materials, uses].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      {renamingId !== t.id && (
                        <div className="flex shrink-0 items-center gap-1">
                          <Button asChild variant="outline" size="sm" className="gap-1.5">
                            <Link href={`/dashboard/orders?new=1&template=${t.id}`}>
                              <Plus className="h-4 w-4" aria-hidden />
                              Nuevo pedido
                            </Link>
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-9 text-muted-foreground"
                            aria-label={`Renombrar ${t.name}`}
                            onClick={() => startRename(t)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-9 text-muted-foreground hover:text-destructive"
                            aria-label={`Eliminar ${t.name}`}
                            onClick={() => setDeleting(t)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleting !== null}
        onOpenChange={(next) => !next && setDeleting(null)}
        title={`¿Eliminar la plantilla «${deleting?.name ?? ""}»?`}
        description="Los pedidos que ya se crearon con ella no cambian."
        onConfirm={async () => {
          if (!deleting) return;
          const name = deleting.name;
          try {
            await remove.mutateAsync(deleting.id);
            toast.success(`Plantilla «${name}» eliminada`);
          } catch {
            // El error ya lo avisa el toast global de mutaciones.
          } finally {
            setDeleting(null);
          }
        }}
      />
    </>
  );
}

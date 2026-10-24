"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { User } from "@emd/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AreaPreview, ColorPicker, IconPicker, SuggestionInput } from "@/components/areas/AreaPickers";
import { useAreaCatalog } from "@/hooks/useAreas";
import { useAreaAdminMutations } from "@/hooks/useAreaAdmin";
import { useEntityList } from "@/hooks/useEntity";
import {
  EMPTY_DRAFT,
  STEP_TITLES,
  draftToPayload,
  slugPreview,
  summaryLines,
  validateStep,
  wizardSteps,
  type AreaDraft,
} from "@/lib/areaForm";
import { cn } from "@/lib/utils";

/** Interruptor con título y explicación, como en el resto de los formularios. */
function SwitchRow({
  id,
  title,
  description,
  checked,
  onChange,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 px-3.5 py-3">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-medium leading-none">
          {title}
        </Label>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/** Personas que se pueden sumar al área: las de carne y hueso, no cuentas compartidas ni de sucursal. */
function assignable(user: User): boolean {
  return !user.isSharedAccount && !user.roles?.some((role) => role.name === "sucursal");
}

function userName(user: User): string {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username;
}

/**
 * Wizard para dar de alta un área: identidad → comportamiento → inventario
 * inicial → equipo → resumen. No crea nada hasta el último paso.
 */
export function AreaWizard({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: (slug: string) => void }) {
  const catalog = useAreaCatalog();
  const { create, isCreating } = useAreaAdminMutations();
  const { data: users, isPending: usersPending } = useEntityList<User>("users", { enabled: open });
  const [draft, setDraft] = useState<AreaDraft>(EMPTY_DRAFT);
  const [stepIndex, setStepIndex] = useState(0);
  const [touched, setTouched] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  useEffect(() => {
    if (open) {
      setDraft(EMPTY_DRAFT);
      setStepIndex(0);
      setTouched(false);
      setUserSearch("");
    }
  }, [open]);

  const set = <K extends keyof AreaDraft>(key: K, value: AreaDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const steps = wizardSteps(draft);
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const isLast = step === "resumen";
  const errors = validateStep(step, draft, catalog);

  const people = useMemo(() => users.filter(assignable), [users]);
  const visiblePeople = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return q ? people.filter((u) => `${userName(u)} ${u.username}`.toLowerCase().includes(q)) : people;
  }, [people, userSearch]);

  const goNext = () => {
    setTouched(true);
    if (Object.keys(errors).length > 0) return;
    setTouched(false);
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  };

  const handleCreate = async () => {
    try {
      const created = await create(draftToPayload(draft));
      toast.success(`Área "${created.name}" creada`);
      onCreated?.(created.slug);
      onClose();
    } catch {
      // El error del backend ya se avisa con un toast global; se queda el
      // diálogo abierto para no perder lo capturado.
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isCreating && onClose()}>
      <DialogContent className="sm:max-h-[90vh] sm:max-w-xl sm:overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva área</DialogTitle>
          <DialogDescription>
            Paso {stepIndex + 1} de {steps.length} · {STEP_TITLES[step]}
          </DialogDescription>
          <div className="flex gap-1.5 pt-1" aria-hidden>
            {steps.map((id, i) => (
              <span
                key={id}
                className={cn("h-1 flex-1 rounded-full bg-muted transition-colors", i <= stepIndex && "bg-foreground")}
              />
            ))}
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {step === "identidad" && (
            <>
              <FormField
                label="Nombre del área"
                htmlFor="area-name"
                required
                error={touched ? errors.name : undefined}
                hint={
                  draft.name.trim() && !errors.name
                    ? `Identificador interno: ${slugPreview(draft.name)} (no cambia después)`
                    : "Ej. Impresión 3D, Serigrafía, Sublimación"
                }
              >
                <Input
                  id="area-name"
                  autoFocus
                  value={draft.name}
                  maxLength={40}
                  aria-invalid={touched && Boolean(errors.name)}
                  onChange={(event) => set("name", event.target.value)}
                />
              </FormField>
              <FormField label="Ícono">
                <IconPicker value={draft.icon} onChange={(icon) => set("icon", icon)} />
              </FormField>
              <FormField label="Color">
                <ColorPicker value={draft.color} onChange={(color) => set("color", color)} error={touched ? errors.color : undefined} />
              </FormField>
              <AreaPreview name={draft.name} icon={draft.icon} color={draft.color} />
            </>
          )}

          {step === "comportamiento" && (
            <>
              <SwitchRow
                id="area-production"
                title="Destino de producción"
                description="Los pedidos pueden producirse en esta área: se ofrece al crear pedidos y genera tareas."
                checked={draft.isProductionDestination}
                onChange={(checked) => set("isProductionDestination", checked)}
              />
              <SwitchRow
                id="area-inventory"
                title="Inventario propio"
                description="Lleva sus propias existencias (materia prima, consumibles) en Inventario."
                checked={draft.hasInventory}
                onChange={(checked) => set("hasInventory", checked)}
              />
              <SwitchRow
                id="area-general-view"
                title="Todo el equipo ve todo el trabajo del área"
                description="Si lo apagas, cada persona sólo ve lo que se le asignó y lo que está libre."
                checked={draft.generalViewEnabled}
                onChange={(checked) => set("generalViewEnabled", checked)}
              />
            </>
          )}

          {step === "inventario" && (
            <>
              <p className="text-sm text-muted-foreground">
                Opcional. Se sugerirán al dar de alta artículos de inventario del área; siempre se puede escribir otra.
                Enter agrega cada una.
              </p>
              <FormField label="Categorías">
                <SuggestionInput
                  label="Categorías"
                  placeholder="Ej. Filamento, Resina, Refacciones"
                  value={draft.inventoryCategories}
                  onChange={(next) => set("inventoryCategories", next)}
                />
              </FormField>
              <FormField label="Unidades">
                <SuggestionInput
                  label="Unidades"
                  placeholder="Ej. kg, rollo, litro, pieza"
                  value={draft.inventoryUnits}
                  onChange={(next) => set("inventoryUnits", next)}
                />
              </FormField>
            </>
          )}

          {step === "equipo" && (
            <>
              <SwitchRow
                id="area-shared-account"
                title="Cuenta compartida del área"
                description={`Responsable por defecto de sus tareas ("cualquiera del área"). Usuario: ${slugPreview(draft.name) || "—"}; no tiene contraseña conocida.`}
                checked={draft.createSharedAccount}
                onChange={(checked) => set("createSharedAccount", checked)}
              />
              <FormField label="Personas del área" hint="Opcional: también se asignan después desde Usuarios.">
                <div className="space-y-2">
                  <Input
                    aria-label="Buscar persona"
                    placeholder="Buscar persona..."
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                  />
                  <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-lg border border-input p-1.5">
                    {usersPending ? (
                      <p className="px-2 py-3 text-sm text-muted-foreground">Cargando personas...</p>
                    ) : visiblePeople.length === 0 ? (
                      <p className="px-2 py-3 text-sm text-muted-foreground">No hay personas para mostrar.</p>
                    ) : (
                      visiblePeople.map((user) => {
                        const id = `area-user-${user.id}`;
                        const checked = draft.userIds.includes(user.id);
                        return (
                          <Label
                            key={user.id}
                            htmlFor={id}
                            className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-normal hover:bg-muted"
                          >
                            <Checkbox
                              id={id}
                              checked={checked}
                              onCheckedChange={(next) =>
                                set(
                                  "userIds",
                                  next ? [...draft.userIds, user.id] : draft.userIds.filter((uid) => uid !== user.id)
                                )
                              }
                            />
                            <span className="truncate">{userName(user)}</span>
                            <span className="ml-auto truncate text-xs text-muted-foreground">@{user.username}</span>
                          </Label>
                        );
                      })
                    )}
                  </div>
                </div>
              </FormField>
            </>
          )}

          {step === "resumen" && (
            <>
              <AreaPreview name={draft.name} icon={draft.icon} color={draft.color} />
              <ul className="space-y-1.5 text-sm" aria-label="Resumen del área">
                {summaryLines(draft, draft.userIds.length).map((line) => (
                  <li key={line} className="flex gap-2">
                    <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                    {line}
                  </li>
                ))}
                {draft.hasInventory && (draft.inventoryCategories.length > 0 || draft.inventoryUnits.length > 0) && (
                  <li className="flex gap-2">
                    <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                    Sugerirá en inventario: {[...draft.inventoryCategories, ...draft.inventoryUnits].join(", ")}.
                  </li>
                )}
              </ul>
              <p className="text-xs text-muted-foreground">
                Quien ya tenga sesión abierta verá el área al volver a entrar.
              </p>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isCreating}>
            Cancelar
          </Button>
          <div className="flex gap-2">
            {stepIndex > 0 && (
              <Button type="button" variant="outline" disabled={isCreating} onClick={() => setStepIndex((i) => i - 1)}>
                Atrás
              </Button>
            )}
            {isLast ? (
              <Button type="button" onClick={handleCreate} disabled={isCreating}>
                {isCreating ? "Creando..." : "Crear área"}
              </Button>
            ) : (
              <Button type="button" onClick={goNext}>
                Siguiente
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

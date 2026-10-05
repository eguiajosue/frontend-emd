"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, LayoutTemplate, Loader2, MoreHorizontal, Pencil, Search, Trash2 } from "lucide-react";
import { ConfirmAction } from "@/components/mockups/ConfirmAction";
import { InlineRename } from "@/components/mockups/InlineRename";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthToken } from "@/hooks/useEntity";
import {
  fetchMockupTemplate,
  mockupTemplateErrorMessage,
  useMockupTemplateMutations,
  useMockupTemplates,
} from "@/hooks/useMockupTemplates";
import { getErrorMessage } from "@/lib/api";
import { garmentLabel, isGarmentEnabled } from "@/lib/mockups/garments";
import { normalizeSearch } from "@/lib/mockups/flags";
import {
  TEMPLATE_NAME_MAX,
  buildTemplatePayload,
  cleanTemplateName,
  configFromTemplate,
  suggestTemplateName,
  thumbnailFits,
  unsupportedGarmentMessage,
} from "@/lib/mockups/templates";
import type { MockupConfig, MockupExport, MockupTemplateSummary } from "@/lib/mockups/types";
import { cn } from "@/lib/utils";

function ErrorNote({ children }: { children: string }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      {children}
    </p>
  );
}

/* --------------------------- Guardar como plantilla --------------------------- */

/**
 * "Guardar como plantilla": pide un nombre, saca una miniatura chica del
 * frente y guarda la config completa (prenda, colores y diseños) para toda
 * la empresa.
 */
export function SaveTemplateDialog({
  open,
  onOpenChange,
  config,
  exportThumbnail,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: MockupConfig;
  exportThumbnail: () => Promise<MockupExport>;
}) {
  const { create } = useMockupTemplateMutations();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(suggestTemplateName(config));
      setError(null);
      setSaving(false);
    }
    // Sólo al abrir: el nombre sugerido no debe pisar lo que se escribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const clean = cleanTemplateName(name);
    if (!clean) {
      setError("Ponle un nombre a la plantilla.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let thumbnail: MockupExport;
      try {
        thumbnail = await exportThumbnail();
      } catch (err) {
        setError(
          err instanceof Error && err.message.startsWith("El 3D")
            ? err.message
            : "No se pudo generar la miniatura. Espera a que cargue la prenda e intenta de nuevo."
        );
        return;
      }
      if (!thumbnailFits(thumbnail)) {
        setError("La miniatura salió demasiado pesada. Intenta de nuevo.");
        return;
      }
      await create.mutateAsync(buildTemplatePayload(clean, config, thumbnail));
      toast.success(`Plantilla «${clean}» guardada`);
      onOpenChange(false);
    } catch (err) {
      setError(mockupTemplateErrorMessage(err, "No se pudo guardar la plantilla."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Guardar como plantilla</DialogTitle>
          <DialogDescription>
            Guarda la prenda, los colores y los diseños para reusarlos. Toda la recepción la verá en «Plantillas».
          </DialogDescription>
        </DialogHeader>
        <form id="save-mockup-template" onSubmit={submit} className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-label">Nombre de la plantilla</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={TEMPLATE_NAME_MAX}
              placeholder="Ej. Uniforme Colegio San Marcos"
              autoFocus
              className="h-11"
            />
          </label>
          <p className="text-meta">
            {garmentLabel(config.garment)} · {config.layers.length === 1 ? "1 diseño" : `${config.layers.length} diseños`}
          </p>
          {error && <ErrorNote>{error}</ErrorNote>}
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="save-mockup-template" disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            Guardar plantilla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------- Plantillas -------------------------------- */

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

function TemplateCard({
  template,
  applying,
  disabled,
  onApply,
  onRename,
  onDelete,
}: {
  template: MockupTemplateSummary;
  applying: boolean;
  disabled: boolean;
  onApply: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const supported = isGarmentEnabled(template.garment);
  const meta = [garmentLabel(template.garment), template.createdBy?.name, formatDate(template.updatedAt || template.createdAt)]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="group flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft">
      <button
        type="button"
        onClick={onApply}
        disabled={disabled}
        aria-label={`Usar plantilla ${template.name}`}
        className="relative block aspect-square w-full overflow-hidden bg-[#f4f4f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60 disabled:cursor-wait"
      >
        {template.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={template.thumbnailUrl}
            alt=""
            loading="lazy"
            className={cn("h-full w-full object-contain transition-transform group-hover:scale-[1.03]", !supported && "opacity-60")}
          />
        ) : (
          <LayoutTemplate className="absolute inset-0 m-auto h-8 w-8 text-muted-foreground" aria-hidden />
        )}
        {!supported && (
          <span className="absolute left-2 top-2 rounded-full bg-card/95 px-2 py-0.5 text-[0.6875rem] font-semibold text-muted-foreground shadow-sm">
            Próximamente
          </span>
        )}
        {applying && (
          <span className="absolute inset-0 flex items-center justify-center bg-card/60">
            <Loader2 className="h-6 w-6 animate-spin" aria-label="Aplicando" />
          </span>
        )}
      </button>
      <div className="flex min-h-[3.75rem] items-start gap-1 p-2 pl-3">
        {renaming ? (
          <div className="min-w-0 flex-1">
            <InlineRename
              initial={template.name}
              label="Nuevo nombre de la plantilla"
              maxLength={TEMPLATE_NAME_MAX}
              onCancel={() => setRenaming(false)}
              onSave={(name) => {
                setRenaming(false);
                onRename(name);
              }}
            />
          </div>
        ) : (
          <>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="truncate text-sm font-semibold" title={template.name}>
                {template.name}
              </p>
              <p className="truncate text-meta" title={meta}>
                {meta}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground"
                  aria-label={`Opciones de ${template.name}`}
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setRenaming(true)}>
                  <Pencil className="h-4 w-4" /> Cambiar nombre
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4" /> Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </li>
  );
}

/**
 * Panel "Plantillas": las plantillas de la empresa con su miniatura. Usar una
 * reemplaza el mockup actual (pregunta antes si ya hay diseños).
 */
export function MockupTemplatesDialog({
  open,
  onOpenChange,
  hasWork,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Hay diseños en el estudio: aplicar pide confirmación. */
  hasWork: boolean;
  onApply: (config: MockupConfig, template: MockupTemplateSummary) => void;
}) {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  const { templates, isLoading, isError, refetch } = useMockupTemplates({ enabled: open });
  const { rename, remove } = useMockupTemplateMutations();
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<number | null>(null);
  const [confirmReplace, setConfirmReplace] = useState<{ template: MockupTemplateSummary; config: MockupConfig } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MockupTemplateSummary | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setMessage(null);
      setApplyingId(null);
    }
  }, [open]);

  const visible = useMemo(() => {
    const q = normalizeSearch(query);
    return q ? templates.filter((t) => normalizeSearch(t.name).includes(q)) : templates;
  }, [templates, query]);

  const finishApply = (template: MockupTemplateSummary, config: MockupConfig) => {
    onApply(config, template);
    toast.success(`Plantilla «${template.name}» aplicada`);
    onOpenChange(false);
  };

  const apply = async (template: MockupTemplateSummary) => {
    setMessage(null);
    if (!isGarmentEnabled(template.garment)) {
      setMessage(unsupportedGarmentMessage(template.garment));
      return;
    }
    setApplyingId(template.id);
    try {
      const detail = await fetchMockupTemplate(queryClient, token, template.id);
      const result = configFromTemplate(detail);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      if (hasWork) setConfirmReplace({ template, config: result.config });
      else finishApply(template, result.config);
    } catch (err) {
      setMessage(getErrorMessage(err, "No se pudo abrir la plantilla. Intenta de nuevo."));
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Plantillas</DialogTitle>
            <DialogDescription>Mockups guardados por la recepción. Elige uno para empezar desde ahí.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {templates.length > 0 && (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar plantilla…"
                  aria-label="Buscar plantilla"
                  className="h-10 rounded-full pl-10"
                />
              </div>
            )}
            {message && <ErrorNote>{message}</ErrorNote>}

            {isLoading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="aspect-[4/5] w-full rounded-2xl" />
                ))}
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
                <p>No se pudieron cargar las plantillas.</p>
                <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
                  Reintentar
                </Button>
              </div>
            ) : templates.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-6 py-10 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted" aria-hidden>
                  <LayoutTemplate className="h-5 w-5 text-muted-foreground" />
                </span>
                <p className="font-semibold">Todavía no hay plantillas</p>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Arma un mockup y usa «Guardar como plantilla» para reusarlo después.
                </p>
              </div>
            ) : visible.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Ninguna plantilla coincide con la búsqueda.</p>
            ) : (
              <ul aria-label="Plantillas guardadas" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {visible.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    applying={applyingId === template.id}
                    disabled={applyingId !== null}
                    onApply={() => void apply(template)}
                    onRename={(name) =>
                      rename.mutate(
                        { id: template.id, name },
                        { onSuccess: () => toast.success("Nombre actualizado") }
                      )
                    }
                    onDelete={() => setConfirmDelete(template)}
                  />
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmAction
        open={confirmReplace !== null}
        onOpenChange={(next) => !next && setConfirmReplace(null)}
        title="¿Reemplazar el mockup actual?"
        description="La plantilla cambia la prenda, los colores y los diseños. Lo que tienes ahora en el estudio se pierde si no lo descargaste o guardaste."
        confirmLabel="Usar plantilla"
        onConfirm={() => {
          if (confirmReplace) finishApply(confirmReplace.template, confirmReplace.config);
        }}
      />

      <ConfirmAction
        open={confirmDelete !== null}
        onOpenChange={(next) => !next && setConfirmDelete(null)}
        title="¿Eliminar plantilla?"
        description={`«${confirmDelete?.name ?? ""}»${confirmDelete?.createdBy?.name ? ` (de ${confirmDelete.createdBy.name})` : ""} se borra para toda la recepción. Esto no se puede deshacer.`}
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          const target = confirmDelete;
          if (!target) return;
          remove.mutate(target.id, { onSuccess: () => toast.success(`Plantilla «${target.name}» eliminada`) });
        }}
      />
    </>
  );
}

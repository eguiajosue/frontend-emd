"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ClipboardPaste,
  Copy,
  FilterX,
  Plus,
  ReceiptText,
  Search,
  X,
} from "lucide-react";
import Title from "@/components/Title";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CardsSkeleton, ErrorState } from "@/components/feedback/states";
import { QuoteCard } from "@/components/quotes/QuoteCard";
import { QuoteFormDialog } from "@/components/quotes/QuoteFormDialog";
import { PasteWhatsAppDialog } from "@/components/quotes/PasteWhatsAppDialog";
import { QUOTE_STATUS_STYLES } from "@/components/quotes/quoteStyles";
import { CreateOrderDialog } from "@/components/orders/CreateOrderDialog";
import { usePermissions } from "@/hooks/usePermissions";
import { useEntityList } from "@/hooks/useEntity";
import { useQuoteMutations, useQuotes } from "@/hooks/useQuotes";
import { matchesSearch } from "@/lib/quotes/clients";
import { formatWhatsAppList } from "@/lib/quotes/formatWhatsApp";
import { isTypingTarget } from "@/lib/shortcuts";
import {
  COMMENT_STATUSES,
  DEFAULT_QUOTE_DESCRIPTION,
  QUOTE_STAGES,
  QUOTE_STAGE_LABELS,
  QUOTE_STATUSES_BY_STAGE,
  QUOTE_STATUS_LABELS,
  stageOfStatus,
  type CreateQuotePayload,
  type Quote,
  type QuoteStage,
  type QuoteStatus,
} from "@/lib/quotes/types";
import { cn } from "@/lib/utils";
import type { Client } from "@/types";

/**
 * Cotizaciones de Recepción (docs/plans/cotizaciones.md): pestañas Por
 * enviar / Enviadas, filtro por subestado y búsqueda; alta rápida (tecla N),
 * pegar el listado de WhatsApp, copiarlo de vuelta y convertir una aceptada
 * en pedido. Sólo Recepción y administración (el backend también lo exige).
 */
export default function QuotesPage() {
  const { canManageOperations, isSessionLoading, roles } = usePermissions();
  const noAccess = !isSessionLoading && roles.length > 0 && !canManageOperations;

  if (noAccess) {
    return (
      <EmptyState
        icon={ReceiptText}
        title="Sin acceso a Cotizaciones"
        description="Las cotizaciones las llevan Recepción y administración."
      />
    );
  }
  return <QuotesBoard />;
}

/** Copia al portapapeles; en navegadores viejos o sin permiso, con un textarea oculto. */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Se intenta el plan B.
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

const plural = (n: number) => `${n} ${n === 1 ? "cotización" : "cotizaciones"}`;

function QuotesBoard() {
  const { quotes, isLoading, isError, refetch } = useQuotes();
  const { data: clients } = useEntityList<Client>("clients");
  const { create, bulkCreate, update, remove, linkOrder } = useQuoteMutations();

  const [stage, setStage] = useState<QuoteStage>("por_enviar");
  const [statusFilter, setStatusFilter] = useState<Record<QuoteStage, QuoteStatus | null>>({
    por_enviar: null,
    enviada: null,
  });
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Quote | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [deleting, setDeleting] = useState<Quote | null>(null);
  const [converting, setConverting] = useState<Quote | null>(null);
  const [commentEditId, setCommentEditId] = useState<number | null>(null);

  // Atajo "N": nueva cotización (como en Pedidos), salvo escribiendo o con un diálogo abierto.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "n" && e.key !== "N") return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      if (isTypingTarget(e.target)) return;
      if (document.querySelector("[role=dialog], [role=alertdialog]")) return;
      e.preventDefault();
      setEditing(null);
      setFormOpen(true);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const matching = useMemo(
    () => quotes.filter((q) => matchesSearch([q.clientName, q.description, q.comment], search)),
    [quotes, search]
  );
  const byStage = useMemo(() => {
    const out: Record<QuoteStage, Quote[]> = { por_enviar: [], enviada: [] };
    for (const q of matching) out[q.stage].push(q);
    return out;
  }, [matching]);
  const statusCounts = useMemo(() => {
    const out = {} as Record<QuoteStatus, number>;
    for (const q of matching) out[q.status] = (out[q.status] ?? 0) + 1;
    return out;
  }, [matching]);

  const visibleFor = (s: QuoteStage) => {
    const filter = statusFilter[s];
    return filter ? byStage[s].filter((q) => q.status === filter) : byStage[s];
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter({ por_enviar: null, enviada: null });
  };

  /* ------------------------------- Acciones ------------------------------- */

  const undoTo = useCallback(
    (quote: Quote) => () => update.mutate({ id: quote.id, payload: { status: quote.status } }),
    [update]
  );

  const changeStatus = (quote: Quote, status: QuoteStatus) => {
    update.mutate({ id: quote.id, payload: { status } });
    if (COMMENT_STATUSES.includes(status) && !quote.comment) setCommentEditId(quote.id);
    const nextStage = stageOfStatus(status);
    if (nextStage !== quote.stage) {
      toast.success(`${quote.clientName}: ${QUOTE_STATUS_LABELS[status]}`, {
        description: `Pasó a ${QUOTE_STAGE_LABELS[nextStage]}.`,
        action: { label: "Deshacer", onClick: undoTo(quote) },
      });
    }
  };

  const markSent = (quote: Quote) => {
    update.mutate({ id: quote.id, payload: { stage: "enviada" } });
    toast.success(`${quote.clientName}: enviada`, {
      description: "Quedó en Enviadas, esperando respuesta.",
      action: { label: "Deshacer", onClick: undoTo(quote) },
    });
  };

  const markPending = (quote: Quote) => {
    update.mutate({ id: quote.id, payload: { stage: "por_enviar" } });
    toast.success(`${quote.clientName}: regresó a Por enviar`, {
      action: { label: "Deshacer", onClick: undoTo(quote) },
    });
  };

  const saveComment = (quote: Quote, comment: string | null) =>
    update.mutate({ id: quote.id, payload: { comment } });

  const submitForm = async (payload: CreateQuotePayload): Promise<boolean> => {
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, payload });
        toast.success("Cambios guardados");
      } else {
        const created = await create.mutateAsync(payload);
        toast.success("Cotización agregada", { description: created.clientName });
        setStage(created.stage);
        setStatusFilter((f) => ({ ...f, [created.stage]: null }));
      }
      return true;
    } catch {
      // El toast del error lo pone el feedback global (providers.tsx).
      return false;
    }
  };

  const submitBulk = async (items: CreateQuotePayload[]): Promise<boolean> => {
    try {
      const created = await bulkCreate.mutateAsync(items);
      toast.success(`${plural(created.length)} agregadas`);
      clearFilters();
      return true;
    } catch {
      return false;
    }
  };

  const confirmDelete = () => {
    if (!deleting) return;
    const quote = deleting;
    setDeleting(null);
    remove.mutate(quote.id, {
      onSuccess: () => toast.success("Cotización eliminada", { description: quote.clientName }),
    });
  };

  const copy = async (list: Quote[]) => {
    if (list.length === 0) {
      toast.info("No hay cotizaciones para copiar.");
      return;
    }
    const ok = await copyToClipboard(formatWhatsAppList(list));
    if (ok) toast.success(`Copiado: ${plural(list.length)}`, { description: "Listo para pegar en WhatsApp." });
    else toast.error("No se pudo copiar. Intenta de nuevo.");
  };

  const orderCreated = (quote: Quote, orderId: number) => {
    linkOrder.mutate(
      { id: quote.id, orderId },
      { onSuccess: () => toast.success(`Cotización ligada al pedido #${orderId}`) }
    );
  };

  /* -------------------------------- Vista --------------------------------- */

  const currentVisible = visibleFor(stage);
  const allForCopy = [...quotes.filter((q) => q.stage === "por_enviar"), ...quotes.filter((q) => q.stage === "enviada")];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Title title="Cotizaciones" />
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Button variant="outline" className="flex-1 gap-2 sm:flex-none" aria-label="Pegar de WhatsApp" onClick={() => setPasteOpen(true)}>
            <ClipboardPaste className="h-4 w-4" aria-hidden />
            <span className="sm:hidden">Pegar</span>
            <span className="hidden sm:inline">Pegar de WhatsApp</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex-1 gap-2 sm:flex-none" aria-label="Copiar para WhatsApp" disabled={quotes.length === 0}>
                <Copy className="h-4 w-4" aria-hidden />
                <span className="sm:hidden">Copiar</span>
                <span className="hidden sm:inline">Copiar para WhatsApp</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem className="flex-col items-start gap-0.5" onSelect={() => void copy(currentVisible)}>
                <span className="font-medium">Esta pestaña · {QUOTE_STAGE_LABELS[stage]}</span>
                <span className="text-meta">{plural(currentVisible.length)}, lo que está a la vista</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex-col items-start gap-0.5" onSelect={() => void copy(allForCopy)}>
                <span className="font-medium">Todas</span>
                <span className="text-meta">{plural(allForCopy.length)}, por enviar primero</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            className="w-full gap-2 sm:w-auto"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden /> Nueva cotización
            <kbd className="ml-1 hidden rounded border border-primary-foreground/30 px-1.5 text-[0.6875rem] font-medium opacity-80 sm:inline">
              N
            </kbd>
          </Button>
        </div>
      </div>

      <Tabs value={stage} onValueChange={(v) => setStage(v as QuoteStage)}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="w-full sm:w-auto">
            {QUOTE_STAGES.map((s) => (
              <TabsTrigger key={s} value={s} className="flex-1 gap-2 sm:flex-none">
                {QUOTE_STAGE_LABELS[s]}
                <span
                  data-testid={`count-${s}`}
                  className="rounded-full bg-foreground/10 px-1.5 text-xs tabular-nums"
                >
                  {byStage[s].length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              aria-label="Buscar cotización"
              placeholder="Buscar cliente o descripción…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 pl-9 pr-9 sm:h-9"
            />
            {search && (
              <button
                type="button"
                aria-label="Limpiar búsqueda"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {QUOTE_STAGES.map((s) => {
          const visible = visibleFor(s);
          const filter = statusFilter[s];
          return (
            <TabsContent key={s} value={s} className="mt-4 space-y-4">
              <div
                role="group"
                aria-label="Filtrar por subestado"
                className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden"
              >
                <FilterChip
                  label="Todas"
                  count={byStage[s].length}
                  active={filter === null}
                  onClick={() => setStatusFilter((f) => ({ ...f, [s]: null }))}
                />
                {QUOTE_STATUSES_BY_STAGE[s].map((st) => (
                  <FilterChip
                    key={st}
                    label={QUOTE_STATUS_LABELS[st]}
                    dot={QUOTE_STATUS_STYLES[st].dot}
                    count={statusCounts[st] ?? 0}
                    active={filter === st}
                    onClick={() => setStatusFilter((f) => ({ ...f, [s]: f[s] === st ? null : st }))}
                  />
                ))}
              </div>

              {isLoading ? (
                <CardsSkeleton count={4} />
              ) : isError ? (
                <ErrorState onRetry={() => void refetch()} />
              ) : visible.length === 0 ? (
                quotes.length === 0 ? (
                  <EmptyState
                    icon={ReceiptText}
                    title="Todavía no hay cotizaciones"
                    description="Agrega una o pega el listado que mandas por WhatsApp."
                    action={{ label: "Nueva cotización", icon: Plus, onClick: () => setFormOpen(true) }}
                    secondaryAction={{ label: "Pegar de WhatsApp", icon: ClipboardPaste, onClick: () => setPasteOpen(true) }}
                  />
                ) : search || filter ? (
                  <EmptyState
                    icon={FilterX}
                    title="Ninguna coincide"
                    description="Prueba con otra búsqueda o quita el filtro."
                    action={{ label: "Limpiar filtros", icon: FilterX, onClick: clearFilters }}
                  />
                ) : (
                  <EmptyState
                    icon={ReceiptText}
                    title={s === "por_enviar" ? "Nada por enviar" : "Ninguna enviada todavía"}
                    description={
                      s === "por_enviar"
                        ? "Todas las cotizaciones ya salieron. Buen trabajo."
                        : "Cuando marques una como enviada, aparece aquí."
                    }
                  />
                )
              ) : (
                <ul className="grid gap-3 xl:grid-cols-2" aria-label={`Cotizaciones ${QUOTE_STAGE_LABELS[s].toLowerCase()}`}>
                  {visible.map((quote) => (
                    <li key={quote.id}>
                      <QuoteCard
                        quote={quote}
                        onStatusChange={changeStatus}
                        onMarkSent={markSent}
                        onMarkPending={markPending}
                        onCommentSave={saveComment}
                        onEdit={(q) => {
                          setEditing(q);
                          setFormOpen(true);
                        }}
                        onDelete={setDeleting}
                        onConvert={setConverting}
                        editCommentOnMount={commentEditId === quote.id}
                        onCommentEditorOpened={() => setCommentEditId(null)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      <QuoteFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        clients={clients}
        quote={editing}
        defaultStage={stage}
        onSubmit={submitForm}
      />

      <PasteWhatsAppDialog open={pasteOpen} onOpenChange={setPasteOpen} clients={clients} onSubmit={submitBulk} />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar la cotización?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? `Se elimina la cotización de ${deleting.clientName}. ` : ""}
              {deleting?.orderId ? `El pedido #${deleting.orderId} no se toca. ` : ""}
              No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateOrderDialog
        open={converting !== null}
        onClose={() => setConverting(null)}
        initialClientId={converting?.clientId ?? undefined}
        initialClientNameOverride={converting && !converting.clientId ? converting.clientName : undefined}
        initialDescription={
          converting && converting.description.trim() !== DEFAULT_QUOTE_DESCRIPTION ? converting.description : undefined
        }
        onCreated={(order) => {
          if (converting && order?.id) orderCreated(converting, order.id);
          setConverting(null);
        }}
      />
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  dot,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  dot?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors sm:h-8",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border/70 bg-card text-foreground hover:bg-muted",
        count === 0 && !active && "text-muted-foreground"
      )}
    >
      {dot && <span className={cn("h-2 w-2 rounded-full", dot)} aria-hidden />}
      {label}
      <span className={cn("tabular-nums text-xs", active ? "opacity-80" : "text-muted-foreground")}>{count}</span>
    </button>
  );
}

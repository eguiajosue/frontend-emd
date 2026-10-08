"use client";

// Esta página es pública: nada más la carga, así que configura aquí la URL del backend.
import "@/lib/config";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  MessageSquareText,
  PartyPopper,
  Shirt,
  ThumbsUp,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { SizeSummary } from "@/components/sizes/SizeSummary";
import { ApiError, getErrorMessage, request } from "@/lib/api";
import { STAGE_COPY, type ClientResponseKind, type PortalView } from "@/lib/clientPortal";
import { GARMENT_LABELS } from "@/lib/mockups/types";
import { cn } from "@/lib/utils";

const portalKey = (token: string) => ["portal", token] as const;

function formatLongDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
}

/** Los tres cuadros de color del logo EMD. */
function BrandSquares({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("flex gap-1.5", className)}>
      <span className="h-2.5 w-2.5 rounded-[3px] bg-[hsl(var(--brand-cyan))]" />
      <span className="h-2.5 w-2.5 rounded-[3px] bg-[hsl(var(--brand-lime))]" />
      <span className="h-2.5 w-2.5 rounded-[3px] bg-[hsl(var(--brand-magenta))]" />
    </div>
  );
}

function Section({ title, children, delay = 0 }: { title: string; children: React.ReactNode; delay?: number }) {
  const reduced = useReducedMotion();
  return (
    <motion.section
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.16, 1, 0.3, 1] }}
      aria-label={title}
      className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft sm:p-6"
    >
      <h2 className="mb-4 font-heading text-lg font-semibold">{title}</h2>
      {children}
    </motion.section>
  );
}

/** Línea de etapas en vertical: lo hecho con palomita, la actual resaltada. */
function StageTimeline({ view }: { view: PortalView }) {
  const current = view.stages.findIndex((s) => s.key === view.stage.key);
  return (
    <ol className="space-y-0" aria-label="Etapas de tu pedido">
      {view.stages.map((stage, index) => {
        const done = index < current || (index === current && stage.key === "entregado");
        const active = index === current && !done;
        const last = index === view.stages.length - 1;
        return (
          <li key={stage.key} aria-current={active ? "step" : undefined} className="relative flex gap-3 pb-5 last:pb-0">
            {!last && (
              <span
                aria-hidden
                className={cn("absolute left-[0.6875rem] top-6 h-[calc(100%-1.25rem)] w-0.5", done ? "bg-foreground/70" : "bg-border")}
              />
            )}
            <span
              aria-hidden
              className={cn(
                "relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                done && "border-foreground bg-foreground text-background",
                active && "border-[hsl(var(--brand-magenta))] bg-[hsl(var(--brand-magenta))] text-white",
                !done && !active && "border-border bg-card"
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : active ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className={cn("text-sm", active ? "font-semibold" : done ? "text-foreground/80" : "text-muted-foreground")}>
                {stage.label}
              </p>
              {active && <p className="mt-0.5 text-sm text-muted-foreground">{STAGE_COPY[stage.key]}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function useDataUrl(token: string, path: string, enabled = true) {
  return useQuery<{ dataUrl: string | null; filename?: string; mimeType: string }>({
    queryKey: ["portal", token, path],
    queryFn: () => request(`portal/${token}/${path}`),
    enabled,
    staleTime: Infinity,
    meta: { silentError: true },
  });
}

/** Descarga un data URL como archivo (los PDFs no se pueden abrir como data: en otra pestaña). */
function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function DesignFile({ token, file, onZoom }: { token: string; file: { id: number; filename: string; mimeType: string }; onZoom: (src: string, alt: string) => void }) {
  const isPdf = file.mimeType === "application/pdf";
  const query = useDataUrl(token, `design-files/${file.id}`);
  if (query.isPending) return <Skeleton className="aspect-[4/3] w-full rounded-2xl" />;
  if (!query.data?.dataUrl) return <p className="text-sm text-muted-foreground">No se pudo cargar {file.filename}.</p>;
  if (isPdf) {
    return (
      <Button variant="outline" className="h-auto w-full justify-start gap-3 rounded-2xl p-4" onClick={() => downloadDataUrl(query.data!.dataUrl!, file.filename)}>
        <FileText className="h-5 w-5 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-left">{file.filename}</span>
        <Download className="h-4 w-4 shrink-0" aria-hidden />
      </Button>
    );
  }
  return (
    <button type="button" onClick={() => onZoom(query.data!.dataUrl!, file.filename)} className="block w-full overflow-hidden rounded-2xl border border-border/60 bg-muted/40" aria-label={`Ver ${file.filename} en grande`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={query.data.dataUrl} alt={file.filename} className="max-h-[28rem] w-full object-contain" />
    </button>
  );
}

function MockupImage({ token, mockup, onZoom }: { token: string; mockup: { id: number; garment: string }; onZoom: (src: string, alt: string) => void }) {
  const query = useDataUrl(token, `mockups/${mockup.id}`);
  const label = GARMENT_LABELS[mockup.garment as keyof typeof GARMENT_LABELS] ?? "Mockup";
  if (query.isPending) return <Skeleton className="aspect-square w-full rounded-2xl" />;
  if (!query.data?.dataUrl) return null;
  return (
    <button type="button" onClick={() => onZoom(query.data!.dataUrl!, label)} className="overflow-hidden rounded-2xl border border-border/60 bg-muted/40" aria-label={`Ver mockup de ${label} en grande`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={query.data.dataUrl} alt={`Mockup: ${label}`} className="aspect-square w-full object-contain" />
    </button>
  );
}

function ResponseBox({ token, view }: { token: string; view: PortalView }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<ClientResponseKind | null>(null);
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);
  const mutation = useMutation({
    mutationFn: (body: { kind: ClientResponseKind; comment?: string }) =>
      request(`portal/${token}/respond`, { method: "POST", body }),
    onSuccess: () => {
      setMode(null);
      setComment("");
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: portalKey(token) });
    },
    meta: { ownErrorToast: true },
  });
  const design = view.design;
  if (!design) return null;
  const response = view.response;

  if (design.approved || response?.status === "aplicada") {
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 p-4 text-sm font-medium text-emerald-800 dark:text-emerald-300">
        <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
        {design.approved ? "Diseño aprobado. ¡Ya está en producción!" : "Recibimos tus cambios: Diseño ya está trabajando en ellos."}
      </p>
    );
  }
  if (!design.awaitingResponse) return null;

  if (response?.status === "pendiente" && !editing) {
    return (
      <div role="status" className="space-y-3 rounded-2xl bg-muted/60 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <PartyPopper className="h-5 w-5 shrink-0 text-[hsl(var(--brand-magenta))]" aria-hidden />
          ¡Gracias! Recibimos tu respuesta.
        </p>
        <p className="text-sm text-muted-foreground">
          {response.kind === "aprobar" ? "Aprobaste el diseño." : `Pediste cambios: "${response.comment}".`} En breve te confirmamos.
        </p>
        <Button variant="link" className="h-auto p-0" onClick={() => setEditing(true)}>
          Cambiar mi respuesta
        </Button>
      </div>
    );
  }

  const submit = () => {
    if (!mode) return;
    const text = comment.trim();
    if (mode === "cambios" && !text) return;
    mutation.mutate({ kind: mode, comment: text || undefined });
  };

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button size="lg" className="h-12 gap-2 rounded-2xl text-base" onClick={() => setMode("aprobar")}>
          <ThumbsUp className="h-5 w-5" aria-hidden />
          Aprobar diseño
        </Button>
        <Button size="lg" variant="outline" className="h-12 gap-2 rounded-2xl text-base" onClick={() => setMode("cambios")}>
          <MessageSquareText className="h-5 w-5" aria-hidden />
          Pedir cambios
        </Button>
      </div>
      <Dialog open={mode !== null} onOpenChange={(open) => !open && setMode(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{mode === "aprobar" ? "¿Aprobamos tu diseño?" : "¿Qué te gustaría cambiar?"}</DialogTitle>
            <DialogDescription>
              {mode === "aprobar"
                ? "Con tu aprobación pasamos tu pedido a producción."
                : "Cuéntanos con detalle: colores, tamaño, textos, posición…"}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={2000}
            rows={4}
            aria-label="Comentario"
            placeholder={mode === "aprobar" ? "Comentario (opcional)" : "Ej.: el logo un poco más grande y en azul marino"}
          />
          {mutation.isError && (
            <p className="text-sm text-destructive">{getErrorMessage(mutation.error, "No se pudo enviar tu respuesta.")}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={mutation.isPending || (mode === "cambios" && !comment.trim())}>
              {mutation.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {mode === "aprobar" ? "Sí, aprobar" : "Enviar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Shell({ children, branch }: { children: React.ReactNode; branch?: PortalView["order"]["branch"] }) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border/60 bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <BrandLogo className="h-7" priority />
          {branch && (
            <span className="ml-auto flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
              {branch.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branch.logo} alt={branch.name} className="h-7 w-auto max-w-[8rem] object-contain" />
              ) : (
                <span className="truncate">{branch.name}</span>
              )}
            </span>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">{children}</main>
      <footer className="mx-auto flex max-w-2xl items-center gap-2 px-4 pb-8 pt-2 text-xs text-muted-foreground">
        <BrandSquares />
        EMD marketing &amp; design
      </footer>
    </div>
  );
}

/** El pedido visto por el cliente desde su enlace privado. */
export function ClientPortalPage({ token }: { token: string }) {
  const reduced = useReducedMotion();
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null);
  const query = useQuery<PortalView>({
    queryKey: portalKey(token),
    queryFn: () => request<PortalView>(`portal/${token}`),
    meta: { silentError: true },
    retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
  });

  if (query.isPending) {
    return (
      <Shell>
        <Skeleton className="h-36 w-full rounded-3xl" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </Shell>
    );
  }
  if (query.isError || !query.data) {
    const status = query.error instanceof ApiError ? query.error.status : 0;
    return (
      <Shell>
        <div className="rounded-3xl border border-border/60 bg-card p-8 text-center shadow-soft">
          <BrandSquares className="mb-4 justify-center" />
          <h1 className="font-heading text-xl font-semibold">
            {status === 410 ? "Este enlace ya venció" : status === 404 ? "No encontramos este pedido" : "No pudimos cargar tu pedido"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {status === 410 || status === 404
              ? "Pídenos un enlace nuevo y con gusto te lo mandamos."
              : "Revisa tu conexión e inténtalo de nuevo."}
          </p>
          {status !== 410 && status !== 404 && (
            <Button className="mt-5" onClick={() => query.refetch()}>
              Reintentar
            </Button>
          )}
        </div>
      </Shell>
    );
  }

  const view = query.data;
  const delivery = formatLongDate(view.order.deliveryDate);
  const awaiting = view.design?.awaitingResponse;

  return (
    <Shell branch={view.order.branch}>
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-3xl bg-ink p-6 text-ink-foreground shadow-soft-md dark:border dark:border-border/60 dark:bg-card dark:text-foreground"
      >
        <BrandSquares className="mb-4" />
        <p className="text-sm opacity-80">{view.order.clientName ? `Hola, ${view.order.clientName}` : "Hola"}</p>
        <h1 className="mt-1 font-heading text-2xl font-bold leading-tight sm:text-3xl">{view.order.description}</h1>
        <p className="mt-1 text-sm tabular-nums opacity-80">Pedido #{view.order.id}</p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold",
              view.stage.key === "cancelado" ? "bg-white/15" : "bg-[hsl(var(--brand-lime))] text-ink"
            )}
          >
            {view.stage.label}
          </span>
          {delivery && view.stage.key !== "entregado" && view.stage.key !== "cancelado" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-sm dark:bg-muted">
              <CalendarDays className="h-4 w-4" aria-hidden />
              Entrega: {delivery}
            </span>
          )}
        </div>
      </motion.div>

      {view.design && (view.design.files.length > 0 || view.mockups.length > 0) && (
        <Section title={awaiting ? "Tu diseño está listo para revisar" : `Tu diseño · versión ${view.design.round}`} delay={0.05}>
          <div className="space-y-3">
            {view.design.files.map((file) => (
              <DesignFile key={file.id} token={token} file={file} onZoom={(src, alt) => setZoom({ src, alt })} />
            ))}
            {view.mockups.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {view.mockups.map((m) => (
                  <MockupImage key={m.id} token={token} mockup={m} onZoom={(src, alt) => setZoom({ src, alt })} />
                ))}
              </div>
            )}
            <div className="pt-2">
              <ResponseBox token={token} view={view} />
            </div>
          </div>
        </Section>
      )}

      <Section title="¿En qué va tu pedido?" delay={0.1}>
        <StageTimeline view={view} />
      </Section>

      {view.products.length > 0 && (
        <Section title="Lo que pediste" delay={0.15}>
          <ul className="divide-y divide-border/60">
            {view.products.map((p, i) => (
              <li key={i} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground" aria-hidden>
                  <Shirt className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{p.name}</p>
                  <SizeSummary sizes={p.sizes} className="text-sm text-muted-foreground" />
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-sm font-semibold tabular-nums">
                  {p.quantity} pza{p.quantity === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Dialog open={zoom !== null} onOpenChange={(open) => !open && setZoom(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate">{zoom?.alt}</DialogTitle>
          </DialogHeader>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {zoom && <img src={zoom.src} alt={zoom.alt} className="max-h-[75vh] w-full object-contain" />}
        </DialogContent>
      </Dialog>
    </Shell>
  );
}

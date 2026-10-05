"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, ImageOff, Loader2, MoreHorizontal, Pencil, Pin, Search, Trash2, Upload } from "lucide-react";
import { CHECKERBOARD_CLASS } from "@/components/mockups/MockupLayerList";
import { ConfirmAction } from "@/components/mockups/ConfirmAction";
import { InlineRename } from "@/components/mockups/InlineRename";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthToken } from "@/hooks/useEntity";
import { useInView } from "@/hooks/useInView";
import {
  fetchMockupLogoImage,
  mockupLogoErrorMessage,
  useMockupLogoThumbnail,
  useMockupLogoMutations,
  useMockupLogos,
  LOGO_TOO_LARGE_MESSAGE,
} from "@/hooks/useMockupLogos";
import { getFlags, PINNED_FLAG_CODES, flagLayerName, normalizeSearch, searchFlags, type FlagEntry } from "@/lib/mockups/flags";
import {
  DESIGN_ACCEPT,
  designFromDataUrl,
  importDesignFile,
  importDesignFromUrl,
  makeLogoThumbnail,
  type ImportedDesign,
} from "@/lib/mockups/importDesign";
import { dataUrlBytes } from "@/lib/mockups/dataUrl";
import { MAX_LOGO_BYTES, type MockupLogoSummary } from "@/lib/mockups/types";
import { cn } from "@/lib/utils";

export type LibraryTab = "logos" | "banderas";

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder.replace(/…$/, "")}
        className="h-10 rounded-full pl-10"
      />
    </div>
  );
}

/* ---------------------------------- Logos ---------------------------------- */

function LogoCard({
  logo,
  busy,
  disabled,
  onPick,
  onRename,
  onDelete,
}: {
  logo: MockupLogoSummary;
  busy: boolean;
  disabled: boolean;
  onPick: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [ref, inView] = useInView<HTMLLIElement>();
  const image = useMockupLogoThumbnail(logo.id, { enabled: inView });
  const [renaming, setRenaming] = useState(false);

  return (
    <li ref={ref} className="group flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card">
      <button
        type="button"
        onClick={onPick}
        disabled={disabled}
        aria-label={`Agregar logo ${logo.name}`}
        className={cn(
          "relative flex aspect-square w-full items-center justify-center overflow-hidden p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60 disabled:cursor-wait",
          CHECKERBOARD_CLASS
        )}
      >
        {image.data?.dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.data.dataUrl}
            alt=""
            className="max-h-full max-w-full object-contain transition-transform group-hover:scale-105"
          />
        ) : image.isError ? (
          <ImageOff className="h-6 w-6 text-muted-foreground" aria-hidden />
        ) : (
          <Skeleton className="h-3/5 w-3/5 rounded-xl" />
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-card/60">
            <Loader2 className="h-6 w-6 animate-spin" aria-label="Agregando" />
          </span>
        )}
      </button>
      <div className="flex min-h-[3rem] items-center gap-1 border-t border-border/60 p-1.5 pl-2.5">
        {renaming ? (
          <div className="min-w-0 flex-1">
            <InlineRename
              initial={logo.name}
              label="Nuevo nombre del logo"
              onCancel={() => setRenaming(false)}
              onSave={(name) => {
                setRenaming(false);
                onRename(name);
              }}
            />
          </div>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 break-words text-[0.8125rem] font-medium leading-snug" title={logo.name}>
                {logo.name}
              </p>
              <p className="truncate text-[0.6875rem] text-muted-foreground">
                {logo.useCount === 1 ? "1 uso" : `${logo.useCount} usos`}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground"
                  aria-label={`Opciones de ${logo.name}`}
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

function LogosTab({ onPick }: { onPick: (design: ImportedDesign) => Promise<void> | void }) {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  const { logos, isLoading, isError, refetch } = useMockupLogos();
  const { upload, rename, remove, markUsed } = useMockupLogoMutations();
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MockupLogoSummary | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => {
    const q = normalizeSearch(query);
    return q ? logos.filter((l) => normalizeSearch(l.name).includes(q)) : logos;
  }, [logos, query]);

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of files) {
        try {
          // Mismo camino que un diseño subido: PNG ≤ 1024 px.
          const design = await importDesignFile(file);
          if (dataUrlBytes(design.dataUrl) > MAX_LOGO_BYTES) {
            setError(LOGO_TOO_LARGE_MESSAGE);
            continue;
          }
          const thumbnailDataUrl = await makeLogoThumbnail(design.dataUrl);
          await upload.mutateAsync({ name: design.name, imageDataUrl: design.dataUrl, thumbnailDataUrl });
          toast.success(`Logo «${design.name}» guardado en la biblioteca`);
        } catch (err) {
          setError(mockupLogoErrorMessage(err, `No se pudo subir «${file.name}».`));
        }
      }
    } finally {
      setUploading(false);
    }
  };

  const pick = async (logo: MockupLogoSummary) => {
    setBusyId(logo.id);
    setError(null);
    try {
      const { dataUrl } = await fetchMockupLogoImage(queryClient, token, logo.id);
      const design = await designFromDataUrl(logo.name, dataUrl);
      // Antes de agregarlo: al agregar se cierra el diálogo.
      markUsed.mutate(logo.id);
      await onPick(design);
    } catch (err) {
      setError(mockupLogoErrorMessage(err, `No se pudo cargar «${logo.name}».`));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        multiple
        accept={DESIGN_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-label="Subir logo a la biblioteca"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          void uploadFiles(files);
        }}
      />
      <div className="flex items-center gap-2">
        <SearchBox value={query} onChange={setQuery} placeholder="Buscar logo…" />
        <Button type="button" className="h-10 shrink-0" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
          Subir logo
        </Button>
      </div>
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {isLoading ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-[4/5] w-full rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
          <p>No se pudieron cargar los logos.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      ) : logos.length === 0 ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border bg-muted/30 px-6 py-10 text-center transition-colors hover:border-ink/40 hover:bg-muted/60"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-soft" aria-hidden>
            <Upload className="h-5 w-5 text-foreground/70" />
          </span>
          <span className="font-semibold">La biblioteca está vacía</span>
          <span className="max-w-xs text-sm text-muted-foreground">
            Sube los logos que más usan los clientes; toda la recepción los verá aquí.
          </span>
        </button>
      ) : visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Ningún logo coincide con «{query.trim()}».</p>
      ) : (
        <ul aria-label="Logos de la empresa" className="grid grid-cols-2 gap-3 min-[420px]:grid-cols-3 sm:grid-cols-4">
          {visible.map((logo) => (
            <LogoCard
              key={logo.id}
              logo={logo}
              busy={busyId === logo.id}
              disabled={busyId !== null}
              onPick={() => void pick(logo)}
              onRename={(name) =>
                rename.mutate({ id: logo.id, name }, { onSuccess: () => toast.success("Nombre actualizado") })
              }
              onDelete={() => setConfirmDelete(logo)}
            />
          ))}
        </ul>
      )}

      <ConfirmAction
        open={confirmDelete !== null}
        onOpenChange={(next) => !next && setConfirmDelete(null)}
        title="¿Eliminar logo?"
        description={`«${confirmDelete?.name ?? ""}»${confirmDelete?.createdBy?.name ? ` (subido por ${confirmDelete.createdBy.name})` : ""} se quita de la biblioteca para toda la recepción. Los mockups que ya lo usan no cambian.`}
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          const target = confirmDelete;
          if (!target) return;
          remove.mutate(target.id, { onSuccess: () => toast.success(`Logo «${target.name}» eliminado`) });
        }}
      />
    </div>
  );
}

/* --------------------------------- Banderas --------------------------------- */

function FlagTile({
  flag,
  pinned,
  busy,
  disabled,
  onPick,
}: {
  flag: FlagEntry;
  pinned: boolean;
  busy: boolean;
  disabled: boolean;
  onPick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        disabled={disabled}
        aria-label={`Agregar bandera de ${flag.name}`}
        className="group flex w-full flex-col items-stretch gap-1.5 rounded-xl p-1.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-wait"
      >
        <span className="relative block aspect-[4/3] w-full overflow-hidden rounded-md border border-border/70 bg-muted shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={flag.url}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
          {busy && (
            <span className="absolute inset-0 flex items-center justify-center bg-card/60">
              <Loader2 className="h-5 w-5 animate-spin" aria-label="Agregando" />
            </span>
          )}
        </span>
        <span className="flex min-w-0 items-center gap-1 px-0.5">
          {pinned && <Pin className="h-3 w-3 shrink-0 fill-current text-muted-foreground" aria-label="Fija" />}
          <span className="truncate text-[0.8125rem] leading-tight" title={flag.name}>
            {flag.name}
          </span>
        </span>
      </button>
    </li>
  );
}

function FlagsTab({ onPick }: { onPick: (design: ImportedDesign) => Promise<void> | void }) {
  const [query, setQuery] = useState("");
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const flags = getFlags();
  const visible = useMemo(() => searchFlags(query, flags), [query, flags]);

  const pick = async (flag: FlagEntry) => {
    setBusyCode(flag.code);
    setError(null);
    try {
      const design = await importDesignFromUrl(flag.url, flagLayerName(flag));
      await onPick(design);
    } catch (err) {
      setError(err instanceof Error ? err.message : `No se pudo agregar la bandera de ${flag.name}.`);
    } finally {
      setBusyCode(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <SearchBox value={query} onChange={setQuery} placeholder="Buscar país…" />
        <span className="hidden shrink-0 text-meta tabular-nums sm:inline">
          {visible.length === flags.length ? `${flags.length} países` : `${visible.length} de ${flags.length}`}
        </span>
      </div>
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}
      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Ningún país coincide con «{query.trim()}».</p>
      ) : (
        <ul aria-label="Banderas" className="grid grid-cols-3 gap-1 min-[420px]:grid-cols-4 sm:grid-cols-5">
          {visible.map((flag) => (
            <FlagTile
              key={flag.code}
              flag={flag}
              pinned={!query.trim() && (PINNED_FLAG_CODES as readonly string[]).includes(flag.code)}
              busy={busyCode === flag.code}
              disabled={busyCode !== null}
              onPick={() => void pick(flag)}
            />
          ))}
        </ul>
      )}
      <p className="pt-1 text-[0.6875rem] text-muted-foreground">Banderas: flag-icons (licencia MIT).</p>
    </div>
  );
}

/* --------------------------------- Diálogo --------------------------------- */

/**
 * Biblioteca del estudio: logos de la empresa (compartidos, más usados
 * primero) y banderas de todos los países. Elegir uno lo agrega como diseño.
 */
export function MockupLibraryDialog({
  open,
  onOpenChange,
  onAddDesign,
  defaultTab = "logos",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddDesign: (design: ImportedDesign) => void;
  defaultTab?: LibraryTab;
}) {
  const [tab, setTab] = useState<LibraryTab>(defaultTab);
  useEffect(() => {
    if (open) setTab(defaultTab);
  }, [open, defaultTab]);

  const add = (design: ImportedDesign) => {
    onAddDesign(design);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Biblioteca</DialogTitle>
          <DialogDescription>Elige un logo de la empresa o una bandera para agregarlo a la prenda.</DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as LibraryTab)} className="min-w-0">
          <TabsList className="grid w-full grid-cols-2 sm:w-72">
            <TabsTrigger value="logos">Logos</TabsTrigger>
            <TabsTrigger value="banderas">Banderas</TabsTrigger>
          </TabsList>
          <div className="mt-3 sm:h-[min(60vh,34rem)] sm:overflow-y-auto sm:overscroll-contain sm:pr-1">
            <TabsContent value="logos" className="mt-0">
              {open && tab === "logos" && <LogosTab onPick={add} />}
            </TabsContent>
            <TabsContent value="banderas" className="mt-0">
              {open && tab === "banderas" && <FlagsTab onPick={add} />}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

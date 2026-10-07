"use client";

import { MockupSizesPanel } from "@/components/mockups/MockupSizesPanel";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { toast } from "sonner";
import { BookImage, Download, ImagePlus, LayoutTemplate, Loader2, Paperclip, RotateCcw, Save } from "lucide-react";
import MockupCanvasLazy from "@/components/mockups/MockupCanvasLazy";
import { MockupColorField, type MyColorsControls } from "@/components/mockups/MockupColorField";
import { MockupLayerList } from "@/components/mockups/MockupLayerList";
import { MockupLibraryDialog } from "@/components/mockups/MockupLibrary";
import { MockupTemplatesDialog, SaveTemplateDialog } from "@/components/mockups/MockupTemplates";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useMockupColors } from "@/hooks/useMockupColors";
import { downloadFromUrl } from "@/lib/download";
import { enabledGarments, isGarmentEnabled } from "@/lib/mockups/garments";
import { DESIGN_ACCEPT, importDesignFile, isDesignFile, type ImportedDesign } from "@/lib/mockups/importDesign";
import { PLACEMENT_PRESETS, applyPreset, defaultPlacement } from "@/lib/mockups/presets";
import {
  COLOR_FIELDS,
  GARMENT_MODELS,
  MOCKUP_TOO_LARGE_MESSAGE,
  buildMockupPayload,
  createLayer,
  exceedsMockupLimit,
  initialMockupConfig,
  mockupFilename,
  switchGarment,
  type ColorPart,
  type MockupStudioResult,
} from "@/lib/mockups/studio";
import {
  type DesignLayer,
  type DesignPlacement,
  type Garment,
  type MockupCanvasHandle,
  type MockupConfig,
  type MockupView,
  type PlacementPreset,
} from "@/lib/mockups/types";
import { cn } from "@/lib/utils";

export interface MockupStudioProps {
  /** Texto del botón de adjuntar ("Adjuntar a pedido", "Agregar al pedido"…). */
  attachLabel?: string;
  /**
   * Recibe la lámina exportada y la configuración. Sin esta prop no se
   * muestra el botón de adjuntar (sólo "Descargar imagen").
   */
  onAttach?: (result: MockupStudioResult) => void | Promise<void>;
  /** "dialog": lienzo más bajo, para caber dentro de un diálogo. */
  variant?: "page" | "dialog";
  initialGarment?: Garment;
  /** Avisa si hay un diseño seleccionado (el diálogo no se cierra con Esc entonces). */
  onSelectionChange?: (selectedId: string | null) => void;
  className?: string;
}

const VIEW_BUTTONS: { label: string; views: MockupView[] }[] = [
  { label: "Frente", views: ["front"] },
  { label: "Espalda", views: ["back"] },
  { label: "Lado", views: ["left", "right"] },
];

/** Tamaño del diseño como % del tamaño inicial de la prenda. */
const SIZE_MIN = 20;
const SIZE_MAX = 300;

const RAD_TO_DEG = 180 / Math.PI;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

function sameSpot(a: DesignPlacement, b: PlacementPreset["placement"]): boolean {
  return a.position.every((v, i) => Math.abs(v - b.position[i]) < 1e-3);
}

function StudioSection({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="space-y-3 border-b border-border/60 px-4 py-4 last:border-b-0 sm:px-5">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

function LabeledSlider({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-label">{label}</span>
        <span className="text-meta tabular-nums">{display}</span>
      </div>
      <SliderPrimitive.Root
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([next]) => onChange(next)}
        className="relative flex h-6 w-full touch-none select-none items-center"
      >
        <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
          <SliderPrimitive.Range className="absolute h-full bg-ink" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          aria-label={label}
          aria-valuetext={display}
          className="block h-5 w-5 rounded-full border-2 border-ink bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </SliderPrimitive.Root>
    </div>
  );
}

/**
 * Estudio de mockups: lienzo 3D grande + panel de controles. Se usa igual en
 * la pantalla "Mockups", en "Nuevo pedido" y en el detalle del pedido; lo
 * único que cambia es qué hace "Adjuntar" (`onAttach`).
 *
 * En escritorio el panel va a la derecha con las acciones fijas abajo; en
 * celular se apila debajo del lienzo.
 */
export function MockupStudio({
  attachLabel = "Adjuntar a pedido",
  onAttach,
  variant = "page",
  initialGarment = "tshirt",
  onSelectionChange,
  className,
}: MockupStudioProps) {
  const [config, setConfig] = useState<MockupConfig>(() => initialMockupConfig(initialGarment));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<MockupView>("front");
  /** El usuario giró la prenda a mano: ningún botón de vista queda marcado. */
  const [freeView, setFreeView] = useState(false);
  const [importing, setImporting] = useState(false);
  const [busy, setBusy] = useState<null | "download" | "attach">(null);
  const [dialog, setDialog] = useState<null | "templates" | "save-template" | "library">(null);
  const myColors = useMockupColors();
  const myColorsControls: MyColorsControls = {
    entries: myColors.entries,
    onAdd: myColors.addColor,
    onToggleFavorite: (hex) => void myColors.toggleFavorite(hex),
    onRemove: (hex) => void myColors.removeColor(hex),
  };
  // Mientras se exporta, arrastrar en el lienzo tampoco cambia el mockup.
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const [dragging, setDragging] = useState(false);
  const canvasRef = useRef<MockupCanvasHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const configRef = useRef(config);
  configRef.current = config;
  const garment = config.garment;
  // El 3D no usa las tallas: sin esto, tipear en la grilla re-aplicaría la
  // config a la escena en cada tecla.
  const canvasConfig = useMemo<MockupConfig>(
    () => ({ garment: config.garment, colors: config.colors, layers: config.layers, options: config.options }),
    [config.garment, config.colors, config.layers, config.options]
  );
  const selected = config.layers.find((l) => l.id === selectedId) ?? null;
  const baseScale = defaultPlacement(garment).scale || 1;

  useEffect(() => {
    onSelectionChange?.(selectedId);
  }, [selectedId, onSelectionChange]);

  /* ------------------------------ Diseños ------------------------------- */

  /** Agrega diseños ya importados (archivo, logo de la biblioteca o bandera). */
  const addDesigns = useCallback((designs: ImportedDesign[]) => {
    if (designs.length === 0) return;
    const garmentNow = configRef.current.garment;
    const added: DesignLayer[] = designs.map((d) => createLayer(d, garmentNow));
    setConfig((prev) => ({
      ...prev,
      // La prenda pudo cambiar mientras se leía el archivo.
      layers: [
        ...prev.layers,
        ...added.map((l) => (prev.garment === garmentNow ? l : { ...l, placement: defaultPlacement(prev.garment) })),
      ],
    }));
    setSelectedId(added[added.length - 1].id);
  }, []);

  const addFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setImporting(true);
      const designs: ImportedDesign[] = [];
      for (const file of files) {
        try {
          designs.push(await importDesignFile(file));
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "No se pudo leer el diseño.");
        }
      }
      setImporting(false);
      addDesigns(designs);
    },
    [addDesigns]
  );

  const updateLayer = useCallback((id: string, update: (layer: DesignLayer) => DesignLayer) => {
    setConfig((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => (l.id === id ? update(l) : l)),
    }));
  }, []);

  const removeLayer = useCallback((id: string) => {
    setConfig((prev) => ({ ...prev, layers: prev.layers.filter((l) => l.id !== id) }));
    setSelectedId((prev) => (prev === id ? null : prev));
  }, []);

  const handlePlacementChange = useCallback(
    (id: string, placement: DesignPlacement) => {
      if (busyRef.current) return;
      updateLayer(id, (l) => ({ ...l, placement }));
    },
    [updateLayer]
  );

  const openFilePicker = () => fileInputRef.current?.click();

  // Pegar (Ctrl+V / ⌘V) una imagen copiada agrega un diseño. Pegar texto
  // sigue funcionando normal (no trae archivos).
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? []).filter(isDesignFile);
      if (files.length === 0) return;
      event.preventDefault();
      void addFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  /* --------------------------- Arrastrar y soltar --------------------------- */

  const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");

  const onDragOver = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    if (!dragging) setDragging(true);
  };
  const onDragLeave = (event: DragEvent) => {
    const next = event.relatedTarget as Node | null;
    if (!next || !rootRef.current?.contains(next)) setDragging(false);
  };
  const onDrop = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    setDragging(false);
    const files = Array.from(event.dataTransfer.files);
    const valid = files.filter(isDesignFile);
    if (valid.length < files.length) {
      toast.error("Sólo se pueden usar diseños PNG, JPG, SVG o WEBP.");
    }
    void addFiles(valid);
  };

  /* ------------------------------ Prenda y vistas ------------------------------ */

  const goToView = (next: MockupView) => {
    setView(next);
    setFreeView(false);
    canvasRef.current?.setView(next);
  };

  const changeGarment = (next: string) => {
    // Sólo las prendas habilitadas (sudadera y camisa siguen ocultas).
    if (!isGarmentEnabled(next)) return;
    setConfig((prev) => switchGarment(prev, next));
    goToView("front");
  };

  /** Plantilla aplicada: reemplaza todo el mockup. */
  const applyTemplate = (next: MockupConfig) => {
    setConfig(next);
    setSelectedId(null);
    goToView("front");
  };

  const exportThumbnail = () => {
    const handle = canvasRef.current;
    if (!handle) return Promise.reject(new Error("El 3D no está disponible en este navegador."));
    return handle.exportThumbnail();
  };

  const setColor = (part: ColorPart, value: string) =>
    setConfig((prev) => ({ ...prev, colors: { ...prev.colors, [part]: value } }));

  const applyPresetToSelected = (preset: PlacementPreset) => {
    if (!selected) return;
    updateLayer(selected.id, (layer) => applyPreset(layer, preset));
    goToView(preset.view);
  };

  /* ------------------------------ Teclado ------------------------------- */

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isTypingTarget(event.target)) return;
    if (!selectedId) return;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      removeLayer(selectedId);
    } else if (event.key === "Escape") {
      event.stopPropagation();
      setSelectedId(null);
    }
  };

  /* ------------------------------ Exportar ------------------------------ */

  const exportImage = async (): Promise<MockupStudioResult> => {
    const handle = canvasRef.current;
    if (!handle) throw new Error("El 3D no está disponible en este navegador.");
    const image = await handle.exportSheet(config.sizes);
    return { image, config };
  };

  const handleDownload = async () => {
    setBusy("download");
    try {
      const { image } = await exportImage();
      await downloadFromUrl(image.dataUrl, mockupFilename(garment));
    } catch (error) {
      toast.error(
        error instanceof Error && error.message.startsWith("El 3D")
          ? error.message
          : "No se pudo generar la imagen. Intenta de nuevo."
      );
    } finally {
      setBusy(null);
    }
  };

  const handleAttach = async () => {
    if (!onAttach) return;
    setBusy("attach");
    try {
      let result: MockupStudioResult;
      try {
        result = await exportImage();
      } catch (error) {
        toast.error(
          error instanceof Error && error.message.startsWith("El 3D")
            ? error.message
            : "No se pudo generar la imagen. Intenta de nuevo."
        );
        return;
      }
      if (exceedsMockupLimit(buildMockupPayload(result))) {
        toast.error(MOCKUP_TOO_LARGE_MESSAGE);
        return;
      }
      await onAttach(result);
    } finally {
      setBusy(null);
    }
  };

  /* ------------------------------ Render ------------------------------- */

  const presets = PLACEMENT_PRESETS[garment] ?? [];
  const sizePct = selected ? Math.round((selected.placement.scale / baseScale) * 100) : 100;
  const rotationDeg = selected ? Math.round(selected.placement.rotation * RAD_TO_DEG) : 0;

  return (
    <div
      ref={rootRef}
      // Enfocable (sin tab): un clic en el lienzo deja el foco aquí y Supr/Esc
      // funcionan sobre el diseño seleccionado.
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onDragOver={onDragOver}
      onDragEnter={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "grid min-w-0 gap-4 outline-none",
        variant === "page" ? "lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]" : "lg:grid-cols-[minmax(0,1fr)_21rem]",
        className
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={DESIGN_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-label="Subir diseño"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          void addFiles(files);
        }}
      />

      {/* ───────────── Lienzo ───────────── */}
      <div
        className={cn(
          "relative min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-[radial-gradient(ellipse_at_top,hsl(var(--card)),hsl(var(--muted)))] shadow-soft",
          variant === "page"
            ? "h-[58vh] min-h-[320px] lg:h-[calc(100dvh-11rem)] lg:min-h-[520px]"
            : "h-[46vh] min-h-[280px] lg:h-[70vh]"
        )}
      >
        <MockupCanvasLazy
          ref={canvasRef}
          config={canvasConfig}
          selectedLayerId={selectedId}
          onSelectLayer={setSelectedId}
          onPlacementChange={handlePlacementChange}
          view={view}
          onViewChange={(next) => {
            if (next) {
              setView(next);
              setFreeView(false);
            } else {
              setFreeView(true);
            }
          }}
          className="absolute inset-0"
        />

        {/* Vistas */}
        <div
          role="group"
          aria-label="Vista"
          className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-border/60 bg-card/90 p-1 shadow-soft backdrop-blur"
        >
          {VIEW_BUTTONS.map((b) => {
            const active = !freeView && b.views.includes(view);
            return (
              <button
                key={b.label}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  // "Lado" alterna entre izquierda y derecha si ya está de lado.
                  goToView(b.views.length > 1 && view === b.views[0] && !freeView ? b.views[1] : b.views[0])
                }
                className={cn(
                  "h-8 rounded-full px-3.5 text-[0.8125rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                  active ? "bg-ink text-ink-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {b.label}
              </button>
            );
          })}
          {freeView && (
            <button
              type="button"
              onClick={() => goToView(view)}
              aria-label="Volver a la vista"
              title="Volver a la vista"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>

        {config.layers.length === 0 && !dragging && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-4">
            <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                variant="default"
                className="h-11 px-5 shadow-soft-md"
                onClick={openFilePicker}
                disabled={importing}
              >
                {importing ? <Loader2 className="animate-spin" /> : <ImagePlus />}
                Sube el diseño del cliente
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 bg-card/95 px-4 shadow-soft-md backdrop-blur"
                onClick={() => setDialog("library")}
              >
                <BookImage /> Logos y banderas
              </Button>
            </div>
          </div>
        )}

        {dragging && (
          <div className="pointer-events-none absolute inset-2 z-20 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink/50 bg-card/80 text-center backdrop-blur-sm">
            <ImagePlus className="h-7 w-7 text-foreground/70" aria-hidden />
            <p className="font-semibold">Suelta para agregar el diseño</p>
            <p className="text-meta">PNG, JPG, SVG o WEBP</p>
          </div>
        )}
      </div>

      {/* ───────────── Panel ───────────── */}
      <aside
        aria-label="Controles del mockup"
        className={cn(
          "flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-soft",
          variant === "page"
            ? "lg:h-[calc(100dvh-11rem)] lg:min-h-[520px]"
            : "lg:h-[70vh]"
        )}
      >
        {/* Bloqueado mientras se exporta: la imagen y la config guardada deben coincidir. */}
        <fieldset disabled={busy !== null} className="min-h-0 min-w-0 flex-1 lg:overflow-y-auto">
          <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3 sm:px-5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 flex-1"
              onClick={() => setDialog("templates")}
            >
              <LayoutTemplate /> Plantillas
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 flex-1"
              onClick={() => setDialog("save-template")}
            >
              <Save /> Guardar como plantilla
            </Button>
          </div>

          <StudioSection title="Prenda">
            <ToggleGroup
              type="single"
              value={garment}
              onValueChange={changeGarment}
              aria-label="Prenda"
              className="grid grid-cols-2 gap-2"
            >
              {enabledGarments().map(({ id: g, label }) => (
                <ToggleGroupItem
                  key={g}
                  value={g}
                  aria-label={label}
                  className="flex h-auto flex-col items-start gap-0 rounded-xl border border-border/70 px-3 py-2.5 text-left data-[state=on]:border-ink data-[state=on]:bg-muted/70"
                >
                  <span className="text-sm font-semibold">{label}</span>
                  <span className="text-meta">{GARMENT_MODELS[g]}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </StudioSection>

          <StudioSection title="Color">
            <div className="space-y-4">
              {COLOR_FIELDS[garment].map(({ part, label }) => (
                <MockupColorField
                  key={`${garment}-${part}`}
                  label={label}
                  value={config.colors[part] ?? "#ffffff"}
                  onChange={(value) => setColor(part, value)}
                  myColors={myColorsControls}
                />
              ))}
            </div>
          </StudioSection>

          <MockupSizesPanel
            sizes={config.sizes}
            onChange={(sizes) => setConfig((prev) => ({ ...prev, sizes }))}
          />

          <StudioSection
            title="Diseños"
            aside={
              <div className="flex items-center gap-2">
                {config.layers.length > 0 && (
                  <span className="text-meta tabular-nums">{config.layers.length}</span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-mr-2 h-8 px-2.5"
                  onClick={() => setDialog("library")}
                >
                  <BookImage /> Biblioteca
                </Button>
              </div>
            }
          >
            <MockupLayerList
              layers={config.layers}
              selectedId={selectedId}
              importing={importing}
              onSelect={(id) => setSelectedId((prev) => (prev === id ? null : id))}
              onRemove={removeLayer}
              onUpload={openFilePicker}
            />
          </StudioSection>

          {selected && (
            <StudioSection title="Ajustar diseño" aside={<span className="truncate text-meta">{selected.name}</span>}>
              <div className="space-y-4">
                <LabeledSlider
                  label="Tamaño"
                  value={Math.min(SIZE_MAX, Math.max(SIZE_MIN, sizePct))}
                  display={`${sizePct}%`}
                  min={SIZE_MIN}
                  max={SIZE_MAX}
                  step={5}
                  onChange={(pct) =>
                    updateLayer(selected.id, (l) => ({
                      ...l,
                      placement: { ...l.placement, scale: (baseScale * pct) / 100 },
                    }))
                  }
                />
                <LabeledSlider
                  label="Rotación"
                  value={rotationDeg}
                  display={`${rotationDeg}°`}
                  min={-180}
                  max={180}
                  step={1}
                  onChange={(deg) =>
                    updateLayer(selected.id, (l) => ({
                      ...l,
                      placement: { ...l.placement, rotation: deg / RAD_TO_DEG },
                    }))
                  }
                />
                {presets.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-label">Posición</p>
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Posiciones predeterminadas">
                      {presets.map((preset) => {
                        const active = sameSpot(selected.placement, preset.placement);
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            aria-pressed={active}
                            onClick={() => applyPresetToSelected(preset)}
                            className={cn(
                              "h-8 rounded-full border px-3 text-[0.8125rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                              active
                                ? "border-ink bg-ink text-ink-foreground"
                                : "border-border bg-card hover:bg-muted"
                            )}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <p className="text-meta">
                  Arrastra el diseño sobre la prenda para moverlo. Supr lo quita y Esc lo deselecciona.
                </p>
              </div>
            </StudioSection>
          )}
        </fieldset>

        {/* Acciones */}
        <div className="flex flex-col gap-2 border-t border-border/60 bg-card px-4 py-3 sm:flex-row sm:px-5 lg:flex-col xl:flex-row">
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1"
            onClick={handleDownload}
            disabled={busy !== null}
          >
            {busy === "download" ? <Loader2 className="animate-spin" /> : <Download />}
            Descargar imagen
          </Button>
          {onAttach && (
            <Button
              type="button"
              className="h-11 flex-1"
              onClick={handleAttach}
              disabled={busy !== null}
            >
              {busy === "attach" ? <Loader2 className="animate-spin" /> : <Paperclip />}
              {attachLabel}
            </Button>
          )}
        </div>
      </aside>

      <MockupTemplatesDialog
        open={dialog === "templates"}
        onOpenChange={(open) => setDialog(open ? "templates" : null)}
        hasWork={config.layers.length > 0}
        onApply={applyTemplate}
      />
      <SaveTemplateDialog
        open={dialog === "save-template"}
        onOpenChange={(open) => setDialog(open ? "save-template" : null)}
        config={config}
        exportThumbnail={exportThumbnail}
      />
      <MockupLibraryDialog
        open={dialog === "library"}
        onOpenChange={(open) => setDialog(open ? "library" : null)}
        onAddDesign={(design) => addDesigns([design])}
      />
    </div>
  );
}

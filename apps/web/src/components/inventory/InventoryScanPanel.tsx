"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Camera,
  CheckCircle2,
  Loader2,
  Minus,
  Plus,
  ScanBarcode,
  Undo2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CameraScanner } from "@/components/inventory/CameraScanner";
import { UnknownBarcodeDialog, type PendingScan } from "@/components/inventory/UnknownBarcodeDialog";
import { SCAN_INPUT_ATTR, useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { useInventoryMutations } from "@/hooks/useInventory";
import { getErrorMessage } from "@/lib/api";
import { playScanBeep } from "@/lib/barcode/beep";
import { itemBarcode, normalizeScannedCode } from "@/lib/barcode/codes";
import { createDuplicateGuard } from "@/lib/barcode/scannerBurst";
import {
  classifyScanError,
  oppositeMovement,
  parseScanQuantity,
  pushLogEntry,
  scanDelta,
  type ScanLogEntry,
  type ScanMovementType,
} from "@/lib/barcode/scanSession";
import { formatDelta, formatQuantity } from "@/lib/inventory";
import { cn } from "@/lib/utils";
import type { InventoryItem } from "@/types";

const SOUND_KEY = "emd:scan-sound";

function readSoundPref(): boolean {
  try {
    return window.localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

const timeFormat = new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

type LastResult =
  | { kind: "ok"; entry: ScanLogEntry }
  | { kind: "error"; title: string; detail: string; code: string };

interface InventoryScanPanelProps {
  /** Artículos cargados en la pantalla: para nombrar el artículo cuando el backend sólo devuelve un error. */
  items: InventoryItem[];
  /** Abrir el alta de artículo con el código escaneado. */
  onCreateItem: (code: string) => void;
  onExit: () => void;
}

/**
 * Modo Escanear de Inventario: cada código leído (lector USB/Bluetooth,
 * cámara o tecleado) registra una entrada o salida de la cantidad elegida,
 * con pitido, aviso y un registro de la sesión que se puede deshacer.
 */
export function InventoryScanPanel({ items, onCreateItem, onExit }: InventoryScanPanelProps) {
  const { scanMovement, registerMovement } = useInventoryMutations();
  const [type, setType] = useState<ScanMovementType>("ENTRADA");
  const [quantity, setQuantity] = useState("1");
  const [manualCode, setManualCode] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [sound, setSound] = useState(true);
  const [log, setLog] = useState<ScanLogEntry[]>([]);
  const [last, setLast] = useState<LastResult | null>(null);
  const [pending, setPending] = useState(0);
  const [unknown, setUnknown] = useState<PendingScan | null>(null);
  const [undoing, setUndoing] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const guard = useRef(createDuplicateGuard(800));
  const queue = useRef<Promise<void>>(Promise.resolve());
  const nextId = useRef(1);
  const settings = useRef({ type, quantity, sound });
  settings.current = { type, quantity, sound };
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => setSound(readSoundPref()), []);

  const beep = useCallback((kind: "ok" | "error") => {
    if (settings.current.sound) playScanBeep(kind);
  }, []);

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    try {
      window.localStorage.setItem(SOUND_KEY, next ? "on" : "off");
    } catch {
      // Sin almacenamiento: vale sólo por esta sesión.
    }
  };

  const nameFor = (code: string) => itemsRef.current.find((i) => itemBarcode(i) === code)?.name;

  /** Registra el movimiento en el backend; los escaneos van en fila para que el stock no se cruce. */
  const submit = useCallback(
    (scan: PendingScan) => {
      setPending((n) => n + 1);
      queue.current = queue.current.then(async () => {
        try {
          const { item, movement } = await scanMovement.mutateAsync({
            code: scan.code,
            payload: { type: scan.type, quantity: scan.quantity },
          });
          const entry: ScanLogEntry = {
            id: nextId.current++,
            code: scan.code,
            itemId: item.id,
            itemName: item.name,
            unit: item.unit,
            type: scan.type,
            quantity: scan.quantity,
            balanceAfter: movement?.balanceAfter ?? item.quantity,
            at: new Date(),
            undone: false,
          };
          setLog((prev) => pushLogEntry(prev, entry));
          setLast({ kind: "ok", entry });
          beep("ok");
          toast.success(`${formatDelta(scanDelta(scan.type, scan.quantity))} ${item.name}`, {
            description: `Existencia: ${formatQuantity(entry.balanceAfter, item.unit)}`,
            duration: 2000,
          });
        } catch (error) {
          beep("error");
          const kind = classifyScanError(error);
          if (kind === "unknown") {
            setLast({
              kind: "error",
              title: "Código sin artículo",
              detail: `Nadie tiene el código ${scan.code}.`,
              code: scan.code,
            });
            setUnknown(scan);
            return;
          }
          const message = getErrorMessage(error, "No se pudo registrar el movimiento.");
          const name = nameFor(scan.code);
          const title =
            kind === "stock"
              ? `No alcanza${name ? `: ${name}` : ""}`
              : kind === "invalid"
                ? "Código no válido"
                : "No se registró";
          setLast({ kind: "error", title, detail: message, code: scan.code });
          toast.error(title, { description: message });
        } finally {
          setPending((n) => n - 1);
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scanMovement.mutateAsync, beep]
  );

  const handleScan = useCallback(
    (raw: string) => {
      const code = normalizeScannedCode(raw);
      if (!code) {
        beep("error");
        setLast({ kind: "error", title: "Código no válido", detail: "Debe tener de 3 a 64 caracteres sin acentos.", code: raw });
        return;
      }
      if (!guard.current.accept(code, performance.now())) return;
      const qty = parseScanQuantity(settings.current.quantity);
      if (qty === null) {
        beep("error");
        setLast({ kind: "error", title: "Revisa la cantidad", detail: "La cantidad por escaneo debe ser mayor a 0.", code });
        return;
      }
      submit({ code, type: settings.current.type, quantity: qty });
    },
    [beep, submit]
  );

  useBarcodeScanner({ enabled: true, onScan: handleScan });

  const focusInput = () => {
    // En celular no se abre el teclado sólo por cambiar de modo.
    if (window.matchMedia?.("(pointer: fine)").matches) inputRef.current?.focus();
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleUndo = async (entry: ScanLogEntry) => {
    setUndoing(entry.id);
    try {
      const { item } = await registerMovement.mutateAsync({
        id: entry.itemId,
        payload: {
          type: oppositeMovement(entry.type),
          quantity: entry.quantity,
          note: `Deshacer escaneo de ${entry.code}`,
        },
      });
      setLog((prev) => prev.map((e) => (e.id === entry.id ? { ...e, undone: true } : e)));
      setLast((prev) => (prev?.kind === "ok" && prev.entry.id === entry.id ? null : prev));
      toast.success(`Se deshizo: ${entry.itemName}`, {
        description: `Existencia: ${formatQuantity(item.quantity, item.unit)}`,
      });
    } catch (error) {
      beep("error");
      toast.error("No se pudo deshacer", { description: getErrorMessage(error) });
    } finally {
      setUndoing(null);
      focusInput();
    }
  };

  const submitManual = () => {
    const value = manualCode;
    setManualCode("");
    if (value.trim()) handleScan(value);
  };

  const qtyN = parseScanQuantity(quantity);
  const stepQuantity = (delta: number) => {
    const next = Math.max(1, Math.round(((qtyN ?? 1) + delta) * 1000) / 1000);
    setQuantity(String(next));
  };

  const activeSession = useMemo(() => log.filter((e) => !e.undone), [log]);
  const totals = useMemo(() => {
    let entradas = 0;
    let salidas = 0;
    for (const e of activeSession) e.type === "ENTRADA" ? (entradas += 1) : (salidas += 1);
    return { entradas, salidas };
  }, [activeSession]);

  return (
    <section data-scan-mode="on" aria-label="Modo escanear" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-4 rounded-2xl border border-border/60 bg-card p-4 shadow-soft sm:p-5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <p className="text-sm font-medium">Listo para escanear</p>
          <div className="ml-auto flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 text-muted-foreground"
              onClick={toggleSound}
              aria-label={sound ? "Silenciar pitido" : "Activar pitido"}
              aria-pressed={!sound}
            >
              {sound ? <Volume2 /> : <VolumeX />}
            </Button>
            <Button variant="ghost" className="h-9 rounded-full px-3" onClick={onExit}>
              <X /> Salir
            </Button>
          </div>
        </div>

        {/* Entrada / Salida: lo primero que se ve, enorme y con color. */}
        <div role="radiogroup" aria-label="Tipo de movimiento" className="grid grid-cols-2 gap-2">
          {(
            [
              { value: "ENTRADA", label: "Entrada", hint: "Suma al stock", Icon: ArrowDownToLine },
              { value: "SALIDA", label: "Salida", hint: "Resta del stock", Icon: ArrowUpFromLine },
            ] as const
          ).map(({ value, label, hint, Icon }) => {
            const active = type === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  setType(value);
                  focusInput();
                }}
                className={cn(
                  "flex h-20 items-center justify-center gap-3 rounded-2xl border-2 px-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:h-24",
                  !active && "border-border/70 bg-muted/40 text-muted-foreground hover:bg-muted",
                  active &&
                    value === "ENTRADA" &&
                    "border-sky-600 bg-sky-600 text-white shadow-sm dark:border-sky-500 dark:bg-sky-500",
                  active &&
                    value === "SALIDA" &&
                    "border-orange-600 bg-orange-600 text-white shadow-sm dark:border-orange-500 dark:bg-orange-500"
                )}
              >
                <Icon className="h-7 w-7 shrink-0" aria-hidden />
                <span>
                  <span className="block font-heading text-xl font-semibold leading-tight sm:text-2xl">{label}</span>
                  <span className={cn("block text-xs", active ? "text-white/85" : "text-muted-foreground")}>{hint}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end">
          <div className="space-y-1.5">
            <label htmlFor="scan-qty" className="text-sm font-medium">
              Cantidad por escaneo
            </label>
            <div className="flex h-11 items-center rounded-full border border-border bg-card p-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-9 w-9"
                onClick={() => stepQuantity(-1)}
                disabled={(qtyN ?? 1) <= 1}
                aria-label="Restar uno a la cantidad"
              >
                <Minus />
              </Button>
              <Input
                id="scan-qty"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                onBlur={() => qtyN === null && setQuantity("1")}
                aria-invalid={qtyN === null}
                className="h-9 w-16 border-0 bg-transparent px-0 text-center text-lg font-semibold tabular-nums shadow-none focus-visible:ring-0"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-9 w-9"
                onClick={() => stepQuantity(1)}
                aria-label="Sumar uno a la cantidad"
              >
                <Plus />
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="scan-code" className="text-sm font-medium">
              Código
            </label>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <ScanBarcode className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  id="scan-code"
                  {...{ [SCAN_INPUT_ATTR]: "" }}
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitManual();
                    }
                  }}
                  placeholder="Escanea o escribe el código"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  enterKeyHint="go"
                  className="h-11 rounded-full pl-10 font-mono"
                />
              </div>
              <Button type="button" variant="secondary" className="h-11 px-4" onClick={submitManual} disabled={!manualCode.trim()}>
                Registrar
              </Button>
            </div>
          </div>
        </div>

        {cameraOpen ? (
          <CameraScanner onCode={handleScan} onClose={() => setCameraOpen(false)} />
        ) : (
          <Button variant="outline" className="h-11 w-full" onClick={() => setCameraOpen(true)}>
            <Camera /> Usar cámara
          </Button>
        )}

        {/* Resultado del último escaneo: grande, para leerlo de lejos. */}
        <div aria-live="polite" aria-atomic="true">
          {pending > 0 && !last ? (
            <div className="flex items-center gap-2 rounded-2xl bg-muted/60 px-4 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Registrando…
            </div>
          ) : last?.kind === "ok" ? (
            <div
              data-testid="scan-last"
              className={cn(
                "flex items-center gap-3 rounded-2xl px-4 py-4",
                last.entry.type === "ENTRADA"
                  ? "bg-sky-500/10 text-sky-900 dark:text-sky-100"
                  : "bg-orange-500/10 text-orange-900 dark:text-orange-100"
              )}
            >
              <CheckCircle2 className="h-7 w-7 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{last.entry.itemName}</p>
                <p className="text-sm opacity-80">
                  Existencia: {formatQuantity(last.entry.balanceAfter, last.entry.unit)}
                </p>
              </div>
              <span className="font-heading text-3xl font-semibold tabular-nums">
                {formatDelta(scanDelta(last.entry.type, last.entry.quantity))}
              </span>
            </div>
          ) : last?.kind === "error" ? (
            <div
              role="alert"
              data-testid="scan-last"
              className="flex items-center gap-3 rounded-2xl bg-rose-500/10 px-4 py-4 text-rose-900 dark:text-rose-100"
            >
              <AlertCircle className="h-7 w-7 shrink-0" aria-hidden />
              <div className="min-w-0">
                <p className="font-semibold">{last.title}</p>
                <p className="text-sm opacity-85">{last.detail}</p>
              </div>
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
              Apunta el lector a una etiqueta. No hace falta tocar la pantalla: el lector se detecta solo mientras este
              modo esté abierto.
            </p>
          )}
        </div>
      </div>

      <aside
        aria-label="Escaneos de esta sesión"
        className="flex min-h-[12rem] flex-col rounded-2xl border border-border/60 bg-card shadow-soft"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
          <h2 className="text-sm font-semibold">Esta sesión</h2>
          <p className="text-meta tabular-nums">
            {totals.entradas} entradas · {totals.salidas} salidas
          </p>
        </div>
        {log.length === 0 ? (
          <p className="flex flex-1 items-center justify-center px-6 py-8 text-center text-sm text-muted-foreground">
            Aquí aparece cada escaneo, con la opción de deshacerlo.
          </p>
        ) : (
          <ol className="max-h-[28rem] divide-y divide-border/60 overflow-y-auto" aria-label="Registro de escaneos">
            {log.map((entry) => (
              <li
                key={entry.id}
                data-testid="scan-log-entry"
                className={cn("flex items-center gap-3 px-4 py-2.5", entry.undone && "opacity-55")}
              >
                <span
                  className={cn(
                    "w-12 shrink-0 text-right font-heading text-lg font-semibold tabular-nums",
                    entry.type === "ENTRADA" ? "text-sky-700 dark:text-sky-300" : "text-orange-700 dark:text-orange-300",
                    entry.undone && "line-through"
                  )}
                >
                  {formatDelta(scanDelta(entry.type, entry.quantity))}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm font-medium", entry.undone && "line-through")}>{entry.itemName}</p>
                  <p className="truncate text-meta">
                    {entry.undone ? "Deshecho" : `Quedan ${formatQuantity(entry.balanceAfter, entry.unit)}`} ·{" "}
                    {timeFormat.format(entry.at)}
                  </p>
                </div>
                {!entry.undone && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 shrink-0 px-2.5"
                    onClick={() => handleUndo(entry)}
                    disabled={undoing === entry.id}
                    aria-label={`Deshacer ${formatDelta(scanDelta(entry.type, entry.quantity))} de ${entry.itemName}`}
                  >
                    {undoing === entry.id ? <Loader2 className="animate-spin" /> : <Undo2 />}
                    Deshacer
                  </Button>
                )}
              </li>
            ))}
          </ol>
        )}
      </aside>

      <UnknownBarcodeDialog
        scan={unknown}
        onClose={() => {
          setUnknown(null);
          focusInput();
        }}
        onLinked={(item, scan) => {
          setUnknown(null);
          toast.success(`Código ${scan.code} ligado a ${item.name}`);
          submit(scan);
          focusInput();
        }}
        onCreate={(code) => {
          setUnknown(null);
          onCreateItem(code);
        }}
      />
    </section>
  );
}

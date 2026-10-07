"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, Clock3, Inbox, Package, Sun, Volume2, VolumeX, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TONE_META } from "@/components/orders/OrderJobCard";
import { OrderDetailDialog } from "@/components/orders/OrderDetailDialog";
import { TvTaskCard } from "@/components/tasks/tv/TvTaskCard";
import { PackageArrivalStage, type ResolvedArrival } from "@/components/tasks/tv/PackageArrivalStage";
import { PackageArrival3DStage } from "@/components/tasks/tv/PackageArrival3DStage";
import { canUseWebGL, disposeArrival3D, prewarmArrival3D } from "@/components/tasks/tv/arrival3d/runtime";
import { useAdvanceMyTask, useMyTasks } from "@/hooks/useMyTasks";
import { useAreaBoardTasks } from "@/hooks/useAreaBoardTasks";
import { useOrderArrivals } from "@/hooks/useOrderArrivals";
import { usePermissions } from "@/hooks/usePermissions";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import { useNow } from "@/hooks/useNow";
import { useWakeLock } from "@/hooks/useWakeLock";
import { getAreaIcon, getAreaLabel } from "@/lib/areas";
import { isReturnedDesign, taskDeadline } from "@/lib/myTasks";
import type { DeadlineTone } from "@/lib/orderDeadline";
import {
  arrivalPriority,
  demoArrival,
  enqueueArrival,
  takeNextStep,
  topPriority,
  type ArrivalPriority,
  type ArrivalStep,
  type PackageArrival,
} from "@/lib/packageArrivals";
import { setNotificationSoundSuppressed } from "@/lib/sound";
import { closeTvAudio, isTvAudioUnlocked, isTvSoundMuted, playArrivalChime, setTvSoundMuted, unlockTvAudio } from "@/lib/tvSound";
import {
  buildTvBoard,
  findArrivalTask,
  TV_COLUMNS,
  tvBoardAreas,
  type TvBoard,
  type TvColumnId,
  type TvTask,
} from "@/lib/tvBoard";
import { cn } from "@/lib/utils";
import type { AreaTaskStatus } from "@/types";

const TV_REFRESH_MS = 30_000;
/** Valor de "Todas" en el filtro de área (Radix no admite `""`). */
const ALL_AREAS = "all";
/** Cuánto se espera a que el pedido de un aviso aparezca en el tablero antes de animarlo igual. */
const ARRIVAL_WAIT_MS = 1500;
/** Cuánto puede esperar la primera llegada a que la escena 3D termine de precalentarse. */
const WARM_WAIT_MS = 6000;
/** Cuánto brilla una tarjeta recién llegada. */
const HIGHLIGHT_MS = 3000;
const KPI_TONES: DeadlineTone[] = ["overdue", "at_risk", "on_time", "no_date"];

/**
 * Llegadas de mentira para mostrar la animación (`?tv=1&demo=1`). Fuera de
 * producción siempre; en un build de producción sólo con
 * `NEXT_PUBLIC_TV_DEMO=1` (la config de Playwright lo pone).
 */
export const TV_DEMO_ENABLED = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_TV_DEMO === "1";

export type DemoKind = "overdue" | "at_risk" | "calm" | "changes" | "batch";

const COLUMN_ICON: Record<TvColumnId, LucideIcon> = {
  pendiente: Inbox,
  en_proceso: Clock3,
  terminado: CheckCircle2,
};

function clientOf(task: TvTask): string | null {
  const c = task.order.client;
  return c ? [c.first_name, c.last_name].filter(Boolean).join(" ") : task.order.clientNameOverride;
}

function resolveArrival(arrival: PackageArrival, board: TvBoard, now: number): ResolvedArrival {
  const task = findArrivalTask(board, arrival.orderId, arrival.area);
  const deliveryDate = task?.order.deliveryDate ?? arrival.deliveryDate;
  return {
    id: arrival.id,
    orderId: arrival.orderId,
    clientName: (task && clientOf(task)) ?? arrival.clientName,
    area: task?.area ?? arrival.area,
    deliveryDate,
    priority: arrivalPriority({ deliveryDate, changes: arrival.changes || (task ? isReturnedDesign(task) : false) }, now),
  };
}

interface CurrentStep {
  step: ArrivalStep;
  resolved: ResolvedArrival[];
  priority: ArrivalPriority;
  delivered: boolean;
}

interface TasksTvModeProps {
  onClose: () => void;
  /** Muestra los botones para simular llegadas (sólo si `TV_DEMO_ENABLED`). */
  demo?: boolean;
}

/**
 * Modo TV de "Tareas asignadas": la tele del área. Todo el trabajo del área
 * (no sólo lo propio) en Pendiente / En proceso / Terminado, con botones
 * grandes para tomar, empezar y terminar con el dedo, y cada trabajo nuevo
 * entra como un paquete que cae y se abre.
 */
export function TasksTvMode({ onClose, demo = false }: TasksTvModeProps) {
  const { roles, session } = usePermissions();
  const userId = session?.user?.id ? Number(session.user.id) : null;
  const { tasks: myTasks, isLoading, isError, refetch } = useMyTasks();
  const { areaTasks, isLoading: areaLoading, refetch: refetchArea } = useAreaBoardTasks(roles);
  const { advance, pendingKey } = useAdvanceMyTask();
  const { timeFormat } = useTimeFormat();
  const now = useNow(30_000);
  const reduced = Boolean(useReducedMotion());
  const awake = useWakeLock(true);
  const [accent, setAccent] = useState<string | undefined>();
  const [area, setArea] = useState<string | null>(null);
  const [demoTasks, setDemoTasks] = useState<TvTask[]>([]);

  const allMyTasks = useMemo(() => [...myTasks, ...demoTasks], [myTasks, demoTasks]);
  const fullBoard = useMemo(
    () => buildTvBoard({ myTasks: allMyTasks, areaTasks, userId, now, dropPlanned: !isError }),
    [allMyTasks, areaTasks, userId, now, isError]
  );
  const allTasks = useMemo(
    () => [...fullBoard.pendiente, ...fullBoard.en_proceso, ...fullBoard.terminado],
    [fullBoard]
  );
  const areas = useMemo(() => tvBoardAreas(allTasks, roles), [allTasks, roles]);
  const activeArea = area && areas.includes(area) ? area : null;
  const board = useMemo<TvBoard>(
    () =>
      activeArea
        ? {
            pendiente: fullBoard.pendiente.filter((t) => t.area === activeArea),
            en_proceso: fullBoard.en_proceso.filter((t) => t.area === activeArea),
            terminado: fullBoard.terminado.filter((t) => t.area === activeArea),
          }
        : fullBoard,
    [fullBoard, activeArea]
  );
  const boardRef = useRef(fullBoard);
  boardRef.current = fullBoard;

  // --- Pantalla: tema oscuro con el acento del usuario, pantalla completa, refresco, sin "ding" doble.
  const refreshRef = useRef(() => {
    void refetch();
    void refetchArea();
  });
  refreshRef.current = () => {
    void refetch();
    void refetchArea();
  };
  useEffect(() => {
    setAccent(document.documentElement.dataset.accent);
    setNotificationSoundSuppressed(true);
    const refresh = setInterval(() => refreshRef.current(), TV_REFRESH_MS);
    document.documentElement.requestFullscreen?.().catch(() => {
      // Sin permiso de pantalla completa: el overlay igual tapa toda la app.
    });
    return () => {
      clearInterval(refresh);
      setNotificationSoundSuppressed(false);
      closeTvAudio();
      if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  // --- Sonido: silencio guardado en el navegador; se desbloquea con el primer toque.
  const [muted, setMuted] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  useEffect(() => setMuted(isTvSoundMuted()), []);
  const unlockAudio = useCallback(() => {
    if (isTvAudioUnlocked()) return;
    void unlockTvAudio().then(setAudioReady);
  }, []);
  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setTvSoundMuted(next);
    if (!next) unlockAudio();
  };

  // --- Animación: 3D real (three.js) si hay WebGL; si no, o con
  // prefers-reduced-motion, o si la escena falla, la versión SVG.
  const [webgl, setWebgl] = useState(false);
  const [force2d, setForce2d] = useState(false);
  // "warming" mientras se precalienta la escena; "ready" cuando la primera
  // caja ya no tiene que esperar a compilar shaders.
  const [warm3d, setWarm3d] = useState<"off" | "warming" | "ready">("off");
  const warmStart = useRef(0);
  useEffect(() => {
    // Con movimiento reducido la llegada es 2D: ni se sondea WebGL. Crear el
    // primer contexto puede trabar el hilo principal varios segundos (sin
    // GPU, WebGL por software), así que tampoco va en el mismo tick que abre
    // la tele: primero se pinta.
    if (reduced) return;
    let alive = true;
    let warmTimer: ReturnType<typeof setTimeout> | undefined;
    const probeTimer = setTimeout(() => {
      if (!alive) return;
      const ok = canUseWebGL();
      setWebgl(ok);
      if (!ok) return;
      setWarm3d("warming");
      warmStart.current = Date.now();
      // Con la tele ya pintada: three se baja y compila sin trabar la apertura.
      warmTimer = setTimeout(() => {
        prewarmArrival3D()
          .then(() => alive && setWarm3d("ready"))
          .catch((err) => {
            console.error("[modo TV] no se pudo preparar la escena 3D; se usa la 2D", err);
            if (alive) setForce2d(true);
          });
      }, 300);
    }, 150);
    return () => {
      alive = false;
      clearTimeout(probeTimer);
      clearTimeout(warmTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // El renderer compartido vive mientras la tele esté abierta.
  useEffect(() => () => disposeArrival3D(), []);
  const use3d = webgl && !reduced && !force2d;
  // Llegada que tardó en arrancar en 3D: ésa sigue en 2D (la próxima reintenta).
  const [timedOutStep, setTimedOutStep] = useState<string | null>(null);

  // --- Detalle de un pedido encima de la tele (como en la vista normal). La
  // cola de llegadas espera mientras está abierto.
  const [detailId, setDetailId] = useState<number | null>(null);
  const closeDetail = useCallback(() => setDetailId(null), []);

  // --- Llegadas: cola → un paso a la vez (o la caja grande).
  const [queue, setQueue] = useState<PackageArrival[]>([]);
  const [current, setCurrent] = useState<CurrentStep | null>(null);
  const [highlights, setHighlights] = useState<Record<string, ArrivalPriority>>({});
  const [waitTick, setWaitTick] = useState(0);

  const pushArrival = useCallback((arrival: PackageArrival) => setQueue((q) => enqueueArrival(q, arrival)), []);
  useOrderArrivals(pushArrival);

  useEffect(() => {
    if (current || queue.length === 0 || detailId != null) return;
    // La primera caja espera (un rato) a que la escena 3D esté precalentada.
    if (use3d && warm3d === "warming" && Date.now() - warmStart.current < WARM_WAIT_MS) {
      const t = setTimeout(() => setWaitTick((n) => n + 1), 250);
      return () => clearTimeout(t);
    }
    const head = queue[0];
    const known = findArrivalTask(boardRef.current, head.orderId, head.area);
    // El aviso del socket llega antes que el refetch: se espera un poco a la
    // tarjeta para saber su plazo y adónde vuela la hoja.
    if (!known && Date.now() - head.receivedAt < ARRIVAL_WAIT_MS) {
      const t = setTimeout(() => setWaitTick((n) => n + 1), 250);
      return () => clearTimeout(t);
    }
    const { step, rest } = takeNextStep(queue);
    if (!step) return;
    const resolved = step.arrivals.map((a) => resolveArrival(a, boardRef.current, Date.now()));
    setCurrent({ step, resolved, priority: topPriority(resolved.map((r) => r.priority)), delivered: false });
    setQueue(rest);
  }, [current, queue, waitTick, detailId, use3d, warm3d]);

  // Tarjetas que esperan su paquete: invisibles (pero en su lugar) hasta que la hoja llega.
  const hiddenKeys = useMemo(() => {
    const keys = new Set<string>();
    const pending = [...queue, ...(current && !current.delivered ? current.step.arrivals : [])];
    for (const a of pending) {
      const task = findArrivalTask(fullBoard, a.orderId, a.area);
      if (task) keys.add(task.key);
    }
    return keys;
  }, [queue, current, fullBoard]);

  const findTarget = useCallback((arrival: ResolvedArrival): HTMLElement | null => {
    const task = findArrivalTask(boardRef.current, arrival.orderId, arrival.area);
    const card = task ? document.querySelector<HTMLElement>(`[data-tv-card="${CSS.escape(task.key)}"]`) : null;
    return card ?? document.querySelector<HTMLElement>('[data-tv-column="pendiente"]');
  }, []);

  const handleLand = useCallback(() => {
    if (current) playArrivalChime(current.priority);
  }, [current]);

  const handleDelivered = useCallback(() => {
    setCurrent((c) => (c ? { ...c, delivered: true } : c));
    if (!current) return;
    const lit: Record<string, ArrivalPriority> = {};
    current.step.arrivals.forEach((a, i) => {
      const task = findArrivalTask(boardRef.current, a.orderId, a.area);
      if (task) lit[task.key] = current.resolved[i]?.priority ?? current.priority;
    });
    setHighlights((h) => ({ ...h, ...lit }));
    setTimeout(() => {
      setHighlights((h) => {
        const next = { ...h };
        for (const key of Object.keys(lit)) delete next[key];
        return next;
      });
    }, HIGHLIGHT_MS);
  }, [current]);

  const handleDone = useCallback(() => setCurrent(null), []);

  // --- Demo: tareas y avisos de mentira para ver/probar la animación.
  const demoSeq = useRef(9000);
  const simulate = useCallback(
    (kind: DemoKind) => {
      const make = (k: Exclude<DemoKind, "batch">): { task: TvTask; arrival: PackageArrival } => {
        demoSeq.current += 1;
        const orderId = demoSeq.current;
        const t = Date.now();
        const deliveryDate =
          k === "overdue"
            ? new Date(t - 3 * 3600_000).toISOString()
            : k === "at_risk"
              ? new Date(t + 20 * 3600_000).toISOString()
              : new Date(t + 5 * 24 * 3600_000).toISOString();
        const taskArea = activeArea ?? areas.find((a) => a !== "diseno") ?? areas[0] ?? roles[0] ?? "taller";
        const clients = ["Colegio Miraflores", "Taller Ruiz", "Club Deportivo Norte", "Hotel Las Palmas", "Café Central"];
        const task: TvTask = {
          key: `demo-${orderId}`,
          kind: "production",
          area: taskArea,
          taskId: null,
          status: "pendiente",
          mine: false,
          assignee: null,
          startedAt: null,
          order: {
            id: orderId,
            description: k === "changes" ? "Ajustar logo según comentarios del cliente" : "Pedido de demostración",
            deliveryDate,
            creationDate: new Date(t).toISOString(),
            statusId: 1,
            clientNameOverride: clients[orderId % clients.length],
            designStartedAt: null,
            designStartedByName: null,
            client: null,
            status: { id: 1, name: "pendiente" },
          },
        };
        const arrival = demoArrival(
          {
            orderId,
            area: taskArea,
            clientName: task.order.clientNameOverride,
            deliveryDate,
            changes: k === "changes",
          },
          t
        );
        return { task, arrival };
      };
      const kinds: Exclude<DemoKind, "batch">[] =
        kind === "batch" ? ["overdue", "at_risk", "calm", "calm", "changes"] : [kind];
      const made = kinds.map(make);
      setDemoTasks((prev) => [...prev, ...made.map((m) => m.task)]);
      setQueue((q) => made.reduce((acc, m) => enqueueArrival(acc, m.arrival), q));
    },
    [activeArea, areas, roles]
  );

  useEffect(() => {
    if (!demo || !TV_DEMO_ENABLED) return;
    const w = window as unknown as { __emdTvDemo?: (kind: DemoKind) => void };
    w.__emdTvDemo = simulate;
    return () => {
      delete w.__emdTvDemo;
    };
  }, [demo, simulate]);

  const handleAdvance = useCallback(
    (task: TvTask, status: AreaTaskStatus) => {
      if (task.key.startsWith("demo-")) {
        setDemoTasks((prev) =>
          prev.map((t) =>
            t.key === task.key
              ? {
                  ...t,
                  status,
                  mine: true,
                  startedAt: t.startedAt ?? new Date().toISOString(),
                  completedAt: status === "terminado" ? new Date().toISOString() : null,
                }
              : t
          )
        );
        return;
      }
      advance(task, status);
    },
    [advance]
  );

  const handleOpen = useCallback(
    (orderId: number) => {
      // Los pedidos de la demo no existen en el backend.
      if (orderId > 9000 && demoTasks.some((t) => t.order.id === orderId)) return;
      setDetailId(orderId);
    },
    [demoTasks]
  );

  const live = [...board.pendiente, ...board.en_proceso];
  const toneCounts = useMemo(() => {
    const c = Object.fromEntries(KPI_TONES.map((t) => [t, 0])) as Record<DeadlineTone, number>;
    for (const task of live) {
      const tone = taskDeadline(task, now).tone;
      if (tone in c) c[tone] += 1;
    }
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, now]);

  const loading = (isLoading || areaLoading) && allTasks.length === 0;
  const areaTitle = activeArea ? getAreaLabel(activeArea) : areas.filter((a) => roles.includes(a)).map(getAreaLabel).join(" · ");

  return (
    // Siempre oscuro, como el muro de pedidos: se mira de lejos y con luz de taller.
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        fullscreen
        className="dark overflow-hidden"
        data-accent={accent}
        data-arrival-3d={use3d ? warm3d : "off"}
        aria-describedby={undefined}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).focus();
        }}
        onPointerDownCapture={unlockAudio}
        onKeyDownCapture={unlockAudio}
      >
        <div className="mx-auto flex h-dvh max-w-[140rem] flex-col gap-5 p-6 lg:p-8">
          <header className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <div className="min-w-0">
              <DialogTitle className="text-4xl">Tareas del área</DialogTitle>
              {areaTitle && <p className="mt-1 truncate text-xl text-muted-foreground">{areaTitle}</p>}
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-medium text-emerald-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" aria-hidden />
              En vivo
            </span>
            {awake && (
              <SimpleTooltip label="La pantalla no se apaga mientras el Modo TV esté abierto" side="bottom">
                <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
                  <Sun className="h-4 w-4" aria-hidden />
                  Pantalla activa
                </span>
              </SimpleTooltip>
            )}
            <div className="ml-auto flex items-center gap-3">
              {!muted && !audioReady && (
                <Button variant="outline" size="lg" className="gap-2 rounded-full" onClick={unlockAudio}>
                  <Volume2 className="h-5 w-5" />
                  Activar sonido
                </Button>
              )}
              <TvClock />
              <SimpleTooltip label={muted ? "Activar sonido" : "Silenciar"} side="bottom">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-14 w-14 [&_svg]:size-7"
                  onClick={toggleMute}
                  aria-label={muted ? "Activar sonido de llegadas" : "Silenciar llegadas"}
                  aria-pressed={muted}
                >
                  {muted ? <VolumeX /> : <Volume2 />}
                </Button>
              </SimpleTooltip>
              <SimpleTooltip label="Salir (Esc)" side="bottom">
                <Button variant="ghost" size="icon" className="h-14 w-14 [&_svg]:size-7" onClick={onClose} aria-label="Salir del modo TV (Esc)">
                  <X />
                </Button>
              </SimpleTooltip>
            </div>
          </header>

          <div className="flex flex-wrap items-center gap-3">
            <ul className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-5" aria-label="Conteo por plazo">
              {KPI_TONES.map((tone) => {
                const meta = TONE_META[tone];
                return (
                  <li key={tone} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3">
                    <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted", meta.text)} aria-hidden>
                      <meta.icon className="h-6 w-6" />
                    </span>
                    <span>
                      <span className="block font-heading text-4xl font-semibold leading-none tabular-nums">{toneCounts[tone]}</span>
                      <span className="text-base text-muted-foreground">{meta.label}</span>
                    </span>
                  </li>
                );
              })}
              <li className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-emerald-400" aria-hidden>
                  <CheckCircle2 className="h-6 w-6" />
                </span>
                <span>
                  <span className="block font-heading text-4xl font-semibold leading-none tabular-nums">{board.terminado.length}</span>
                  <span className="text-base text-muted-foreground">Terminadas</span>
                </span>
              </li>
            </ul>
          </div>

          {(areas.length > 1 || (demo && TV_DEMO_ENABLED)) && (
            <div className="flex flex-wrap items-center gap-3">
              {areas.length > 1 && (
                <ToggleGroup
                  type="single"
                  variant="segmented"
                  value={activeArea ?? ALL_AREAS}
                  onValueChange={(v) => v && setArea(v === ALL_AREAS ? null : v)}
                  aria-label="Filtrar por área"
                  className="flex-wrap justify-start gap-2"
                >
                  {[ALL_AREAS, ...areas].map((value) => {
                    const Icon = value !== ALL_AREAS ? getAreaIcon(value) : null;
                    return (
                      <ToggleGroupItem key={value} value={value} className="h-12 gap-2 border bg-card px-5 text-base">
                        {Icon && <Icon aria-hidden />}
                        {value === ALL_AREAS ? "Todas" : getAreaLabel(value)}
                      </ToggleGroupItem>
                    );
                  })}
                </ToggleGroup>
              )}
              {demo && TV_DEMO_ENABLED && <DemoControls onSimulate={simulate} />}
            </div>
          )}

          {isError && areaTasks == null ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <p className="text-2xl">No se pudieron cargar las tareas.</p>
              <Button size="lg" onClick={() => refreshRef.current()}>
                Reintentar
              </Button>
            </div>
          ) : (
            <LayoutGroup id="tv-tareas">
              <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 md:grid-cols-3">
                {TV_COLUMNS.map((column) => {
                  const Icon = COLUMN_ICON[column.id];
                  const list = board[column.id];
                  return (
                    <section
                      key={column.id}
                      aria-label={column.label}
                      className="flex min-h-0 flex-col rounded-3xl border border-border/60 bg-muted/30"
                    >
                      <h2
                        data-tv-column={column.id}
                        className="flex items-center gap-3 px-5 pb-3 pt-4 font-heading text-2xl font-semibold"
                      >
                        <Icon className="h-7 w-7 text-muted-foreground" aria-hidden />
                        {column.label}
                        {column.id === "terminado" && <span className="text-base font-normal text-muted-foreground">últimas 12 h</span>}
                        <span className="ml-auto rounded-full bg-card px-3 py-0.5 text-xl tabular-nums text-muted-foreground">
                          {list.length}
                        </span>
                      </h2>
                      <motion.ul layoutScroll className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
                        {loading ? (
                          <li className="h-48 animate-pulse rounded-3xl bg-card/60" aria-hidden />
                        ) : list.length === 0 ? (
                          <li className="px-2 py-6 text-lg text-muted-foreground">
                            {column.id === "terminado" && areaTasks == null ? "Sin datos de lo terminado." : "Nada por aquí."}
                          </li>
                        ) : (
                          list.map((task) => (
                              <TvTaskCard
                                key={task.key}
                                task={task}
                                state={taskDeadline(task, now)}
                                now={now}
                                timeFormat={timeFormat}
                                onOpen={handleOpen}
                                onAdvance={handleAdvance}
                                busy={pendingKey === task.key}
                                hidden={hiddenKeys.has(task.key)}
                                highlight={highlights[task.key] ?? null}
                                reduced={reduced}
                              />
                          ))
                        )}
                      </motion.ul>
                    </section>
                  );
                })}
              </div>
            </LayoutGroup>
          )}
        </div>

        {current &&
          (use3d && timedOutStep !== current.step.arrivals[0].id ? (
            <PackageArrival3DStage
              key={`3d-${current.step.arrivals[0].id}`}
              step={current.step}
              resolved={current.resolved}
              priority={current.priority}
              timeFormat={timeFormat}
              findTarget={findTarget}
              onLand={handleLand}
              onDelivered={handleDelivered}
              onDone={handleDone}
              onFallback={(reason) =>
                reason === "error" ? setForce2d(true) : setTimedOutStep(current.step.arrivals[0].id)
              }
            />
          ) : (
            <PackageArrivalStage
              key={`2d-${current.step.arrivals[0].id}`}
              step={current.step}
              resolved={current.resolved}
              priority={current.priority}
              reduced={reduced}
              timeFormat={timeFormat}
              findTarget={findTarget}
              onLand={handleLand}
              onDelivered={handleDelivered}
              onDone={handleDone}
            />
          ))}

        {/* Dentro del contenido de la tele (rama anidada de Radix): Esc cierra
            sólo el detalle y el foco vuelve a la tarjeta. Se monta después en
            el <body>, así que queda encima de la pantalla completa. */}
        <OrderDetailDialog orderId={detailId} onClose={closeDetail} />
      </DialogContent>
    </Dialog>
  );
}

/** Reloj grande; se actualiza solo él (no todo el tablero) cada segundo. */
function TvClock() {
  const now = useNow(1000);
  const date = new Date(now);
  return (
    <div className="text-right leading-none">
      <p className="font-heading text-6xl font-bold tabular-nums" aria-label="Hora actual">
        {date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
      </p>
      <p className="mt-1 text-base capitalize text-muted-foreground">
        {date.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
      </p>
    </div>
  );
}

function DemoControls({ onSimulate }: { onSimulate: (kind: DemoKind) => void }) {
  const options: { kind: DemoKind; label: string }[] = [
    { kind: "overdue", label: "Vencido" },
    { kind: "at_risk", label: "Urgente" },
    { kind: "calm", label: "A tiempo" },
    { kind: "changes", label: "Cambios" },
    { kind: "batch", label: "5 pedidos" },
  ];
  return (
    <div className="ml-auto flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-border px-3 py-2" aria-label="Simular llegadas">
      <Package className="h-5 w-5 text-muted-foreground" aria-hidden />
      <span className="text-sm text-muted-foreground">Demo:</span>
      {options.map((o) => (
        <Button key={o.kind} variant="outline" size="sm" onClick={() => onSimulate(o.kind)}>
          Simular {o.label.toLowerCase()}
        </Button>
      ))}
    </div>
  );
}

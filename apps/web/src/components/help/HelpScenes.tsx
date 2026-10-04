"use client";

import { formatOrderCode } from "@/lib/orderCode";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Check,
  CheckCircle2,
  FileImage,
  GripVertical,
  Package,
  Paperclip,
  Plus,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SPRING_DEFAULT } from "@/lib/motion";
import { Cursor, FakeButton, Pill, Screen, Typing, useScenePhase } from "./scenePrimitives";

/*
 * Mini pantallas animadas de la Ayuda. Cada escena repite en bucle un
 * recorrido corto (cursor que toca, algo que cambia) con datos de ejemplo.
 * Son ilustraciones: no reflejan datos reales ni se pueden usar.
 */

const pop = {
  initial: { opacity: 0, y: 8, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -6, scale: 0.97 },
  transition: SPRING_DEFAULT,
};

function Row({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-2.5 py-1.5", className)}>
      {children}
    </div>
  );
}

/* ----------------------------- Recepción ----------------------------- */

/** Crear un pedido: botón → formulario → aparece en la lista. */
export function NewOrderScene() {
  const p = useScenePhase(6);
  const formOpen = p >= 1 && p <= 3;
  return (
    <Screen title="Pedidos">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold">Pedidos</span>
        <FakeButton pressed={p === 0}>
          <Plus className="h-3 w-3" /> Nueva Orden
        </FakeButton>
      </div>
      <div className="space-y-1.5">
        <AnimatePresence initial={false}>
          {p >= 4 && (
            <motion.div key="new" {...pop}>
              <Row className="ring-1 ring-primary/40">
                <span>EMD-P0131 · Bordados SA</span>
                <Pill tone="amber">pendiente</Pill>
              </Row>
            </motion.div>
          )}
        </AnimatePresence>
        <Row>
          <span>EMD-P0130 · Escuela Norte</span>
          <Pill tone="blue">en proceso</Pill>
        </Row>
        <Row>
          <span>EMD-P0129 · Café Luna</span>
          <Pill tone="green">terminado</Pill>
        </Row>
      </div>
      <AnimatePresence>
        {formOpen && (
          <motion.div
            key="form"
            {...pop}
            className="absolute inset-x-4 top-3 z-10 space-y-2 rounded-xl border border-border bg-card p-3 shadow-lg"
          >
            <p className="font-semibold">Nuevo pedido</p>
            <div className="rounded-md border border-border px-2 py-1 text-muted-foreground">
              Cliente: <span className="text-foreground"><Typing text="Bordados SA" active={p >= 1} /></span>
            </div>
            <div className="flex gap-1.5">
              <Pill tone={p >= 2 ? "violet" : "muted"}>Playera ×20</Pill>
              <Pill>Entrega: Mañana</Pill>
            </div>
            <div className="flex justify-end">
              <FakeButton pressed={p === 3}>Crear pedido</FakeButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Cursor
        at={p === 0 ? [80, 12] : p === 1 ? [45, 40] : p === 2 ? [25, 55] : p === 3 ? [80, 75] : null}
        click={p === 0 || p === 3}
      />
    </Screen>
  );
}

/** Lo aprendido del cliente: al elegirlo se precarga lo habitual. */
export function LearnedClientScene() {
  const p = useScenePhase(5);
  return (
    <Screen title="Nuevo pedido">
      <div className="space-y-2">
        <div className="rounded-md border border-border px-2 py-1">
          Cliente: <Typing text="Escuela Norte" active={p >= 0} />
        </div>
        <AnimatePresence>
          {p >= 1 && (
            <motion.div key="habit" {...pop} className="rounded-lg bg-primary/10 px-2 py-1.5 text-[11px]">
              <span className="font-medium">Lo habitual:</span> Polo bordada ×40 · aprendido de 6 pedidos
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] text-muted-foreground">Suele pedir</span>
          {["Polo bordada", "Gorra", "Sudadera"].map((name, i) => (
            <motion.span
              key={name}
              initial={false}
              animate={{ opacity: p >= 2 ? 1 : 0.25 }}
              transition={{ ...SPRING_DEFAULT, delay: i * 0.1 }}
            >
              <Pill tone={p >= 3 && i === 1 ? "violet" : "muted"}>
                <Plus className="h-2.5 w-2.5" /> {name}
              </Pill>
            </motion.span>
          ))}
        </div>
        <div className="space-y-1">
          <AnimatePresence>
            {p >= 2 && (
              <motion.div key="r1" {...pop}>
                <Row>
                  <span>Polo bordada</span>
                  <span className="tabular-nums">40</span>
                </Row>
              </motion.div>
            )}
            {p >= 3 && (
              <motion.div key="r2" {...pop}>
                <Row>
                  <span>Gorra</span>
                  <span className="tabular-nums">25</span>
                </Row>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <Cursor at={p === 3 ? [48, 52] : p === 4 ? [70, 90] : null} click={p === 3} />
    </Screen>
  );
}

/** Mis frecuentes: personalizar y reordenar arrastrando. */
export function FrequentsScene() {
  const p = useScenePhase(5, 1200);
  const order = p >= 2 ? ["Taza", "Playera", "Gorra"] : ["Playera", "Gorra", "Taza"];
  return (
    <Screen title="Nuevo pedido · Frecuentes">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Frecuentes</span>
        <FakeButton variant="outline" pressed={p === 0}>
          Personalizar
        </FakeButton>
      </div>
      <div className="flex gap-1.5">
        {order.map((n) => (
          <motion.span key={n} layout transition={SPRING_DEFAULT}>
            <Pill>
              <Plus className="h-2.5 w-2.5" /> {n}
            </Pill>
          </motion.span>
        ))}
      </div>
      <AnimatePresence>
        {p >= 1 && p <= 3 && (
          <motion.div key="dlg" {...pop} className="absolute inset-x-4 top-2 z-10 space-y-1 rounded-xl border border-border bg-card p-2.5 shadow-lg">
            <p className="font-semibold">Mis frecuentes</p>
            <p className="text-[10px] text-muted-foreground">Arrastra para ordenarlos. Solo cambian para ti.</p>
            {order.map((n) => (
              <motion.div key={n} layout transition={SPRING_DEFAULT}>
                <Row className={cn("bg-background py-1 ring-1 ring-border", p === 2 && n === "Taza" && "shadow-md ring-primary/50")}>
                  <span className="flex items-center gap-1">
                    <GripVertical className="h-3 w-3 text-muted-foreground" />
                    {n}
                  </span>
                </Row>
              </motion.div>
            ))}
            <div className="flex justify-end">
              <FakeButton pressed={p === 3}>Guardar</FakeButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Cursor
        at={p === 0 ? [82, 14] : p === 1 ? [14, 80] : p === 2 ? [14, 45] : p === 3 ? [82, 92] : null}
        click={p === 0 || p === 3}
      />
    </Screen>
  );
}

/** Con diseño / Sin diseño y áreas de producción. */
export function DesignChoiceScene() {
  const p = useScenePhase(4, 1500);
  const withDesign = p < 2;
  return (
    <Screen title="Nuevo pedido · Diseño y producción">
      <p className="mb-1.5 text-[10px] text-muted-foreground">¿Requiere diseño?</p>
      <div className="mb-3 inline-flex rounded-full bg-muted p-0.5">
        {["Con diseño", "Sin diseño"].map((label, i) => {
          const active = (i === 0) === withDesign;
          return (
            <span key={label} className="relative px-3 py-1 text-[11px]">
              {active && (
                <motion.span layoutId="design-choice" className="absolute inset-0 rounded-full bg-background shadow" transition={SPRING_DEFAULT} />
              )}
              <span className="relative">{label}</span>
            </span>
          );
        })}
      </div>
      <p className="mb-1.5 text-[10px] text-muted-foreground">Áreas de producción</p>
      <div className="flex flex-wrap gap-1.5">
        {["Taller", "DTF", "Bordado", "Láser"].map((a) => (
          <Pill key={a} tone={(p === 1 || p === 3) && a === "Bordado" ? "violet" : "muted"}>
            {(p === 1 || p === 3) && a === "Bordado" && <Check className="h-2.5 w-2.5" />}
            {a}
          </Pill>
        ))}
      </div>
      <motion.p key={withDesign ? "a" : "b"} {...pop} className="mt-3 rounded-lg bg-muted/60 px-2 py-1.5 text-[11px]">
        {withDesign ? "Pasa primero por Diseño; el área se puede definir después." : "Va directo al área elegida, sin pasar por Diseño."}
      </motion.p>
      <Cursor at={p === 0 ? [62, 30] : p === 1 ? [52, 62] : p === 2 ? [62, 30] : [52, 62]} click />
    </Screen>
  );
}

/** Respuesta del cliente al montaje: autorizó o pidió cambios. */
export function ClientReplyScene() {
  const p = useScenePhase(6, 1300);
  const changes = p <= 2;
  return (
    <Screen title="Pedido EMD-P0131 · Proceso de diseño">
      <div className="mb-2 flex items-center gap-2 rounded-lg bg-muted/60 p-2">
        <FileImage className="h-6 w-6 text-muted-foreground" />
        <div className="flex-1">
          <p className="font-medium">Montaje · Ronda 1</p>
          <p className="text-[10px] text-muted-foreground">Descárgalo y muéstraselo al cliente</p>
        </div>
      </div>
      <p className="mb-1.5 text-[10px] text-muted-foreground">¿Qué respondió el cliente?</p>
      <div className="mb-2 flex gap-1.5">
        <FakeButton variant={!changes && p >= 3 ? "primary" : "outline"} pressed={p === 3}>
          <CheckCircle2 className="h-3 w-3" /> Autorizó
        </FakeButton>
        <FakeButton variant={changes && p >= 0 ? "primary" : "outline"} pressed={p === 0}>
          Pidió cambios
        </FakeButton>
      </div>
      <AnimatePresence mode="wait">
        {changes ? (
          <motion.div key="c" {...pop} className="space-y-1.5">
            <div className="rounded-md border border-border px-2 py-1">
              <Typing text="Logo más grande y en azul" active={p >= 1} />
            </div>
            <FakeButton pressed={p === 2}>Devolver a Diseño</FakeButton>
          </motion.div>
        ) : (
          <motion.div key="a" {...pop} className="space-y-1.5">
            <Row>
              <span>Material cargado</span>
              <Check className="h-3 w-3 text-emerald-600" />
            </Row>
            <FakeButton pressed={p === 4}>Pasar a producción</FakeButton>
          </motion.div>
        )}
      </AnimatePresence>
      <Cursor
        at={p === 0 ? [62, 52] : p === 1 ? [40, 72] : p === 2 ? [25, 88] : p === 3 ? [18, 52] : p === 4 ? [25, 88] : null}
        click={p !== 1 && p !== 5}
      />
    </Screen>
  );
}

/** Entregar: marcar entregado desde la lista. */
export function DeliverScene() {
  const p = useScenePhase(4);
  const delivered = p >= 2;
  return (
    <Screen title="Pedidos">
      <div className="space-y-1.5">
        <Row className={cn(p === 1 && "ring-1 ring-primary/40")}>
          <span>EMD-P0128 · Bordados SA</span>
          <span className="flex items-center gap-1.5">
            <AnimatePresence mode="wait">
              {delivered ? (
                <motion.span key="d" {...pop}>
                  <Pill tone="green">
                    <Package className="h-2.5 w-2.5" /> entregado
                  </Pill>
                </motion.span>
              ) : (
                <motion.span key="t" {...pop} className="flex items-center gap-1.5">
                  <Pill tone="green">terminado</Pill>
                  <FakeButton variant="outline" pressed={p === 1}>
                    Marcar entregado
                  </FakeButton>
                </motion.span>
              )}
            </AnimatePresence>
          </span>
        </Row>
        <Row>
          <span>EMD-P0127 · Café Luna</span>
          <Pill tone="blue">en proceso</Pill>
        </Row>
      </div>
      <Cursor at={p <= 1 ? [80, 22] : null} click={p === 1} />
    </Screen>
  );
}

/* ------------------------------- Diseño ------------------------------ */

/** Subir el montaje y enviarlo a Recepción. */
export function UploadMontageScene() {
  const p = useScenePhase(5);
  return (
    <Screen title="Pedido EMD-P0131 · Proceso de diseño">
      <div
        className={cn(
          "mb-2 flex h-16 items-center justify-center rounded-lg border-2 border-dashed border-border text-[11px] text-muted-foreground transition-colors",
          p === 1 && "border-primary bg-primary/5"
        )}
      >
        <AnimatePresence mode="wait">
          {p >= 2 ? (
            <motion.span key="f" {...pop} className="flex items-center gap-1.5 text-foreground">
              <FileImage className="h-5 w-5" /> montaje-escuela.png
            </motion.span>
          ) : (
            <motion.span key="e" {...pop} className="flex items-center gap-1">
              <Upload className="h-3.5 w-3.5" /> Arrastra el montaje aquí o pégalo con Ctrl+V
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      {p === 0 && (
        <motion.div
          className="absolute left-[10%] top-[10%] z-10"
          animate={{ left: "40%", top: "38%" }}
          transition={{ duration: 1 }}
        >
          <FileImage className="h-7 w-7 text-primary" />
        </motion.div>
      )}
      <FakeButton pressed={p === 3}>Enviar montaje a Recepción</FakeButton>
      <AnimatePresence>
        {p >= 4 && (
          <motion.div key="sent" {...pop} className="mt-2">
            <Pill tone="blue">Ronda 1 · Enviada</Pill>
          </motion.div>
        )}
      </AnimatePresence>
      <Cursor at={p === 3 ? [35, 72] : null} click={p === 3} />
    </Screen>
  );
}

/** Rondas: cambios del cliente → nueva ronda → aprobada. */
export function RoundsScene() {
  const p = useScenePhase(4, 1500);
  return (
    <Screen title="Pedido EMD-P0131 · Rondas de montaje">
      <div className="space-y-1.5">
        <Row>
          <span>Ronda 1</span>
          <Pill tone={p >= 1 ? "amber" : "blue"}>{p >= 1 ? "Con cambios" : "Enviada"}</Pill>
        </Row>
        <AnimatePresence>
          {p >= 1 && (
            <motion.div key="fb" {...pop} className="rounded-lg bg-amber-500/10 px-2 py-1.5 text-[11px]">
              El cliente pidió estos cambios: “Logo más grande y en azul”
            </motion.div>
          )}
          {p >= 2 && (
            <motion.div key="r2" {...pop}>
              <Row>
                <span>Ronda 2</span>
                <Pill tone={p >= 3 ? "green" : "blue"}>{p >= 3 ? "Aprobada" : "Enviada"}</Pill>
              </Row>
            </motion.div>
          )}
          {p >= 3 && (
            <motion.p key="ok" {...pop} className="text-[11px] text-emerald-700 dark:text-emerald-300">
              El cliente autorizó el diseño: el pedido pasa a producción.
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </Screen>
  );
}

/* ----------------------------- Producción ---------------------------- */

/** Tomar una tarea libre, empezarla y terminarla. */
export function TakeTaskScene({ area = "Bordado" }: { area?: string }) {
  const p = useScenePhase(5);
  const mine = p >= 2;
  const done = p >= 4;
  const card = (
    <motion.div layoutId="task-card" transition={SPRING_DEFAULT}>
      <Row className="bg-card ring-1 ring-border">
        <span>
          EMD-P0131 · {area} · <span className="text-muted-foreground">entrega mañana</span>
        </span>
        {!mine ? (
          <FakeButton pressed={p === 1}>Tomar y empezar</FakeButton>
        ) : done ? (
          <Pill tone="green">
            <Check className="h-2.5 w-2.5" /> Terminado
          </Pill>
        ) : (
          <span className="flex items-center gap-1">
            <Pill tone="blue">En proceso</Pill>
            <FakeButton variant="outline" pressed={p === 3}>
              Terminar
            </FakeButton>
          </span>
        )}
      </Row>
    </motion.div>
  );
  return (
    <Screen title="Tareas asignadas">
      <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Tuyas</p>
      <div className="mb-3 min-h-[2rem]">{mine ? card : <p className="text-[11px] text-muted-foreground">Sin tareas tuyas</p>}</div>
      <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Libres para tomar</p>
      <div className="min-h-[2rem]">{!mine ? card : <p className="text-[11px] text-muted-foreground">Nada libre</p>}</div>
      <Cursor at={p <= 1 ? [80, 72] : p === 3 ? [85, 30] : null} click={p === 1 || p === 3} />
    </Screen>
  );
}

/** Varias áreas avanzan en paralelo hasta que el pedido queda listo. */
export function AreasProgressScene() {
  const p = useScenePhase(5, 1200);
  const areas = [
    { name: "Bordado", value: Math.min(100, p * 34) },
    { name: "DTF", value: Math.min(100, p * 26) },
  ];
  return (
    <Screen title="Pedido EMD-P0131 · Áreas de producción">
      <div className="space-y-2.5">
        {areas.map((a) => (
          <div key={a.name}>
            <div className="mb-1 flex justify-between">
              <span>{a.name}</span>
              <Pill tone={a.value >= 100 ? "green" : a.value > 0 ? "blue" : "muted"}>
                {a.value >= 100 ? "Terminado" : a.value > 0 ? "En proceso" : "Pendiente"}
              </Pill>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <motion.div className="h-full rounded-full bg-primary" animate={{ width: `${a.value}%` }} transition={SPRING_DEFAULT} />
            </div>
          </div>
        ))}
        <AnimatePresence>
          {p >= 4 && (
            <motion.p key="ready" {...pop} className="rounded-lg bg-emerald-500/10 px-2 py-1.5 text-[11px] text-emerald-700 dark:text-emerald-300">
              Todas las áreas terminaron: el pedido está listo para entregar.
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </Screen>
  );
}

/* ------------------------------ Generales ---------------------------- */

const FLOW_STAGES = ["Recepción", "Diseño", "Autorización", "Producción", "Entrega"];

/** Recorrido del pedido de punta a punta. */
export function OrderFlowScene({ skipDesign = false }: { skipDesign?: boolean }) {
  const stages = skipDesign ? FLOW_STAGES.filter((s) => s !== "Diseño" && s !== "Autorización") : FLOW_STAGES;
  const p = useScenePhase(stages.length, 1100);
  return (
    <Screen title="Pase del pedido">
      <div className="flex items-start justify-between gap-1 pt-3">
        {stages.map((s, i) => (
          <div key={s} className="flex flex-1 flex-col items-center gap-1.5">
            <motion.div
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] font-semibold",
                i < p ? "border-primary bg-primary text-primary-foreground" : i === p ? "border-primary text-primary" : "border-border text-muted-foreground"
              )}
              animate={{ scale: i === p ? 1.15 : 1 }}
              transition={SPRING_DEFAULT}
            >
              {i < p ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </motion.div>
            <span className={cn("text-center text-[10px]", i === p ? "font-semibold" : "text-muted-foreground")}>{s}</span>
          </div>
        ))}
      </div>
      <motion.p key={p} {...pop} className="mt-3 rounded-lg bg-muted/60 px-2 py-1.5 text-center text-[11px]">
        Ahora en <span className="font-semibold">{stages[p]}</span>
      </motion.p>
    </Screen>
  );
}

/** Chat con un pedido adjunto como contexto. */
export function ChatScene() {
  const p = useScenePhase(5);
  return (
    <Screen title="Chat interno · Canal Bordado">
      <div className="flex min-h-[7.5rem] flex-col justify-end gap-1.5">
        <AnimatePresence>
          {p >= 1 && (
            <motion.div key="m1" {...pop} className="flex justify-end">
              <span className="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-3 py-1.5 text-primary-foreground">
                ¿Cómo va este?
                <span className="mt-1 flex items-center gap-1 rounded-md bg-primary-foreground/15 px-1.5 py-0.5 text-[10px]">
                  <Paperclip className="h-2.5 w-2.5" /> Pedido EMD-P0131 · Escuela Norte
                </span>
              </span>
            </motion.div>
          )}
          {p >= 3 && (
            <motion.div key="m2" {...pop} className="flex justify-start">
              <span className="rounded-2xl rounded-bl-md bg-muted px-3 py-1.5">Sale hoy en la tarde 👍</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="mt-2 flex items-center gap-1.5 rounded-full border border-border px-2 py-1">
        <Paperclip className={cn("h-3 w-3", p === 0 ? "text-primary" : "text-muted-foreground")} />
        <span className="flex-1 text-muted-foreground">Escribe un mensaje…</span>
      </div>
      <Cursor at={p === 0 ? [8, 90] : null} click={p === 0} />
    </Screen>
  );
}

/** Campana de notificaciones. */
export function NotificationsScene() {
  const p = useScenePhase(4);
  return (
    <Screen title="EMD">
      <div className="flex justify-end">
        <motion.div className="relative" animate={p === 1 ? { rotate: [0, -15, 15, -10, 0] } : { rotate: 0 }} transition={{ duration: 0.6 }}>
          <Bell className="h-5 w-5" />
          <AnimatePresence>
            {p >= 1 && (
              <motion.span key="badge" {...pop} className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] text-primary-foreground">
                1
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
      <AnimatePresence>
        {p >= 2 && (
          <motion.div key="panel" {...pop} className="ml-auto mt-2 w-[85%] space-y-1.5 rounded-xl border border-border bg-card p-2 shadow-lg">
            <p className="font-semibold">Notificaciones</p>
            <Row className="bg-primary/5">
              <span>Nuevo pedido EMD-P0131 para Bordado</span>
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            </Row>
          </motion.div>
        )}
      </AnimatePresence>
      <Cursor at={p === 2 ? [92, 18] : null} click={p === 2} />
    </Screen>
  );
}

/** Calendario: crear evento y ver entregas. */
export function CalendarScene() {
  const p = useScenePhase(4);
  const days = Array.from({ length: 14 }, (_, i) => i + 1);
  return (
    <Screen title="Calendario">
      <div className="mb-2 flex justify-between">
        <span className="font-semibold">Octubre</span>
        <FakeButton pressed={p === 1}>
          <Plus className="h-3 w-3" /> Nuevo evento
        </FakeButton>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => (
          <div key={d} className="h-9 rounded-md bg-card p-0.5 ring-1 ring-border/60 text-[9px] text-muted-foreground">
            {d}
            {d === 4 && <div className="mt-0.5 truncate rounded bg-emerald-500/20 px-0.5 text-emerald-700 dark:text-emerald-300">EMD-P0131</div>}
            <AnimatePresence>
              {d === 9 && p >= 2 && (
                <motion.div key="ev" {...pop} className="mt-0.5 truncate rounded bg-violet-500/20 px-0.5 text-violet-700 dark:text-violet-300">
                  Instalación
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
      <Cursor at={p === 1 ? [85, 14] : p === 2 ? [30, 80] : null} click={p === 1} />
    </Screen>
  );
}

/** Historial con filtros de cliente, área y fecha. */
export function HistoryFiltersScene() {
  const p = useScenePhase(4, 1400);
  const all = [
    { id: 131, client: "Escuela Norte", area: "Bordado" },
    { id: 120, client: "Café Luna", area: "DTF" },
    { id: 112, client: "Escuela Norte", area: "Láser" },
    { id: 98, client: "Bordados SA", area: "Bordado" },
  ];
  const rows = all.filter((r) => (p >= 1 ? r.client === "Escuela Norte" : true) && (p >= 2 ? r.area === "Bordado" : true));
  return (
    <Screen title="Historial de pedidos">
      <div className="mb-2 flex flex-wrap gap-1.5">
        <Pill tone={p >= 1 ? "violet" : "muted"}>{p >= 1 ? "Escuela Norte" : "Todos los clientes"}</Pill>
        <Pill tone={p >= 2 ? "violet" : "muted"}>{p >= 2 ? "Bordado" : "Todas las áreas"}</Pill>
        <Pill tone={p >= 3 ? "violet" : "muted"}>{p >= 3 ? "1 – 31 oct" : "Entrega"}</Pill>
      </div>
      <div className="space-y-1.5">
        <AnimatePresence initial={false}>
          {rows.map((r) => (
            <motion.div key={r.id} layout {...pop}>
              <Row>
                <span>
                  {formatOrderCode(r.id)} · {r.client}
                </span>
                <Pill>{r.area}</Pill>
              </Row>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <Cursor at={p === 1 ? [15, 18] : p === 2 ? [45, 18] : p === 3 ? [68, 18] : null} click={p > 0} />
    </Screen>
  );
}

/** Inventario: una salida baja el stock y aparece el aviso. */
export function InventoryScene() {
  const p = useScenePhase(4);
  const qty = p >= 2 ? 3 : 15;
  return (
    <Screen title="Inventario">
      <Row className="mb-2">
        <span>Hilo negro · cono</span>
        <span className="flex items-center gap-1.5">
          <motion.span key={qty} {...pop} className="font-semibold tabular-nums">
            {qty}
          </motion.span>
          {p >= 3 && <Pill tone="amber">Bajo stock</Pill>}
        </span>
      </Row>
      <div className="flex gap-1.5">
        <FakeButton variant="outline">Entrada</FakeButton>
        <FakeButton variant="outline" pressed={p === 1}>
          Salida
        </FakeButton>
        <FakeButton variant="outline">Ajuste</FakeButton>
      </div>
      <AnimatePresence>
        {p >= 2 && (
          <motion.p key="mv" {...pop} className="mt-2 text-[11px] text-muted-foreground">
            Salida de 12 · Pedido EMD-P0131 · registrada en el historial
          </motion.p>
        )}
      </AnimatePresence>
      <Cursor at={p === 1 ? [40, 55] : null} click={p === 1} />
    </Screen>
  );
}

/** Inicio por rol: indicadores y el siguiente trabajo. */
export function HomeScene({ kpis, next }: { kpis: [string, number][]; next: string }) {
  const p = useScenePhase(3, 1500);
  return (
    <Screen title="Inicio · En vivo">
      <div className="mb-2 grid grid-cols-3 gap-1.5">
        {kpis.map(([label, value], i) => (
          <div key={label} className="rounded-lg bg-muted/60 p-1.5">
            <p className="truncate text-[9px] text-muted-foreground">{label}</p>
            <motion.p
              className="text-base font-semibold tabular-nums"
              key={p >= 1 ? "v" : "z"}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING_DEFAULT, delay: i * 0.08 }}
            >
              {p >= 1 ? value : 0}
            </motion.p>
          </div>
        ))}
      </div>
      <motion.div
        animate={{ boxShadow: p === 2 ? "0 0 0 2px hsl(var(--primary) / 0.45)" : "0 0 0 0px transparent" }}
        className="rounded-lg bg-card p-2 ring-1 ring-border"
      >
        <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Siguiente</p>
        <p className="font-medium">{next}</p>
      </motion.div>
    </Screen>
  );
}

/** Panel de administración: indicadores y barras por área. */
export function AdminPanelScene() {
  const p = useScenePhase(3, 1500);
  const bars = [
    ["Taller", 70],
    ["DTF", 45],
    ["Bordado", 85],
    ["Diseño", 55],
  ] as const;
  return (
    <Screen title="Rendimiento">
      <div className="space-y-1.5">
        {bars.map(([name, v], i) => (
          <div key={name} className="flex items-center gap-2">
            <span className="w-12 text-[10px] text-muted-foreground">{name}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-primary"
                animate={{ width: p >= 1 ? `${v}%` : "5%" }}
                transition={{ ...SPRING_DEFAULT, delay: i * 0.08 }}
              />
            </div>
          </div>
        ))}
      </div>
      <AnimatePresence>
        {p >= 2 && (
          <motion.div key="alert" {...pop} className="mt-2.5">
            <Row>
              <span>EMD-P0118 lleva 3 días en Diseño</span>
              <Pill tone="red">Estancado</Pill>
            </Row>
          </motion.div>
        )}
      </AnimatePresence>
    </Screen>
  );
}

/** Usuarios: alta de una cuenta con sus roles. */
export function UsersScene() {
  const p = useScenePhase(4);
  return (
    <Screen title="Usuarios">
      <div className="mb-2 flex justify-end">
        <FakeButton pressed={p === 0}>
          <Plus className="h-3 w-3" /> Nuevo Usuario
        </FakeButton>
      </div>
      <div className="space-y-1.5">
        <AnimatePresence>
          {p >= 2 && (
            <motion.div key="u" {...pop}>
              <Row className="ring-1 ring-primary/40">
                <span>Laura M.</span>
                <span className="flex gap-1">
                  <Pill tone="violet">Diseño</Pill>
                  <Pill tone="violet">Bordado</Pill>
                </span>
              </Row>
            </motion.div>
          )}
        </AnimatePresence>
        <Row>
          <span>Recepción (cuenta compartida)</span>
          <Pill>Recepción</Pill>
        </Row>
      </div>
      <AnimatePresence>
        {p === 1 && (
          <motion.div key="f" {...pop} className="absolute inset-x-4 top-10 z-10 space-y-1.5 rounded-xl border border-border bg-card p-3 shadow-lg">
            <p className="font-semibold">Nuevo usuario</p>
            <div className="rounded-md border border-border px-2 py-1">
              <Typing text="Laura M." active />
            </div>
            <div className="flex gap-1">
              <Pill tone="violet">Diseño</Pill>
              <Pill tone="violet">Bordado</Pill>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Cursor at={p === 0 ? [82, 14] : null} click={p === 0} />
    </Screen>
  );
}

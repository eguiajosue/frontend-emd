"use client";

import { type ReactNode } from "react";
import { motion } from "framer-motion";
import Title from "@/components/Title";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { getStatusBadgeClasses } from "@/lib/statusColors";
import { statusOptions } from "@/lib/orderStatus";
import { usePermissions } from "@/hooks/usePermissions";
import { useMotionPreset } from "@/lib/motion";
import {
  BarChart3,
  Bell,
  CheckCircle2,
  ClipboardList,
  History,
  LayoutDashboard,
  ListChecks,
  MessagesSquare,
  PackagePlus,
  Palette,
  Send,
  Split,
  Users,
} from "lucide-react";

/** Un paso de la guía: ícono, título, descripción y una mini "captura" opcional. */
interface GuideStep {
  icon: ReactNode;
  title: string;
  description: string;
  mockup?: ReactNode;
}

interface GuideProfile {
  roleLabel: string;
  intro: string;
  steps: GuideStep[];
}

/** Círculo de ícono reutilizado en pasos y encabezados de sección. */
function IconBadge({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-muted text-foreground">
      {children}
    </div>
  );
}

/**
 * Un paso de la línea de tiempo. Anima su entrada al hacer scroll (fade +
 * leve desplazamiento en Y), respetando reduced-motion vía useMotionPreset.
 */
function TimelineStep({ step, index }: { step: GuideStep; index: number }) {
  const { staggerItemVariants } = useMotionPreset();

  return (
    <motion.li
      className="relative flex gap-4 pb-10 last:pb-0"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.4 }}
      variants={staggerItemVariants}
    >
      {/* Conector vertical sutil entre pasos */}
      <span
        aria-hidden
        className="absolute left-[17px] top-9 bottom-0 w-px bg-border last:hidden"
      />
      <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-card text-sm font-semibold text-muted-foreground">
        {index + 1}
      </div>
      <div className="min-w-0 flex-1 space-y-2 pt-0.5">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{step.icon}</span>
          <h3 className="font-medium leading-none">{step.title}</h3>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {step.description}
        </p>
        {step.mockup && <div className="pt-1">{step.mockup}</div>}
      </div>
    </motion.li>
  );
}

/** Mini "captura" conceptual de una fila de pedido con badge de estado. */
function OrderRowMockup({ statusValue, label }: { statusValue: number; label: string }) {
  return (
    <div className="flex max-w-sm items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`rounded-full border px-2 py-0.5 font-medium capitalize ${getStatusBadgeClasses(
          statusValue,
        )}`}
      >
        {statusOptions.find((o) => o.value === statusValue)?.label}
      </span>
    </div>
  );
}

/** Mini "captura" conceptual de un mensaje de chat entre dos áreas. */
function ChatMockup() {
  return (
    <div className="max-w-sm space-y-1.5 rounded-lg border bg-muted/40 p-3 text-xs">
      <div className="flex justify-start">
        <span className="rounded-lg rounded-bl-sm bg-card px-2.5 py-1.5 shadow-sm">
          ¿En cuánto va el pedido #128?
        </span>
      </div>
      <div className="flex justify-end">
        <span className="rounded-lg rounded-br-sm bg-primary/10 px-2.5 py-1.5 text-foreground">
          Sale hoy, ya está en bordado.
        </span>
      </div>
    </div>
  );
}

const ADMIN_PROFILE: GuideProfile = {
  roleLabel: "administrador",
  intro:
    "Tenés visibilidad total de la operación: todos los pedidos, todas las áreas, usuarios y métricas.",
  steps: [
    {
      icon: <LayoutDashboard className="h-4 w-4" />,
      title: "Panel General",
      description:
        "Vista global de todos los pedidos de la empresa: filtrá por estado, ordená la lista y detectá pedidos estancados (los que tardan más que el promedio histórico de su etapa).",
      mockup: <OrderRowMockup statusValue={3} label="Pedido #128 · Bordados SA" />,
    },
    {
      icon: <BarChart3 className="h-4 w-4" />,
      title: "Rendimiento por área",
      description:
        "En \"Rendimiento\" ves cuántos pedidos tiene cada área (bordado, DTF, diseño, láser, impresiones, taller) en este momento y el tiempo promedio que le toma completar su parte.",
    },
    {
      icon: <Users className="h-4 w-4" />,
      title: "Usuarios, roles, clientes y empresas",
      description:
        "Desde el menú lateral creás, editás o eliminás usuarios y roles, y gestionás clientes y empresas. Los roles determinan qué secciones puede ver y modificar cada persona.",
    },
    {
      icon: <MessagesSquare className="h-4 w-4" />,
      title: "Chat entre áreas",
      description:
        "Podés participar o monitorear las conversaciones entre recepción y cada área de producción para destrabar dudas sin salir de la plataforma.",
      mockup: <ChatMockup />,
    },
    {
      icon: <Bell className="h-4 w-4" />,
      title: "Notificaciones",
      description:
        "Recibís avisos de asignaciones nuevas, cambios de estado y mensajes sin leer desde la campana de notificaciones.",
    },
    {
      icon: <History className="h-4 w-4" />,
      title: "Historial de pedidos",
      description:
        "El historial guarda cada cambio de estado con fecha y hora, para auditar cómo avanzó cualquier pedido de punta a punta.",
    },
  ],
};

const RECEPCION_PROFILE: GuideProfile = {
  roleLabel: "recepción",
  intro:
    "Sos la entrada y salida de cada pedido: lo cargás, lo derivás al área correcta y coordinás con el cliente.",
  steps: [
    {
      icon: <PackagePlus className="h-4 w-4" />,
      title: "Crear un pedido nuevo",
      description:
        "En \"Pedidos\" tocá \"+ Nuevo Pedido\" (o la tecla N), elegí el cliente, completá la descripción y la fecha de entrega, y guardá. Arranca en estado \"pendiente\".",
      mockup: <OrderRowMockup statusValue={1} label="Pedido #131 · Nuevo" />,
    },
    {
      icon: <Split className="h-4 w-4" />,
      title: "Asignar el área",
      description:
        "Si el pedido requiere diseño, se lo derivás a Diseño antes de producción; si no, va directo al área que corresponda (taller, DTF, bordado, láser o impresiones).",
    },
    {
      icon: <Palette className="h-4 w-4" />,
      title: "Seguir el flujo de diseño",
      description:
        "Cuando hay diseño de por medio, seguís el ida y vuelta de montajes en el detalle del pedido hasta que el cliente autoriza y el pedido pasa a producción.",
    },
    {
      icon: <ListChecks className="h-4 w-4" />,
      title: "Tus pendientes y entregas",
      description:
        "En \"Estatus de Pedidos\" ves los pedidos \"pendientes\" (recién cargados) y \"entregados\" (para cerrar la logística de entrega).",
    },
    {
      icon: <MessagesSquare className="h-4 w-4" />,
      title: "Chat con cada área",
      description:
        "Usá el chat para coordinar con diseño o producción sin salir del sistema: adjuntá un pedido como contexto directamente desde el mensaje.",
      mockup: <ChatMockup />,
    },
    {
      icon: <History className="h-4 w-4" />,
      title: "Historial de auditoría",
      description:
        "Consultá el historial para ver cada cambio de estado de un pedido, con fecha y hora, si necesitás reconstruir qué pasó.",
    },
  ],
};

const DISENO_PROFILE: GuideProfile = {
  roleLabel: "diseño",
  intro:
    "Trabajás la etapa previa a producción: armás el montaje y gestionás el ida y vuelta hasta la autorización del cliente.",
  steps: [
    {
      icon: <ClipboardList className="h-4 w-4" />,
      title: "Pedidos que requieren diseño",
      description:
        "En \"Estatus de Pedidos\" te aparecen los pedidos que Recepción marcó como \"requiere diseño\" y que están esperando tu parte.",
      mockup: <OrderRowMockup statusValue={2} label="Pedido #129 · En pruebas" />,
    },
    {
      icon: <Palette className="h-4 w-4" />,
      title: "Subir el montaje",
      description:
        "Desde el detalle del pedido, en \"Proceso de diseño\", subís el montaje para que Recepción se lo envíe al cliente.",
    },
    {
      icon: <Send className="h-4 w-4" />,
      title: "Feedback del cliente",
      description:
        "Si el cliente pide cambios, el pedido vuelve a vos con el detalle de lo solicitado; subís una nueva versión y se repite el ciclo.",
    },
    {
      icon: <CheckCircle2 className="h-4 w-4" />,
      title: "Autorización y pase a producción",
      description:
        "Cuando el cliente autoriza el montaje, el pedido pasa automáticamente al área de producción elegida — tu parte queda registrada en el historial de montajes.",
    },
    {
      icon: <MessagesSquare className="h-4 w-4" />,
      title: "Chat con Recepción",
      description:
        "Resolvé dudas puntuales sobre un pedido por chat, con el pedido adjunto como contexto del mensaje.",
      mockup: <ChatMockup />,
    },
  ],
};

const PRODUCCION_PROFILE: GuideProfile = {
  roleLabel: "producción",
  intro:
    "Ves sólo los pedidos que están en la etapa de tu área y avanzás su estado cuando terminás tu parte.",
  steps: [
    {
      icon: <ClipboardList className="h-4 w-4" />,
      title: "Tus pedidos asignados",
      description:
        "\"Estatus de Pedidos\" muestra únicamente los pedidos \"en proceso\" que le corresponden a tu área — nada de otras etapas, para no generar confusión.",
      mockup: <OrderRowMockup statusValue={3} label="Pedido #124 · En proceso" />,
    },
    {
      icon: <CheckCircle2 className="h-4 w-4" />,
      title: "Avanzar el estado",
      description:
        "Cuando termines, abrí el pedido y usá el selector de estado para pasarlo a la siguiente etapa. Queda registrado en el historial con fecha y hora.",
    },
    {
      icon: <MessagesSquare className="h-4 w-4" />,
      title: "Chat con Recepción",
      description:
        "Si necesitás aclarar algo de un pedido, escribile a Recepción por chat en vez de interrumpir por otro medio.",
      mockup: <ChatMockup />,
    },
    {
      icon: <Bell className="h-4 w-4" />,
      title: "Notificaciones de asignación",
      description:
        "La campana de notificaciones te avisa apenas te llega un pedido nuevo o cambia algo relevante para tu área.",
    },
  ],
};

/** Preview interactivo de los botones de estado (colores compartidos en toda la app). */
function StatusButtonsPreview() {
  return (
    <div className="flex flex-wrap gap-2">
      {statusOptions.map((opt) => (
        <span
          key={opt.value}
          className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${getStatusBadgeClasses(
            opt.value,
          )}`}
        >
          {opt.label}
        </span>
      ))}
    </div>
  );
}

function pickProfile(roles: string[], isAdmin: boolean): GuideProfile {
  if (isAdmin) return ADMIN_PROFILE;
  if (roles.includes("diseno")) return DISENO_PROFILE;
  if (roles.includes("recepcion")) return RECEPCION_PROFILE;
  return PRODUCCION_PROFILE;
}

const AyudaPage = () => {
  const { roles, isAdmin } = usePermissions();
  const hasKnownRole = isAdmin || roles.length > 0;
  const profile = pickProfile(roles, isAdmin);

  return (
    <div className="space-y-8 pb-10">
      <Title title="Ayuda" />

      {hasKnownRole ? (
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">
            Guía para vos, <Badge variant="secondary" className="align-middle capitalize">{profile.roleLabel}</Badge>
          </p>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {profile.intro}
          </p>
        </div>
      ) : (
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Tu usuario todavía no tiene un rol asignado. Pedile a un
          administrador que te asigne uno para ver tus tareas acá.
        </p>
      )}

      {hasKnownRole && (
        <Card>
          <CardContent className="pt-6">
            <ol className="relative">
              {profile.steps.map((step, index) => (
                <TimelineStep key={step.title} step={step} index={index} />
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <IconBadge>
            <BarChart3 className="h-4 w-4" />
          </IconBadge>
          <h2 className="text-lg font-semibold tracking-tight">Colores de estado</h2>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          En toda la app un mismo estado siempre tiene el mismo color, así lo
          identificás de un vistazo sin importar en qué pantalla estés.
        </p>
        <StatusButtonsPreview />
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <IconBadge>
            <ListChecks className="h-4 w-4" />
          </IconBadge>
          <h2 className="text-lg font-semibold tracking-tight">Preguntas frecuentes</h2>
        </div>
        <Card>
          <CardContent className="px-2 py-2 sm:px-4">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="atajos">
                <AccordionTrigger>¿Qué atajos de teclado hay?</AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-1.5">
                    <li>
                      <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">
                        Ctrl/Cmd + K
                      </kbd>{" "}
                      abre el buscador rápido (navegar a una sección o buscar un pedido).
                    </li>
                    <li>
                      <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">N</kbd>{" "}
                      en la pantalla de Pedidos abre &quot;+ Nueva Orden&quot; (sin tener nada
                      escribiendo en un campo).
                    </li>
                    <li>
                      <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">Esc</kbd>{" "}
                      cierra cualquier ventana o diálogo abierto.
                    </li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="diseno">
                <AccordionTrigger>¿Cómo funciona el flujo de diseño?</AccordionTrigger>
                <AccordionContent>
                  Cuando un pedido &quot;requiere diseño&quot;, no va directo a
                  producción: Recepción lo asigna a Diseño, Diseño sube un
                  montaje, Recepción se lo envía al cliente y espera su
                  autorización. Si pide cambios, vuelve a Diseño tantas veces
                  como haga falta; cuando el cliente autoriza, el pedido salta
                  al área de producción elegida. Todo queda registrado en la
                  sección &quot;Proceso de diseño&quot; del detalle del pedido.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="mas-ayuda">
                <AccordionTrigger>¿Necesitás más ayuda?</AccordionTrigger>
                <AccordionContent>
                  Si algo no funciona como esperás o necesitás un permiso que
                  no tenés, contactá a un administrador de EMD Bordados.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AyudaPage;

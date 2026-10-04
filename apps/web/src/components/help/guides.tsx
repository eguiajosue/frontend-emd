import type { ReactNode } from "react";
import {
  AdminPanelScene,
  AreasProgressScene,
  CalendarScene,
  ChatScene,
  ClientReplyScene,
  DeliverScene,
  DesignChoiceScene,
  FrequentsScene,
  HistoryFiltersScene,
  HomeScene,
  InventoryScene,
  LearnedClientScene,
  NewOrderScene,
  NotificationsScene,
  OrderFlowScene,
  RoundsScene,
  TakeTaskScene,
  UploadMontageScene,
  UsersScene,
} from "./HelpScenes";

export type GuideKey = "admin" | "recepcion" | "diseno" | "produccion";

export interface GuideStep {
  title: string;
  text: string;
  scene: ReactNode;
}

export interface Guide {
  key: GuideKey;
  label: string;
  intro: string;
  steps: GuideStep[];
}

const PRODUCTION_ROLES = ["taller", "dtf", "bordado", "laser", "impresiones"];
const ADMIN_ROLES = ["admin", "superuser"];

/**
 * Qué guías ve un usuario. Una por cada forma distinta de usar la app: las
 * cinco áreas de producción trabajan igual, así que alguien de Taller y DTF
 * ve una sola guía de Producción; alguien de Taller y Diseño ve las dos.
 * Administración incluye la de Recepción porque también carga y entrega pedidos.
 */
export function resolveGuideKeys(roles: string[], isAdmin: boolean): GuideKey[] {
  const keys: GuideKey[] = [];
  const admin = isAdmin || roles.some((r) => ADMIN_ROLES.includes(r));
  if (admin) keys.push("admin");
  if (admin || roles.includes("recepcion")) keys.push("recepcion");
  if (roles.includes("diseno")) keys.push("diseno");
  if (roles.some((r) => PRODUCTION_ROLES.includes(r))) keys.push("produccion");
  return keys;
}

const chatStep: GuideStep = {
  title: "Chat con el pedido adjunto",
  text: "En \"Chat interno\" escribe en el canal del área o por mensaje directo. Con el clip adjuntas un pedido para que todos sepan de cuál hablas, sin copiar números.",
  scene: <ChatScene />,
};

const notificationsStep: GuideStep = {
  title: "Notificaciones",
  text: "La campana te avisa de pedidos nuevos, cambios y mensajes. En \"Configuración\" eliges qué avisos recibir y activas las notificaciones push del celular.",
  scene: <NotificationsScene />,
};

export const GUIDES: Record<GuideKey, Guide> = {
  recepcion: {
    key: "recepcion",
    label: "Recepción",
    intro: "Recibes cada pedido, lo mandas al área correcta, hablas con el cliente y lo entregas.",
    steps: [
      {
        title: "Tu inicio en vivo",
        text: "En \"Inicio\" ves de un vistazo los pedidos vencidos, por vencer, los que esperan al cliente y los listos para entregar. Se actualiza solo.",
        scene: (
          <HomeScene
            kpis={[
              ["Vencidos", 2],
              ["Esperando al cliente", 5],
              ["Listos para entregar", 3],
            ]}
            next="#128 · Bordados SA · listo para entregar"
          />
        ),
      },
      {
        title: "Crear un pedido",
        text: "En \"Pedidos\" toca \"+ Nueva Orden\" (o la tecla N). Elige el cliente, agrega los productos y la fecha de entrega, y toca \"Crear pedido\" (o Ctrl+Enter). Si no pones hora, queda a las 18:00.",
        scene: <NewOrderScene />,
      },
      {
        title: "La app recuerda a tus clientes",
        text: "Al elegir un cliente registrado aparece \"Lo habitual\" y lo que \"Suele pedir\", con sus cantidades de siempre. También puedes usar sus plantillas o \"Repetir pedido\" desde un pedido anterior.",
        scene: <LearnedClientScene />,
      },
      {
        title: "Tus frecuentes",
        text: "Los productos de \"Frecuentes\" se agregan con un toque. Con \"Personalizar\" eliges cuáles ver y los ordenas arrastrando. Solo cambian para ti.",
        scene: <FrequentsScene />,
      },
      {
        title: "Con diseño o sin diseño",
        text: "Con diseño, el pedido pasa primero por Diseño. Sin diseño, va directo a las áreas de producción que elijas (al menos una).",
        scene: <DesignChoiceScene />,
      },
      {
        title: "Lo que responde el cliente",
        text: "Cuando Diseño te envía el montaje, descárgalo y muéstraselo al cliente. Luego, en \"Proceso de diseño\", marca si \"Autorizó\" (carga el material y pasa a producción) o si \"Pidió cambios\" (escribe qué cambiar y devuélvelo a Diseño).",
        scene: <ClientReplyScene />,
      },
      {
        title: "Seguir la producción",
        text: "En el detalle del pedido ves cómo avanza cada área. Cuando todas terminan, el pedido queda listo para entregar.",
        scene: <AreasProgressScene />,
      },
      {
        title: "Entregar",
        text: "Cuando el cliente recoge, toca \"Marcar entregado\" en la lista de pedidos. Queda guardado en el historial.",
        scene: <DeliverScene />,
      },
      {
        title: "Calendario",
        text: "Las entregas aparecen solas en el calendario. Con \"Nuevo evento\" agendas instalaciones, visitas o compras, con aviso previo. Las tareas sin fecha van en \"Tareas pendientes\".",
        scene: <CalendarScene />,
      },
      {
        title: "Buscar en el historial",
        text: "En \"Historial\" encuentras cualquier pedido, incluso los entregados hace tiempo. Filtra por cliente, por área y por fecha de entrega.",
        scene: <HistoryFiltersScene />,
      },
      {
        title: "Inventario",
        text: "Registra entradas (compras), salidas (consumo o uso en un pedido) y ajustes (lo que hay en el estante). Te avisa cuando algo está bajo o agotado.",
        scene: <InventoryScene />,
      },
      chatStep,
      notificationsStep,
    ],
  },
  diseno: {
    key: "diseno",
    label: "Diseño",
    intro: "Preparas el montaje de cada pedido y lo ajustas hasta que el cliente lo autoriza.",
    steps: [
      {
        title: "Tu inicio en vivo",
        text: "En \"Inicio\" ves los cambios que pidió el cliente, los diseños nuevos y los que esperan respuesta. \"Siguiente diseño\" te dice por cuál seguir.",
        scene: (
          <HomeScene
            kpis={[
              ["Cambios del cliente", 1],
              ["Nuevos sin empezar", 4],
              ["Esperando al cliente", 2],
            ]}
            next="#131 · Escuela Norte · Abrir y empezar"
          />
        ),
      },
      {
        title: "Tomar un diseño",
        text: "En \"Tareas asignadas\" están los tuyos y los libres. Toma uno libre y empieza: así el equipo sabe quién lo está haciendo.",
        scene: <TakeTaskScene area="Diseño" />,
      },
      {
        title: "Enviar el montaje",
        text: "En el pedido, en \"Proceso de diseño\", arrastra el montaje, pégalo con Ctrl+V o adjúntalo, y toca \"Enviar montaje a Recepción\". Recepción se lo muestra al cliente.",
        scene: <UploadMontageScene />,
      },
      {
        title: "Cambios y rondas",
        text: "Si el cliente pide cambios, verás \"El cliente pidió estos cambios\". Sube el montaje corregido y se crea una nueva ronda. Cuando lo autoriza, el pedido pasa solo a producción.",
        scene: <RoundsScene />,
      },
      {
        title: "Por dónde va el pedido",
        text: "\"Pase del pedido\" muestra en qué etapa está y quién lo tiene: Recepción, Diseño, Autorización, Producción y Entrega.",
        scene: <OrderFlowScene />,
      },
      chatStep,
      notificationsStep,
    ],
  },
  produccion: {
    key: "produccion",
    label: "Producción",
    intro: "Ves solo los trabajos de tu área, los tomas y marcas tu parte como terminada.",
    steps: [
      {
        title: "Tu inicio en vivo",
        text: "En \"Inicio\" ves lo vencido, lo que vence pronto y lo que llega de Diseño. \"Siguiente trabajo\" te dice cuál conviene hacer primero.",
        scene: (
          <HomeScene
            kpis={[
              ["Vencidos", 1],
              ["Por vencer", 3],
              ["Sin empezar", 4],
            ]}
            next="#131 · Bordado · Tomar y empezar"
          />
        ),
      },
      {
        title: "Tomar y empezar",
        text: "En \"Tareas asignadas\" están \"Tuyas\" y \"Libres para tomar\". Toca \"Tomar y empezar\" y, al acabar, \"Terminar\".",
        scene: <TakeTaskScene />,
      },
      {
        title: "Varias áreas a la vez",
        text: "Si un pedido lleva bordado y DTF, cada área avanza por su cuenta. Cuando todas terminan, Recepción ve que está listo para entregar.",
        scene: <AreasProgressScene />,
      },
      {
        title: "Por dónde va el pedido",
        text: "Si el pedido no lleva diseño, llega directo a tu área. \"Pase del pedido\" muestra la etapa y quién lo tiene.",
        scene: <OrderFlowScene skipDesign />,
      },
      chatStep,
      notificationsStep,
    ],
  },
  admin: {
    key: "admin",
    label: "Administración",
    intro: "Ves toda la operación: métricas, pedidos atorados, usuarios y permisos.",
    steps: [
      {
        title: "Panel General y Rendimiento",
        text: "\"Panel General\" muestra lo que vence pronto y los pedidos estancados, con una sugerencia. En \"Rendimiento\" comparas áreas y personas: asignados, completados y tiempo promedio.",
        scene: <AdminPanelScene />,
      },
      {
        title: "Usuarios y roles",
        text: "En \"Usuarios\" das de alta personas o cuentas compartidas de área y les asignas uno o varios roles. Cada rol define qué ve y qué puede hacer.",
        scene: <UsersScene />,
      },
      {
        title: "El recorrido de un pedido",
        text: "Recepción lo crea, Diseño prepara el montaje, el cliente lo autoriza, producción lo hace y Recepción lo entrega. Todo queda en el historial.",
        scene: <OrderFlowScene />,
      },
      {
        title: "Historial",
        text: "Busca cualquier pedido por cliente, área y fecha de entrega, o expórtalo a CSV.",
        scene: <HistoryFiltersScene />,
      },
    ],
  },
};

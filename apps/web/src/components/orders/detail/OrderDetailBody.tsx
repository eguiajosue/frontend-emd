"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import { DesignFlowSection } from "@/components/orders/DesignFlowSection";
import { AreaTasksSection } from "@/components/orders/AreaTasksSection";
import { CollapsibleSection, DetailSection } from "@/components/orders/detail/DetailSection";
import { OrderDetailsSection } from "@/components/orders/detail/OrderDetailsSection";
import {
  OrderProgressPanel,
  type OrderDetailSectionTarget,
} from "@/components/orders/detail/OrderProgressPanel";
import { OrderActivitySection, OrderNotesSection } from "@/components/orders/detail/OrderActivitySections";
import { useAreaTasks } from "@/hooks/useAreaTasks";
import { usePermissions } from "@/hooks/usePermissions";
import { buildOrderHandoff } from "@/lib/orderHandoff";
import {
  getOrderDetailPermissions,
  type OrderDetailPermissions,
  type OrderDetailViewer,
} from "@/lib/orderDetail";
import type { Order } from "@/types";

/** Quién mira el pedido y qué puede hacer con él. */
export function useOrderDetailAccess(order: Order | undefined): {
  viewer: OrderDetailViewer;
  permissions: OrderDetailPermissions | null;
} {
  const { roles, isAdmin, canManageOperations } = usePermissions();
  const viewer = useMemo(
    () => ({ roles, isAdmin, canManageOperations }),
    [roles, isAdmin, canManageOperations]
  );
  const permissions = useMemo(
    () => (order ? getOrderDetailPermissions(order, viewer) : null),
    [order, viewer]
  );
  return { viewer, permissions };
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const SECTION_IDS: Record<OrderDetailSectionTarget, string> = {
  design: "order-section-design",
  areas: "order-section-areas",
};

/**
 * Cuerpo del detalle de pedido, compartido por el diálogo y la página
 * `/dashboard/orders/[id]`.
 *
 * Una sola columna, en el orden en que cada rol lo necesita: el operario
 * viene a ver su parte y qué producir; Diseño, el montaje; Recepción y admin,
 * los datos y el circuito. Lo que no le toca a nadie ahora (diseño ya
 * resuelto, actividad) queda plegado en una línea.
 */
export function OrderDetailBody({
  order,
  viewer,
  permissions,
  editing,
  onEditingChange,
}: {
  order: Order;
  viewer: OrderDetailViewer;
  permissions: OrderDetailPermissions;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}) {
  // Misma queryKey que el panel de progreso y "Producción": sin request extra.
  const { tasks } = useAreaTasks(order.id);
  const handoff = buildOrderHandoff(order, tasks);
  const stage = handoff.current.key;

  const isManager = permissions.canEdit;
  const isDesigner = !isManager && viewer.roles.includes("diseno");

  const goToSection = useCallback((section: OrderDetailSectionTarget) => {
    document
      .getElementById(SECTION_IDS[section])
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const details = (
    <OrderDetailsSection
      key="details"
      order={order}
      permissions={permissions}
      editing={editing}
      onEditingChange={onEditingChange}
    />
  );

  let design: ReactNode = null;
  if (order.requiresDesign) {
    const designIsLive = stage === "diseno" || stage === "autorizacion";
    const designStage = handoff.stages.find((s) => s.key === "autorizacion" && s.detail)
      ?? handoff.stages.find((s) => s.key === "diseno");
    design =
      designIsLive || isDesigner ? (
        <DetailSection key="design" id={SECTION_IDS.design} title="Diseño">
          <DesignFlowSection order={order} embedded />
        </DetailSection>
      ) : (
        <CollapsibleSection
          key="design"
          id={SECTION_IDS.design}
          title="Diseño"
          summary={capitalize(designStage?.detail ?? "todavía no empezó")}
        >
          <DesignFlowSection order={order} embedded />
        </CollapsibleSection>
      );
  }

  const areas = (
    <DetailSection key="areas" id={SECTION_IDS.areas} title="Producción">
      <AreaTasksSection order={order} embedded />
    </DetailSection>
  );

  // Diseño arrancando un pedido nuevo necesita primero el brief (qué hay que
  // hacer y los archivos del cliente); con cambios pedidos, lo primero es
  // la sección de Diseño, que abre con lo que pidió el cliente.
  const designerStartsFresh =
    isDesigner && (order.status?.name ?? "").toLowerCase() === "en diseño";
  const ordered = isManager
    ? [details, design, areas]
    : isDesigner
      ? designerStartsFresh
        ? [details, design, areas]
        : [design, details, areas]
      : [areas, details, design];

  return (
    <div className="space-y-4 sm:space-y-5">
      <OrderProgressPanel
        order={order}
        permissions={permissions}
        viewer={viewer}
        onGoToSection={goToSection}
      />
      {ordered}
      <OrderNotesSection orderId={order.id} />
      {permissions.canSeeHistory && <OrderActivitySection orderId={order.id} />}
    </div>
  );
}

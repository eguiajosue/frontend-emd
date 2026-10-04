"use client";

import { formatOrderCode } from "@/lib/orderCode";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCheck,
  CircleCheckBig,
  Flame,
  Hourglass,
  Package,
  PackageCheck,
  Plus,
  ShoppingCart,
  UserRoundSearch,
} from "lucide-react";
import { GreetingHeader } from "@/components/admin/GreetingHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/feedback/states";
import { OrderDetailDialog } from "@/components/orders/OrderDetailDialog";
import { useReceptionDashboard } from "@/hooks/useDashboard";
import { useNow } from "@/hooks/useNow";
import { getAreaIcon, getAreaLabel } from "@/lib/areas";
import { orderViewHref } from "@/lib/orderViews";
import { ATTENTION_META, HEALTH_META, attentionText, relativeTo } from "@/lib/homeDashboard";
import { cn } from "@/lib/utils";
import type { DashboardAreaLoad, ReceptionDashboard } from "@/types";
import { HomeSection, LiveStatus, Panel, StatTile, productsLine } from "./HomeShared";

const ThroughputChart = dynamic(() => import("./ThroughputChart"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Una tarjeta por área: cuánto espera, cuánto se trabaja, cómo viene de plazos y quién está. */
function AreaCard({ load, now }: { load: DashboardAreaLoad; now: number }) {
  const Icon = getAreaIcon(load.area);
  const health = HEALTH_META[load.health];
  const isDesign = load.area === "diseno";
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-soft dark:border-border">
      <header className="flex items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-2 font-medium">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            {Icon && <Icon className="h-4 w-4" aria-hidden />}
          </span>
          <span className="truncate">{getAreaLabel(load.area)}</span>
        </h3>
        <span className={cn("inline-flex shrink-0 items-center gap-1.5 text-xs font-medium", health.text)}>
          <span className={cn("h-2 w-2 rounded-full", health.dot)} aria-hidden />
          {health.label}
        </span>
      </header>

      <dl className="grid grid-cols-3 gap-2">
        {[
          { label: isDesign ? "Nuevos" : "Sin empezar", value: load.pending },
          { label: "En curso", value: load.inProgress },
          { label: isDesign ? "Autoriz. hoy" : "Hechas hoy", value: load.doneToday },
        ].map((stat) => (
          <div key={stat.label} className="min-w-0">
            <dt className="truncate text-meta">{stat.label}</dt>
            <dd className="font-heading text-xl font-semibold tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>

      {(load.overdue > 0 || load.atRisk > 0 || load.upcoming > 0 || (load.changesRequested ?? 0) > 0 || (load.waitingClient ?? 0) > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {load.overdue > 0 && (
            <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-400/15 dark:text-rose-300">
              {plural(load.overdue, "vencido", "vencidos")}
            </span>
          )}
          {load.atRisk > 0 && (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">
              {plural(load.atRisk, "por vencer", "por vencer")}
            </span>
          )}
          {(load.changesRequested ?? 0) > 0 && (
            <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-400/15 dark:text-orange-300">
              {plural(load.changesRequested!, "con cambios", "con cambios")}
            </span>
          )}
          {(load.waitingClient ?? 0) > 0 && (
            <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-400/15 dark:text-violet-300">
              {plural(load.waitingClient!, "esperando cliente", "esperando cliente")}
            </span>
          )}
          {load.upcoming > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              +{load.upcoming} llega{load.upcoming === 1 ? "" : "n"} de Diseño
            </span>
          )}
        </div>
      )}

      <div className="mt-auto space-y-0.5 border-t border-border/60 pt-3 text-meta">
        <p className="truncate">
          {load.oldestWaitingSince
            ? `Lo más viejo espera desde ${relativeTo(load.oldestWaitingSince, now)}`
            : "Nada esperando"}
        </p>
        <p className="truncate">{load.people.length > 0 ? `Trabajando: ${load.people.join(", ")}` : "Nadie con trabajo en curso"}</p>
      </div>
    </article>
  );
}

function AlertRow({ icon: Icon, href, children }: { icon: typeof Package; href: string; children: ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
      >
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1">{children}</span>
      </Link>
    </li>
  );
}

function ReceptionSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}

function subtitleFor(data: ReceptionDashboard | undefined): string {
  if (!data) return "Así va el taller ahora mismo, área por área.";
  const parts = [plural(data.totals.active, "pedido activo", "pedidos activos")];
  if (data.deadlines.overdue) parts.push(plural(data.deadlines.overdue, "vencido", "vencidos"));
  if (data.deadlines.atRisk) parts.push(`${data.deadlines.atRisk} por vencer`);
  if (data.totals.ready) parts.push(`${data.totals.ready} listo${data.totals.ready === 1 ? "" : "s"} para entregar`);
  return `${parts.join(" · ")}.`;
}

/**
 * Inicio de Recepción: control en vivo de todas las áreas. Arriba los
 * números que importan (cada uno lleva a su lista); al centro lo que requiere
 * atención y la carga de cada área; al costado el ritmo de la semana, los
 * clientes que por su costumbre deberían estar por pedir y las alertas.
 */
export function ReceptionHome({ firstName, switcher }: { firstName?: string | null; switcher?: ReactNode }) {
  const { data, isLoading, isError, isFetching, updatedAt, refetch } = useReceptionDashboard();
  const now = useNow(60_000);
  const [openOrderId, setOpenOrderId] = useState<number | null>(null);

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <GreetingHeader firstName={firstName} subtitle={subtitleFor(data)} />
        <div className="flex flex-wrap items-center gap-3">
          <LiveStatus updatedAt={updatedAt} isFetching={isFetching} onRefresh={() => void refetch()} />
          {switcher}
        </div>
      </div>

      {isError && !data ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : isLoading || !data ? (
        <ReceptionSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <StatTile
              icon={Package}
              label="Pedidos activos"
              value={data.totals.active}
              hint={`${data.totals.inProduction} en producción · ${data.totals.inDesign} en diseño`}
              href="/dashboard/orders"
            />
            <StatTile
              icon={Flame}
              label="Vencidos"
              value={data.deadlines.overdue}
              tone="danger"
              hint="sin terminar"
              href={orderViewHref("overdue")}
            />
            <StatTile
              icon={Hourglass}
              label="Por vencer"
              value={data.deadlines.atRisk}
              tone="warn"
              hint="en las próximas 48 h"
              href={orderViewHref("at_risk")}
            />
            <StatTile
              icon={UserRoundSearch}
              label="Esperando al cliente"
              value={data.totals.waitingClient}
              tone="info"
              hint="autorización del montaje"
            />
            <StatTile
              icon={PackageCheck}
              label="Listos para entregar"
              value={data.totals.ready}
              tone="good"
              href={orderViewHref("finished")}
            />
            <StatTile
              icon={CheckCheck}
              label="Entregados hoy"
              value={data.today.delivered}
              hint={`${plural(data.today.created, "creado", "creados")} · ${plural(data.today.tasksCompleted, "tarea hecha", "tareas hechas")}`}
            />
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-3 lg:items-start">
            <div className="min-w-0 space-y-8 lg:col-span-2">
              <HomeSection
                id="home-attention"
                title="Requiere atención"
                count={data.attentionTotal}
                action={{ label: "Ver pedidos", href: "/dashboard/orders" }}
              >
                {data.attention.length === 0 ? (
                  <Panel className="flex items-center gap-3 px-4 py-5 text-sm text-muted-foreground">
                    <CircleCheckBig className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
                    Todo en orden: ningún pedido vencido, trabado ni esperando de más.
                  </Panel>
                ) : (
                  <Panel>
                    <ul className="divide-y divide-border/60">
                      {data.attention.map((item) => {
                        const meta = ATTENTION_META[item.reason];
                        return (
                          <li key={`${item.id}-${item.reason}`} className="flex items-center gap-3 px-4 py-3">
                            {/* En celular la píldora va arriba del texto; desde sm, al costado. */}
                            <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                              <span className={cn("w-fit shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", meta.pill)}>
                                {meta.label}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">
                                  <span className="tabular-nums text-muted-foreground">{formatOrderCode(item.id)}</span> {item.clientName}
                                  <span className="font-normal text-muted-foreground"> · {productsLine(item.products)}</span>
                                </p>
                                <p className="truncate text-meta">{attentionText(item.reason, item.since, now)}</p>
                              </div>
                            </div>
                            <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setOpenOrderId(item.id)}>
                              Abrir
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                    {data.attentionTotal > data.attention.length && (
                      <p className="border-t border-border/60 px-4 py-2.5 text-meta">
                        Y {data.attentionTotal - data.attention.length} más en Pedidos.
                      </p>
                    )}
                  </Panel>
                )}
              </HomeSection>

              <HomeSection id="home-areas" title="Áreas en vivo">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {data.areas.map((load) => (
                    <AreaCard key={load.area} load={load} now={now} />
                  ))}
                </div>
              </HomeSection>
            </div>

            <div className="min-w-0 space-y-8">
              <HomeSection id="home-pace" title="Ritmo de la semana">
                <Panel className="space-y-3 p-4">
                  <div className="h-44">
                    <ThroughputChart data={data.throughput} />
                  </div>
                  <p className="text-meta">
                    Hoy: {plural(data.today.created, "pedido creado", "pedidos creados")} ·{" "}
                    {plural(data.today.delivered, "entregado", "entregados")} ·{" "}
                    {plural(data.today.designsApproved, "diseño autorizado", "diseños autorizados")}
                  </p>
                </Panel>
              </HomeSection>

              <HomeSection
                id="home-clients-due"
                title="Clientes por pedir"
                count={data.clientsDue.length}
              >
                {data.clientsDue.length === 0 ? (
                  <Panel className="px-4 py-4 text-sm text-muted-foreground">
                    Nadie atrasado respecto de su costumbre. Se van detectando solos a medida que piden.
                  </Panel>
                ) : (
                  <Panel>
                    <ul className="divide-y divide-border/60">
                      {data.clientsDue.map((client) => (
                        <li key={client.clientId} className="flex items-center gap-3 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{client.clientName}</p>
                            <p className="line-clamp-2 text-meta">
                              Pide cada ~{client.medianDays} días · el último {relativeTo(client.lastOrderAt, now)}
                              {client.topProduct ? ` · suele pedir ${client.topProduct}` : ""}
                            </p>
                          </div>
                          <Button asChild variant="outline" size="sm" className="shrink-0 gap-1">
                            <Link href={`/dashboard/orders?new=1&newFor=${client.clientId}`} aria-label={`Nuevo pedido para ${client.clientName}`}>
                              <Plus className="h-3.5 w-3.5" aria-hidden />
                              Pedido
                            </Link>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </Panel>
                )}
              </HomeSection>

              <HomeSection id="home-alerts" title="Alertas">
                {data.alerts.lowStock + data.alerts.outOfStock === 0 && data.alerts.purchasesDue === 0 ? (
                  <Panel className="px-4 py-4 text-sm text-muted-foreground">Sin alertas de stock ni compras pendientes.</Panel>
                ) : (
                  <Panel>
                    <ul className="divide-y divide-border/60">
                      {data.alerts.lowStockItems.map((item) => (
                        <AlertRow key={item.id} icon={AlertTriangle} href="/dashboard/inventario">
                          <span className="font-medium">{item.name}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            · {getAreaLabel(item.area)} ·{" "}
                            {item.stockStatus === "out"
                              ? "Agotado"
                              : `Quedan ${item.quantity}${item.minStock !== null ? ` (mín. ${item.minStock})` : ""}`}
                          </span>
                        </AlertRow>
                      ))}
                      {data.alerts.lowStock + data.alerts.outOfStock > data.alerts.lowStockItems.length && (
                        <AlertRow icon={AlertTriangle} href="/dashboard/inventario">
                          Ver todo el inventario bajo ({data.alerts.lowStock + data.alerts.outOfStock})
                        </AlertRow>
                      )}
                      {data.alerts.purchasesDue > 0 && (
                        <AlertRow icon={ShoppingCart} href="/dashboard/calendario">
                          {plural(data.alerts.purchasesDue, "compra de materiales pendiente", "compras de materiales pendientes")} esta semana
                        </AlertRow>
                      )}
                    </ul>
                  </Panel>
                )}
              </HomeSection>
            </div>
          </div>
        </>
      )}

      <OrderDetailDialog orderId={openOrderId} onClose={() => setOpenOrderId(null)} />
    </div>
  );
}

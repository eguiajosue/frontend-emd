"use client";

import { type ReactNode } from "react";
import Title from "@/components/Title";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { getStatusBadgeClasses } from "@/lib/statusColors";
import { statusOptions } from "@/lib/orderStatus";
import { usePermissions } from "@/hooks/usePermissions";
import { GuideStepper } from "@/components/help/GuideStepper";
import { GUIDES, resolveGuideKeys } from "@/components/help/guides";
import { BarChart3, LifeBuoy, ListChecks } from "lucide-react";

/** Círculo de ícono reutilizado en encabezados de sección. */
function IconBadge({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
      {children}
    </div>
  );
}

/** Preview interactivo de los botones de estado (colores compartidos en toda la app). */
function StatusButtonsPreview() {
  return (
    <div className="flex flex-wrap gap-2">
      {statusOptions.map((opt) => (
        <Badge
          key={opt.value}
          variant="muted"
          className={`px-3 py-1 capitalize ${getStatusBadgeClasses(opt.value)}`}
        >
          {opt.label}
        </Badge>
      ))}
    </div>
  );
}

const AyudaPage = () => {
  const { roles, isAdmin } = usePermissions();
  const guides = resolveGuideKeys(roles, isAdmin).map((key) => GUIDES[key]);

  return (
    <div className="space-y-6 pb-10">
      <Title title="Ayuda" />

      {guides.length === 0 ? (
        <Card className="flex items-center gap-4 p-5 sm:p-6">
          <IconBadge>
            <LifeBuoy className="h-5 w-5" />
          </IconBadge>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Tu usuario todavía no tiene un rol asignado. Pide a un administrador que te asigne uno para ver aquí
            cómo usar la app.
          </p>
        </Card>
      ) : guides.length === 1 ? (
        <section className="space-y-3">
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{guides[0].intro}</p>
          <GuideStepper guide={guides[0]} />
        </section>
      ) : (
        <Tabs defaultValue={guides[0].key} className="space-y-3">
          <TabsList aria-label="Tus formas de usar la app">
            {guides.map((g) => (
              <TabsTrigger key={g.key} value={g.key}>
                {g.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {guides.map((g) => (
            <TabsContent key={g.key} value={g.key} className="space-y-3">
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{g.intro}</p>
              <GuideStepper guide={g} />
            </TabsContent>
          ))}
        </Tabs>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card className="space-y-4 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <IconBadge>
              <BarChart3 className="h-4 w-4" />
            </IconBadge>
            <h2 className="text-section-title">Colores de estado</h2>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            En toda la app un mismo estado siempre tiene el mismo color, así lo
            identificas de un vistazo sin importar en qué pantalla estés.
          </p>
          <StatusButtonsPreview />
        </Card>

        <Card className="p-5 pb-2 sm:p-6 sm:pb-2">
          <div className="flex items-center gap-3">
            <IconBadge>
              <ListChecks className="h-4 w-4" />
            </IconBadge>
            <h2 className="text-section-title">Preguntas frecuentes</h2>
          </div>
          <Accordion type="single" collapsible className="mt-2 w-full">
            <AccordionItem value="atajos">
              <AccordionTrigger>¿Qué atajos de teclado hay?</AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-1.5">
                  <li>
                    <kbd className="rounded-md border border-border/60 bg-muted px-1.5 py-0.5 font-sans text-xs font-medium">
                      Ctrl/Cmd + K
                    </kbd>{" "}
                    abre el buscador rápido (navegar a una sección o buscar un pedido).
                  </li>
                  <li>
                    <kbd className="rounded-md border border-border/60 bg-muted px-1.5 py-0.5 font-sans text-xs font-medium">N</kbd>{" "}
                    en la pantalla de Pedidos abre &quot;+ Nueva Orden&quot; (sin tener nada
                    escribiendo en un campo).
                  </li>
                  <li>
                    <kbd className="rounded-md border border-border/60 bg-muted px-1.5 py-0.5 font-sans text-xs font-medium">Esc</kbd>{" "}
                    cierra cualquier ventana o diálogo abierto.
                  </li>
                  <li>
                    <kbd className="rounded-md border border-border/60 bg-muted px-1.5 py-0.5 font-sans text-xs font-medium">G</kbd>{" "}
                    y luego una letra te lleva a una sección (por ejemplo G y P abre Pedidos).{" "}
                    <kbd className="rounded-md border border-border/60 bg-muted px-1.5 py-0.5 font-sans text-xs font-medium">?</kbd>{" "}
                    muestra la lista completa.
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
              <AccordionTrigger>¿Hace falta más ayuda?</AccordionTrigger>
              <AccordionContent>
                Si algo no funciona como se espera o hace falta un permiso que
                no está habilitado, contacta a un administrador de EMD HUB.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>
      </div>
    </div>
  );
};

export default AyudaPage;

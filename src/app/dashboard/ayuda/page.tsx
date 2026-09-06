"use client";

import { useRef } from "react";
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import Title from "@/components/Title";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { getStatusBadgeClasses } from "@/lib/statusColors";
import { statusOptions } from "@/lib/orderStatus";
import { usePermissions } from "@/hooks/usePermissions";
import { useMotionPreset } from "@/lib/motion";
import {
  BarChart3,
  ClipboardList,
  HelpCircle,
  LayoutDashboard,
  PackagePlus,
  Sparkles,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

const OPERATIONAL_ROLES = [
  "recepcion",
  "taller",
  "dtf",
  "bordado",
  "diseno",
  "laser",
  "impresiones",
];

/**
 * Sección "story": entra con fade + subida sutil, se mantiene visible en el
 * centro del viewport, y se atenúa (nunca desaparece del todo) al salir por
 * arriba. La animación está LIGADA al progreso de scroll de la sección
 * (useScroll con target propio), no disparada una sola vez.
 *
 * Con reduced-motion, cae a un fade estático simple sin scroll-linking.
 */
function StorySection({
  children,
  className = "",
  parallax = false,
}: {
  children: ReactNode;
  className?: string;
  /** Si true, aplica un leve efecto de profundidad extra (scale) al contenedor. */
  parallax?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const { reduced } = useMotionPreset();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const opacity = useTransform(scrollYProgress, [0, 0.25, 0.6, 1], [0, 1, 1, 0.4]);
  const y = useTransform(scrollYProgress, [0, 0.25], [28, 0]);
  const scale = useTransform(
    scrollYProgress,
    [0, 0.3, 0.7, 1],
    parallax ? [0.95, 1, 1, 0.97] : [1, 1, 1, 1],
  );

  if (reduced) {
    return (
      <motion.section
        ref={ref}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.15, ease: "linear" }}
        className={className}
      >
        {children}
      </motion.section>
    );
  }

  return (
    <motion.section ref={ref} style={{ opacity, y, scale }} className={className}>
      {children}
    </motion.section>
  );
}

/** Barra fina de progreso de lectura, fija arriba del contenido de Ayuda. */
function ReadingProgressBar({ progress }: { progress: MotionValue<number> }) {
  return (
    <div className="sticky top-0 z-10 -mx-4 h-1 bg-border/50 sm:-mx-6">
      <motion.div
        style={{ scaleX: progress }}
        className="h-full w-full origin-left bg-primary"
      />
    </div>
  );
}

/** Preview ilustrativo (no funcional) de los botones de estado reales. */
function StatusButtonsPreview() {
  return (
    <div className="flex flex-wrap gap-2 rounded-xl border bg-card p-4 shadow-sm">
      {statusOptions.map((opt) => (
        <span
          key={opt.value}
          className={`rounded-full border px-3 py-1.5 text-sm font-medium capitalize ${getStatusBadgeClasses(
            opt.value,
          )}`}
        >
          {opt.label}
        </span>
      ))}
    </div>
  );
}

const AyudaPage = () => {
  const { roles, isAdmin } = usePermissions();
  const containerRef = useRef<HTMLDivElement>(null);
  const hasOperationalRole = roles.some((r) => OPERATIONAL_ROLES.includes(r));
  const isRecepcion = roles.includes("recepcion");
  const { reduced } = useMotionPreset();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: 300,
    damping: 40,
    restDelta: 0.001,
  });

  return (
    <div ref={containerRef} className="space-y-2">
      <Title title="Ayuda" />
      <ReadingProgressBar progress={progress} />

      {/* Intro: qué es esto y por qué existe */}
      <StorySection className="flex min-h-[40vh] flex-col items-start justify-center gap-4 py-10">
        <div className="flex items-center gap-3 rounded-xl border bg-gradient-to-br from-primary/10 to-accent2-500/10 p-4">
          <HelpCircle className="h-8 w-8 shrink-0 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">¿Cómo uso esta plataforma?</h2>
            <p className="text-sm text-muted-foreground">
              Guía rápida, pensada para tu rol. Si algo no coincide con lo que
              ves, preguntale a un administrador.
            </p>
          </div>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Esta plataforma acompaña a un pedido de EMD Bordados desde que entra
          hasta que se entrega, pasando por las áreas que lo procesan
          (diseño, láser, DTF, bordado, impresiones y taller). Cada rol ve
          sólo lo que necesita para hacer su parte del trabajo.
        </p>
      </StorySection>

      {isAdmin && (
        <StorySection className="min-h-[60vh] space-y-6 py-14">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-semibold tracking-tight">
              Administración
            </h2>
          </div>
          <Accordion type="single" collapsible className="w-full max-w-3xl">
            <AccordionItem value="panel-general">
              <AccordionTrigger>¿Qué es el Panel General?</AccordionTrigger>
              <AccordionContent>
                Es la vista global de todos los pedidos de la empresa. Ahí
                podés ver en qué etapa está cada pedido (pendiente, en
                pruebas, en proceso, terminado o entregado), filtrar por
                estado y ordenar la lista. Sirve para tener una foto completa
                de la operación sin entrar pedido por pedido.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="estancamiento">
              <AccordionTrigger>
                ¿Cómo detecto pedidos estancados?
              </AccordionTrigger>
              <AccordionContent>
                El Panel General calcula cuánto tiempo lleva cada pedido en su
                estado actual y lo compara contra el tiempo promedio
                histórico de ese estado. Si un pedido tarda más de lo normal,
                aparece resaltado en la tabla de &quot;pedidos estancados&quot;
                con una sugerencia de qué revisar (por ejemplo, contactar al
                área responsable de esa etapa).
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="rendimiento">
              <AccordionTrigger>
                ¿Cómo interpreto el rendimiento por área?
              </AccordionTrigger>
              <AccordionContent>
                Cada área (bordado, DTF, diseño, láser, impresiones, taller)
                trabaja una etapa del pedido. Las métricas te muestran cuántos
                pedidos tiene cada área en este momento y cuánto tiempo
                promedio le toma completar su parte. Un tiempo mucho mayor al
                habitual suele indicar sobrecarga o un problema puntual en esa
                área.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="usuarios">
              <AccordionTrigger>
                ¿Cómo gestiono usuarios, roles, empresas y clientes?
              </AccordionTrigger>
              <AccordionContent>
                Desde el menú lateral, en las secciones &quot;Usuarios y
                Roles&quot;, &quot;Clientes&quot; y &quot;Empresas&quot; podés
                crear, editar o eliminar registros. Al crear o editar un
                usuario, la contraseña debe tener al menos 8 caracteres, una
                mayúscula y un número — el formulario te avisa si falta algo.
                Los roles determinan qué secciones y qué etapas de pedido
                puede ver y modificar cada persona.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="metricas">
              <AccordionTrigger>
                ¿Cómo leo los gráficos del dashboard?
              </AccordionTrigger>
              <AccordionContent>
                Los gráficos resumen la cantidad de pedidos por estado y su
                evolución. Cada color representa siempre el mismo estado en
                toda la app (por ejemplo, verde para &quot;entregado&quot;),
                así que podés comparar de un vistazo entre el dashboard, el
                tablero de estatus y el detalle de cada pedido.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </StorySection>
      )}

      {hasOperationalRole && (
        <StorySection className="min-h-[60vh] space-y-6 py-14">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-semibold tracking-tight">
              Estatus de Pedidos
            </h2>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Vas a ver únicamente los pedidos que están en la etapa que le
            corresponde a tu rol. Por ejemplo, si trabajás en bordado, sólo
            aparecen los pedidos que están &quot;en proceso&quot; de bordado
            esperando que termines tu parte. Los pedidos de otras etapas no se
            muestran ahí para no generar confusión.
          </p>
          <div className="max-w-2xl space-y-2">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Cuando termines tu parte, entrá al pedido (o hacé clic en
              &quot;Ver&quot;) y usá el selector de estado para pasarlo a la
              siguiente etapa. Apenas lo cambiás, el pedido pasa a la lista de
              tareas del área siguiente y queda registrado en el historial con
              fecha y hora.
            </p>
            <StatusButtonsPreview />
          </div>
          {isRecepcion && (
            <div className="max-w-2xl">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="crear-pedido">
                  <AccordionTrigger>¿Cómo creo un pedido nuevo?</AccordionTrigger>
                  <AccordionContent>
                    Andá a &quot;Nuevo Pedido&quot; en el menú lateral, elegí
                    el cliente (o cargalo si es nuevo), completá la
                    descripción del trabajo y la fecha de entrega estimada, y
                    guardá. El pedido arranca en estado &quot;pendiente&quot;
                    y aparece automáticamente en las tareas del área que
                    corresponde a la primera etapa del proceso.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}
        </StorySection>
      )}

      {!isAdmin && !hasOperationalRole && (
        <StorySection className="flex min-h-[40vh] flex-col justify-center gap-3 py-14">
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-semibold tracking-tight">
              Sin secciones asignadas
            </h2>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Tu usuario todavía no tiene un rol operativo asignado. Pedile a un
            administrador que te asigne un rol para poder ver tus tareas.
          </p>
        </StorySection>
      )}

      {/* Colores de estado: sección con parallax leve en el ícono, ya que es
          uno de los 1-2 elementos "profundos" de la página. */}
      <StorySection className="flex min-h-[45vh] flex-col justify-center gap-4 py-14" parallax>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-semibold tracking-tight">
            Colores de estado
          </h2>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          En toda la app vas a ver los mismos colores para cada estado de
          pedido: gris para pendiente, celeste para en pruebas, ámbar para en
          proceso, violeta para terminado y verde para entregado. Así podés
          identificar el estado de un pedido de un vistazo, sin importar en
          qué pantalla estés.
        </p>
        <div className="max-w-2xl">
          <StatusButtonsPreview />
        </div>
      </StorySection>

      {/* FAQ / cierre */}
      <StorySection className="min-h-[40vh] space-y-4 py-14">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-semibold tracking-tight">
            Preguntas frecuentes
          </h2>
        </div>
        <Accordion type="single" collapsible className="w-full max-w-3xl">
          <AccordionItem value="mas-ayuda">
            <AccordionTrigger>¿Necesitás más ayuda?</AccordionTrigger>
            <AccordionContent>
              Si algo no funciona como esperás o necesitás un permiso que no
              tenés, contactá a un administrador de EMD Bordados.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <div className="flex items-center gap-3 rounded-xl border bg-gradient-to-br from-primary/10 to-accent2-500/10 p-4">
          <PackagePlus className="h-6 w-6 shrink-0 text-primary" />
          <p className="text-sm text-muted-foreground">
            {reduced
              ? "Modo de movimiento reducido activo: mostramos las secciones con un fade simple."
              : "Seguí explorando el resto del dashboard desde el menú lateral."}
          </p>
        </div>
      </StorySection>
    </div>
  );
};

export default AyudaPage;

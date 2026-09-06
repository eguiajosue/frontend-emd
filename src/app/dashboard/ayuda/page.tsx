"use client";

import { motion } from "framer-motion";
import Title from "@/components/Title";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePermissions } from "@/hooks/usePermissions";
import { staggerContainerVariants, staggerItemVariants, entranceTransition } from "@/lib/motion";
import {
  BarChart3,
  ClipboardList,
  HelpCircle,
  LayoutDashboard,
  PackagePlus,
  Users,
} from "lucide-react";

const OPERATIONAL_ROLES = [
  "recepcion",
  "taller",
  "dtf",
  "bordado",
  "diseno",
  "laser",
  "impresiones",
];

const AyudaPage = () => {
  const { roles, isAdmin } = usePermissions();
  const hasOperationalRole = roles.some((r) => OPERATIONAL_ROLES.includes(r));
  const isRecepcion = roles.includes("recepcion");

  return (
    <div className="space-y-6">
      <Title title="Ayuda" />
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={entranceTransition}
        className="flex items-center gap-3 rounded-xl border bg-gradient-to-br from-primary/10 to-accent2-500/10 p-4"
      >
        <HelpCircle className="h-8 w-8 text-primary shrink-0" />
        <div>
          <h1 className="text-lg font-semibold">¿Cómo uso esta plataforma?</h1>
          <p className="text-sm text-muted-foreground">
            Guía rápida, pensada para tu rol. Si algo no coincide con lo que ves,
            preguntale a un administrador.
          </p>
        </div>
      </motion.div>

      <motion.div
        variants={staggerContainerVariants}
        initial="hidden"
        animate="show"
        className="space-y-6"
      >
        {isAdmin && (
          <motion.div variants={staggerItemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <LayoutDashboard className="h-5 w-5 text-primary" />
                  Administración
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="panel-general">
                    <AccordionTrigger>¿Qué es el Panel General?</AccordionTrigger>
                    <AccordionContent>
                      Es la vista global de todos los pedidos de la empresa. Ahí
                      podés ver en qué etapa está cada pedido (pendiente, en
                      pruebas, en proceso, terminado o entregado), filtrar por
                      estado y ordenar la lista. Sirve para tener una foto
                      completa de la operación sin entrar pedido por pedido.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="estancamiento">
                    <AccordionTrigger>
                      ¿Cómo detecto pedidos estancados?
                    </AccordionTrigger>
                    <AccordionContent>
                      El Panel General calcula cuánto tiempo lleva cada pedido en
                      su estado actual y lo compara contra el tiempo promedio
                      histórico de ese estado. Si un pedido tarda más de lo
                      normal, aparece resaltado en la tabla de &quot;pedidos
                      estancados&quot; con una sugerencia de qué revisar (por
                      ejemplo, contactar al área responsable de esa etapa).
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="rendimiento">
                    <AccordionTrigger>
                      ¿Cómo interpreto el rendimiento por área?
                    </AccordionTrigger>
                    <AccordionContent>
                      Cada área (bordado, DTF, diseño, láser, impresiones,
                      taller) trabaja una etapa del pedido. Las métricas te
                      muestran cuántos pedidos tiene cada área en este momento y
                      cuánto tiempo promedio le toma completar su parte. Un
                      tiempo mucho mayor al habitual suele indicar sobrecarga o
                      un problema puntual en esa área.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="usuarios">
                    <AccordionTrigger>
                      ¿Cómo gestiono usuarios, roles, empresas y clientes?
                    </AccordionTrigger>
                    <AccordionContent>
                      Desde el menú lateral, en las secciones &quot;Usuarios y
                      Roles&quot;, &quot;Clientes&quot; y &quot;Empresas&quot;
                      podés crear, editar o eliminar registros. Al crear o
                      editar un usuario, la contraseña debe tener al menos 8
                      caracteres, una mayúscula y un número — el formulario te
                      avisa si falta algo. Los roles determinan qué secciones y
                      qué etapas de pedido puede ver y modificar cada persona.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="metricas">
                    <AccordionTrigger>
                      ¿Cómo leo los gráficos del dashboard?
                    </AccordionTrigger>
                    <AccordionContent>
                      Los gráficos resumen la cantidad de pedidos por estado y
                      su evolución. Cada color representa siempre el mismo
                      estado en toda la app (por ejemplo, verde para
                      &quot;entregado&quot;), así que podés comparar de un
                      vistazo entre el dashboard, el tablero de estatus y el
                      detalle de cada pedido.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {hasOperationalRole && (
          <motion.div variants={staggerItemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  Estatus de Pedidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="que-veo">
                    <AccordionTrigger>
                      ¿Qué pedidos veo en &quot;Estatus de Pedidos&quot;?
                    </AccordionTrigger>
                    <AccordionContent>
                      Vas a ver únicamente los pedidos que están en la etapa que
                      le corresponde a tu rol. Por ejemplo, si trabajás en
                      bordado, sólo aparecen los pedidos que están &quot;en
                      proceso&quot; de bordado esperando que termines tu parte.
                      Los pedidos de otras etapas no se muestran ahí para no
                      generar confusión.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="cambiar-estado">
                    <AccordionTrigger>
                      ¿Cómo cambio el estado de un pedido cuando termino mi parte?
                    </AccordionTrigger>
                    <AccordionContent>
                      Entrá al pedido desde &quot;Estatus de Pedidos&quot; (o hacé clic
                      en &quot;Ver&quot;) y usá el selector de estado para
                      pasarlo a la siguiente etapa. Apenas lo cambiás, el
                      pedido pasa a la lista de tareas del área siguiente y
                      queda registrado en el historial con fecha y hora.
                    </AccordionContent>
                  </AccordionItem>
                  {isRecepcion && (
                    <AccordionItem value="crear-pedido">
                      <AccordionTrigger>
                        ¿Cómo creo un pedido nuevo?
                      </AccordionTrigger>
                      <AccordionContent>
                        Andá a &quot;Nuevo Pedido&quot; en el menú lateral,
                        elegí el cliente (o cargalo si es nuevo), completá la
                        descripción del trabajo y la fecha de entrega estimada,
                        y guardá. El pedido arranca en estado
                        &quot;pendiente&quot; y aparece automáticamente en las
                        tareas del área que corresponde a la primera etapa del
                        proceso.
                      </AccordionContent>
                    </AccordionItem>
                  )}
                </Accordion>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {!isAdmin && !hasOperationalRole && (
          <motion.div variants={staggerItemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-5 w-5 text-primary" />
                  Sin secciones asignadas
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Tu usuario todavía no tiene un rol operativo asignado. Pedile a
                un administrador que te asigne un rol para poder ver tus
                tareas.
              </CardContent>
            </Card>
          </motion.div>
        )}

        <motion.div variants={staggerItemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-5 w-5 text-primary" />
                Colores de estado
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              En toda la app vas a ver los mismos colores para cada estado de
              pedido: gris para pendiente, celeste para en pruebas, ámbar para
              en proceso, violeta para terminado y verde para entregado. Así
              podés identificar el estado de un pedido de un vistazo, sin
              importar en qué pantalla estés.
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={staggerItemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PackagePlus className="h-5 w-5 text-primary" />
                ¿Necesitás más ayuda?
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Si algo no funciona como esperás o necesitás un permiso que no
              tenés, contactá a un administrador de EMD Bordados.
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default AyudaPage;

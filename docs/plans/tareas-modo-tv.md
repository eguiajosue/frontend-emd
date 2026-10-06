# Modo TV de "Tareas asignadas" + llegada de paquetes

## Objetivo

Una tele en el área (taller, bordado, DTF…) que muestre **todo el trabajo del
área** y deje trabajarlo con el dedo, más una animación de "paquete que llega"
cuando entra trabajo nuevo, sólo dentro del Modo TV.

## Datos

- `GET /orders/my-area-tasks` (ya existe en el backend, `findForUser`): todas
  las tareas de las áreas de producción del usuario, en los tres estados, de
  pedidos no cerrados. Trae `completedAt` y `assignedUser.isSharedAccount`.
  Le faltan `creationDate`/`status` del pedido y no excluye las tareas de
  pedidos que siguen en Diseño → se completa con `GET /orders/my-tasks` cuando
  la tarea está en las dos listas.
- Diseño no tiene "tareas de área": sus pedidos salen de `my-tasks` (lo suyo y
  lo libre).
- Sin `my-area-tasks` (403/404, o usuario sólo de Diseño) el tablero cae a
  `my-tasks` y la columna "Terminado" queda vacía con un aviso.

## Pantalla (`TasksTvMode`)

- Dialog `fullscreen` (como `OrdersJobWall`), siempre oscuro, sin menús.
- Cabecera: título, "En vivo", reloj grande, sonido on/off, salir.
- Franja de conteos por plazo (`TONE_META`) + filtro de área.
- Tres columnas: **Pendiente / En proceso / Terminado (últimas 12 h)**.
- Tarjeta grande y táctil (botón de ≥56 px): Tomar y empezar / Empezar /
  Terminar con `useAdvanceMyTask`; Diseño abre el pedido.
- Reordenamiento entre columnas con `layoutId` de framer-motion.
- Refresco cada 30 s, Wake Lock con re-pedido al volver a la pestaña.
- Entradas: botón "Modo TV" en la página, `?tv=1`, acción en la paleta ⌘K.

## Llegada de paquetes (`lib/packageArrivals.ts` + `PackageArrival`)

- Fuentes: `newOrderNotification` (room del área) y
  `newAssignedOrderNotification` (a mí), escuchados sobre el socket único del
  layout vía `ChatSocketContext` (sin tocar `useSocket.tsx`, que cambia en
  paralelo por los toasts).
- Prioridad por plazo (`getDeadlineState`): vencido → rojo, caída rápida +
  sacudida + brillo pulsante; en riesgo → ámbar, rebote moderado; a tiempo /
  sin fecha → azul, flotación suave; cambios solicitados → violeta.
- Cola: uno a la vez (~4 s); con más de 3 en cola, una caja grande "N pedidos
  nuevos" que se abre en abanico de hojas.
- Secuencia: cae la caja → aterriza → se abren las solapas → sube la hoja
  (#pedido, cliente, área, entrega) → se desvanece la caja → la hoja vuela a
  su tarjeta (FLIP sólo con transform) y la tarjeta brilla un momento.
- `prefers-reduced-motion`: la hoja aparece y se va con un fundido.
- Sonido sólo en TV: campanita Web Audio sintetizada, más insistente si está
  vencido; mute en localStorage (try/catch); se desbloquea con el primer
  toque y muestra "Activar sonido" mientras tanto. El "ding" global se calla
  mientras la TV está abierta para no sonar doble.
- Demo/test: `?tv=1&demo=1` muestra botones para simular llegadas, sólo fuera
  de producción o con `NEXT_PUBLIC_TV_DEMO=1` (lo pone la config de e2e).

## Detalle del pedido desde la tele

- Tocar una tarjeta (cualquier parte menos el botón de acción) abre
  `OrderDetailDialog` **encima** de la tele, sin cerrarla. El número `#id`
  es un `<button>` cuyo `::after` cubre toda la tarjeta (se llega con Tab y
  se abre con Enter/Espacio); el botón de acción queda por encima (`z-10`).
- El diálogo se renderiza dentro del contenido de la tele (rama anidada de
  Radix): Esc cierra sólo el detalle y el foco vuelve a la tarjeta.
- El `DialogContent fullscreen` pasó de `z-[60]` a `z-50`: lo que se abre
  encima (detalle, selects, tooltips, todos `z-50`) se monta después en el
  `<body>` y gana por orden de documento.
- Mientras el detalle está abierto, la cola de llegadas espera.
- Los pedidos de la demo (`#9001…`) no existen en el backend: no abren nada.

## Llegada 3D (three.js)

- `PackageArrival3DStage` + `arrival3d/ArrivalScene.ts`: three.js "a pelo"
  (R3F no anda con el React de Next 15), cargado aparte con `import()` en
  cuanto se abre la tele (`arrival3d/runtime.ts`, sin three).
- Un solo `WebGLRenderer` compartido: se crea con la primera llegada, se
  reusa en la cola y se libera al salir de la tele. Lienzo transparente a
  pantalla completa sobre un velo DOM; DPR ≤ 1,75; el loop se pausa con la
  pestaña oculta y la pose se calcula por tiempo transcurrido (al volver
  salta al momento correcto). Con WebGL por software (SwiftShader/llvmpipe)
  baja la calidad (sin MSAA, la mitad de partículas).
- Caja procedural (ver `public/models/README.md`), luz de `RoomEnvironment`
  + llave cálida + contraluz del color de la prioridad, sombra de contacto
  con dos manchas suaves, destello + partículas + ondas en el piso.
- Coreografía pura en `lib/arrival3d.ts` (con tests): mismos tiempos que la
  2D (`arrivalTimeline`). Vencido: cae fuerte, aplastón, sacudida, temblor
  de cámara, cinta y contraluz que laten, dos ondas, más chispas. Urgente:
  rebota. A tiempo / sin fecha: baja flotando y queda flotando. Cambios:
  vuelve deslizándose desde el costado con sello "CAMBIOS". Lote: caja
  grande y abanico de hojas.
- La hoja 3D es una copia exacta de la hoja DOM (se pinta en canvas desde el
  DOM ya renderizado, con la fuente de la app). Al volar se proyectan sus
  esquinas a pantalla (`quadToScreenSheet`), la hoja DOM aparece justo ahí
  (misma escala y giro) y hace el FLIP a su tarjeta mientras la caja se
  hunde y el lienzo se apaga.
- Respaldo: `PackageArrivalStage` (SVG + framer) con `prefers-reduced-motion`,
  sin WebGL, o si la escena no arranca en 2,5 s o falla.
- CSP: sin `eval`, sin `<style>`/`<script>` inline; las texturas son
  `CanvasTexture` (sin blob:) y los íconos de la hoja van como `data:` SVG
  (`img-src` ya permite `data:`).

## Pruebas

- Vitest: prioridad, cola/lotes, mapeo de payloads, armado del tablero,
  preferencia de sonido, acción de la paleta.
- Playwright: abrir TV, columnas del área, avanzar una tarea, llegada simulada
  que inserta la tarjeta en "Pendiente".

## Backend (no se toca aquí)

Ver el reporte: sumar `creationDate`, `status` y `area` del pedido a
`findForUser`, excluir tareas de pedidos aún en Diseño, abrir el endpoint a
Diseño, y acotar "terminadas" a las recientes.

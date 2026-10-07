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
- Cola: uno a la vez (~4 s); con más de 3 en cola, "N pedidos nuevos": una
  tanda de tickets cortos que terminan en abanico.
- Secuencia: entra la impresora → imprime el ticket línea por línea
  (#pedido, cliente, área, entrega, prioridad, código, hora) → la guillotina
  corta → el ticket vuela a su tarjeta (FLIP sólo con transform) y la tarjeta
  brilla un momento; la impresora se hunde y desaparece.
- `prefers-reduced-motion`: el ticket aparece y se va con un fundido.
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
- `OrderDetailDialog` (también en la vista normal): anota quién tenía el foco
  al abrirse y se lo devuelve en `onCloseAutoFocus` (sin `<DialogTrigger>`,
  Radix lo dejaba en `<body>`), y al abrir pone el foco en el diálogo y no en
  "Más acciones" (su tooltip se abría y el primer Esc sólo lo cerraba).
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
- Impresora térmica procedural (ver `public/models/README.md`), luz de
  `RoomEnvironment` + llave cálida + contraluz del color de la prioridad,
  sombra de contacto con dos manchas suaves. El ticket sale por la ranura a
  pasos de motor (recortado con un plano de clipping en la boca: lo que sale
  ya está impreso), curvado hacia atrás como el rollo; la guillotina cruza,
  destello y papelitos, y el ticket se aplana y sube hasta mirar a la cámara.
- Coreografía pura en `lib/arrival3d.ts` (con tests): `printTimeline` usa los
  tiempos grandes de `arrivalTimeline` y reparte avance → corte → subida de
  cada ticket. Vencido: cae fuerte con sacudida y temblor de cámara, LED rojo
  que parpadea, avance rápido, encabezado "VENCIDO" en tinta roja. Urgente:
  LED ámbar fijo, rebote corto. A tiempo / sin fecha: baja flotando, LED azul
  que respira, avance tranquilo. Cambios: entra deslizándose, encabezado
  "CAMBIOS" en violeta. Lote (> 3): varios tickets cortos seguidos, cada uno
  cortado y en abanico mientras sale el siguiente.
- Sonido (sólo en la tele, respeta el silencio): motor de avance a pasos
  sincronizado con el papel y "clic" de la guillotina (`lib/tvSound.ts`).
- El ticket 3D es una copia exacta del ticket DOM (`TicketContent`, estilo
  recibo monoespaciado), pintado en canvas desde el DOM ya renderizado. Al
  volar se proyectan sus esquinas a pantalla (`quadToScreenSheet`), el ticket
  DOM aparece justo ahí (misma escala y giro) y hace el FLIP a su tarjeta
  mientras la impresora se hunde y el lienzo se apaga.
- Precalentamiento: al abrir la tele (con WebGL y sin reduced-motion) se
  carga three, se crea el renderer, se hornea el entorno y se compilan los
  shaders de una escena de prueba (en SwiftShader son ~3 s; en una GPU floja,
  más de lo que se quiere esperar con la impresora ya anunciada). La tele expone
  `data-arrival-3d="warming" | "ready" | "off"` y la primera llegada espera
  hasta 6 s a que esté lista.
- Respaldo: `PackageArrivalStage` (impresora plana en SVG + framer, mismo horario, ticket con `clip-path`) con `prefers-reduced-motion`,
  sin WebGL o si la escena falla (2D para siempre). Si sólo tarda más de
  2,5 s en arrancar, esa llegada va en 2D y la siguiente vuelve a probar 3D.
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

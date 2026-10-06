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

## Pruebas

- Vitest: prioridad, cola/lotes, mapeo de payloads, armado del tablero,
  preferencia de sonido, acción de la paleta.
- Playwright: abrir TV, columnas del área, avanzar una tarea, llegada simulada
  que inserta la tarjeta en "Pendiente".

## Backend (no se toca aquí)

Ver el reporte: sumar `creationDate`, `status` y `area` del pedido a
`findForUser`, excluir tareas de pedidos aún en Diseño, abrir el endpoint a
Diseño, y acotar "terminadas" a las recientes.

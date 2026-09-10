# Rediseño frontend: responsive total con experiencia nativa iOS en móvil

Fecha: 2026-09-10
Estado: propuesta de diseño (pendiente de aprobación)
Alcance principal: `apps/web` en `frontend-emd` (EMD Bordados)
Alcance secundario: `src/chat` y `src/notifications` en `backend-emd`, acotado a
lo descrito en la sección 6.6

## 1. Objetivo

Que la aplicación funcione correctamente en cualquier tamaño de pantalla y que,
en un teléfono, se sienta como una aplicación nativa de iOS y no como un sitio
web adaptado.

El objetivo no es replicar iOS por estética. Es que un operario de planta pueda
usar la aplicación de pie, con una mano, sin equivocarse de botón y sin pelearse
con el teclado.

## 2. Decisiones de producto

Estas decisiones ya fueron tomadas por el dueño del producto y no se
re-discuten durante la implementación:

| Decisión | Elección |
|---|---|
| Navegación móvil | Tab Bar inferior fijo. El sidebar se conserva solo en escritorio. |
| Lenguaje visual | Estructura de iOS (escala tipográfica, espaciado, radios, sombras, jerarquía) conservando el magenta de marca `#d91e7a` como color de acento y acción. |
| Usuario móvil primario | Operarios en planta (bordado, recepción). Targets grandes, uso a una mano. |
| Modo de trabajo | Análisis y plan primero; implementación después de aprobación. |
| Chat | Estructura de WhatsApp, con checks de entrega, indicador de escritura y presencia. Detalle y decisiones propias en la sección 6. |

## 3. Estado actual

Auditoría realizada sobre las 17 páginas reales, los ~30 componentes de
`components/ui/`, la capa de tablas y formularios, y la configuración de
navegación y PWA.

### 3.1 Lo que ya está resuelto (no rehacer)

Es importante registrarlo para que la implementación no reconstruya lo que ya
funciona:

- `components/data-table.tsx` ya tiene doble render: tabla en `hidden md:block`
  y lista de tarjetas en `md:hidden`. No hay scroll horizontal.
- `components/ui/dialog.tsx:88-95` ya se presenta como sheet full-screen desde
  abajo en móvil, con safe-area y header/footer anclados.
- `components/ui/tabs.tsx:17` ya usa `h-11` con scroll horizontal.
- `components/ui/input.tsx:11` y `textarea.tsx:12` usan `text-base md:text-sm`,
  por lo que no disparan el zoom de Safari.
- `globals.css:220-226` ya define `overscroll-behavior-y: none`,
  `-webkit-tap-highlight-color: transparent` y `text-size-adjust`.
- `app/layout.tsx:53` ya declara `viewportFit: "cover"`.
- `lib/motion.ts` ya usa springs de Framer Motion y respeta
  `prefers-reduced-motion` vía `useMotionPreset()`.
- Dark mode está correctamente implementado con tokens para ambos temas.
- `components/orders/KanbanBoard.tsx:120-146` ya tiene fallback móvil.

### 3.2 Bugs funcionales encontrados

Estos no son problemas de diseño responsive: son defectos que hoy rompen el
trabajo del operario. Se corrigen primero porque son baratos, independientes
entre sí y de alto impacto.

**B1 — La captura de fotos falla.**
`components/ui/camera-capture-button.tsx:31` declara `accept="image/*"`, por lo
que iOS entrega archivos HEIC. Los validadores solo aceptan PNG, JPEG y PDF
(`lib/fileInput.ts:10-14`, `CreateOrderDialog.tsx:216-221`), así que el operario
toma la foto y recibe un error de formato. Además no hay compresión: una foto de
12 MP pesa entre 4 y 8 MB contra un límite de 5 MB, y se transmite en base64,
que añade un 33%. En la red de una planta esto falla o tarda demasiado.

**B2 — El chat tapa su propio campo de texto.**
`app/dashboard/chat/page.tsx:146` usa `h-[calc(100vh-16rem)]`. En iOS `100vh` no
se reduce cuando aparece el teclado, de modo que el campo de escritura queda
debajo del teclado.

**B3 — El botón de crear pedido se pierde con el scroll.**
`CreateOrderDialog.tsx:766-777` coloca sus botones en un `div` suelto dentro del
cuerpo scrolleable en vez de usar `DialogFooter`, que sí queda anclado. Ocurre en
el formulario más largo de la aplicación.

**B4 — El onboarding se cancela solo y marca el flag.**
`OnboardingTour.tsx:96-106` busca `[data-tour="sidebar-nav"]`, que en móvil vive
dentro de un Sheet cerrado. `getRect` devuelve `null`, el paso se salta y
`hasSeenOnboarding` queda marcado sin haber mostrado nada.

**B5 — `superuser` no ve la sección Clientes.**
`app-sidebar.tsx:222` declara `roles: ["admin","recepcion"]`. El rol `superuser`
ve todas las demás secciones, lo que indica un descuido y no una decisión.

**B6 — Virtualización activa en móvil sobre una lista no virtualizada.**
`app/dashboard/orders/page.tsx:862` activa `virtualize` con más de 30 filas, pero
la rama móvil de `data-table.tsx:242-245` no virtualiza deliberadamente. En
lugar de una lista de tarjetas propia, en ese caso móvil se renderizaba **la
misma tabla virtualizada de escritorio**: no táctil, con scroll horizontal
forzado, pensada para un mouse y una pantalla ancha. Es decir, antes del
arreglo nunca se montaban cientos de tarjetas en el teléfono — ese código de
tarjetas (`!virtualize`, líneas ~99-166) sólo corre cuando `virtualize` es
`false`, y por construcción esa rama nunca recibe más de 30 filas.

El arreglo (Task 5 del plan de Fase 0) reemplaza esa tabla de escritorio en
móvil por una lista de 30 tarjetas paginadas con un botón "Cargar más". Es,
ante todo, una mejora de UX táctil (tarjetas en vez de una tabla que scrollea
horizontalmente en un teléfono), no una corrección de performance por evitar
montar cientos de nodos DOM — eso nunca ocurría en la rama móvil original. El
trabajo de virtualización real de Fase 5 (scroll infinito) debe partir de esta
base corregida: hoy no hay una regresión de cientos de tarjetas que resolver,
sino una lista paginada por lotes de 30 a mejorar con scroll infinito.

### 3.3 Problemas transversales

**T1 — Ningún componente alcanza el mínimo táctil de 44×44 px.**

| Componente | Tamaño actual |
|---|---|
| `ui/button.tsx:24-27` | `default` 36px, `sm` 32px, `lg` 40px, `icon` 36×36 |
| `ui/input.tsx:11` | 36px |
| `ui/select.tsx:22` | 36px |
| `ui/checkbox.tsx:16` | 16×16 |
| `ui/radio-group.tsx:31` | 16×16 |
| `ui/switch.tsx:14` | 36×20 |
| `ui/calendar.tsx:30,47` | navegación 28px, día 32px |
| `orders/OrderStatusButtons.tsx:52` | ~28px |

El último es el más grave: cambiar el estado de un pedido es la acción principal
del operario y hoy es el target más pequeño de la aplicación.

Hay 35 usos de `size="sm"` y 17 de `size="icon"` en el código.

**T2 — La escala tipográfica está dos escalones por debajo de iOS.**
No existe configuración `fontSize` en `tailwind.config.js`; se usan los valores
por defecto de Tailwind. El uso real es de 156 `text-sm` (14 px) y 126 `text-xs`
(12 px), cuando el cuerpo de iOS es 17 px. Faltan por completo los tamaños
17, 15, 13, 22 y 34.

Además, `tailwind.config.js:14-17` define el fallback como
`['var(--font-body)','ui-sans-serif','system-ui','sans-serif']`, donde
`--font-body` es Poppins. SF Pro nunca llega a aplicarse.

**T3 — No hay pistas de teclado en ningún formulario.**
Cero ocurrencias de `inputMode` y cero de `autoComplete` en todo el repositorio.
El campo de teléfono (`CreateClientDialog.tsx:131-138`) no declara `type="tel"`,
por lo que abre el teclado alfabético. El login no declara `autoComplete`, de
modo que iOS no ofrece autofill del llavero ni Face ID.

**T4 — Las acciones principales están fuera del alcance del pulgar.**
En `orders/[id]/page.tsx:231` la tarjeta "Cambiar Estado" está debajo de
"Información General", a unos 800 px de scroll en un iPhone. "Guardar Cambios"
(`:199`) queda enterrado a mitad de tarjeta.

**T5 — Dos definiciones de "móvil" en conflicto.**
El CSS corta en `sm:` (640 px) en `dashboard/layout.tsx:42`, mientras
`hooks/use-mobile.tsx:3` y `data-table.tsx` cortan en 768 px.

**T6 — Faltan los componentes del shell iOS.**
No existen: Tab Bar, bottom sheet con detents y arrastre, action sheet, large
title colapsable, pull-to-refresh, swipe actions, segmented control ni lista
inset-grouped. Tampoco hay swipe-back: cero gestos de borde en todo `src`.

**T7 — La configuración PWA de Apple está incompleta.**
Faltan `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`,
el apple touch icon de 180×180 (hoy se escala uno de 512) y todas las splash
screens. No hay ningún manejo del teclado virtual (`visualViewport`).

**T8 — Recharts no responde bien al tacto.**
Los tooltips son de hover: en un teléfono se abren y no se cierran. Las etiquetas
en mayúscula se recortan a 375 px (`OrdersByStatusPieChart.tsx:19`,
`OrdersByStatusBarChart.tsx:22`).

**T9 — Funciones de escritorio sin equivalente táctil.**
`CommandPalette.tsx:46-56` solo se abre con Cmd/Ctrl+K, por lo que es
inalcanzable en un teléfono y hoy es peso muerto en el bundle móvil.
`ayuda/page.tsx:385-406` muestra atajos de teclado que no aplican en táctil.

**T10 — Incoherencia visual del login entre plataformas.**
`login/page.tsx:84,119` pinta la versión móvil sobre `bg-neutral-950` con
`border-2 border-neutral-700`, mientras el escritorio es claro. El borde de 2 px
es lenguaje Material, no iOS. Sus targets, en cambio, ya están correctos en
`h-11`.

**T11 — Los redirects parpadean en blanco.**
`mi-trabajo/page.tsx:22` y `estatus-pedidos/page.tsx:20` devuelven `null`
mientras redirigen. Con la red de una planta esto produce un destello en blanco
antes de la navegación.

## 4. Arquitectura del sistema de diseño

### 4.1 Escala tipográfica

Se añade a `tailwind.config.js` la escala de iOS como nombres semánticos, con su
interlineado y tracking:

| Nombre | Tamaño | Interlineado | Tracking | Uso |
|---|---|---|---|---|
| `large-title` | 34 px | 41 px | -0.4 | Título de pantalla en scroll superior |
| `title-1` | 28 px | 34 px | -0.4 | Título de pantalla colapsado |
| `title-2` | 22 px | 28 px | -0.3 | Encabezado de sección |
| `title-3` | 20 px | 25 px | -0.2 | Encabezado de tarjeta |
| `headline` | 17 px | 22 px | -0.4 | Cuerpo enfatizado (semibold) |
| `body` | 17 px | 22 px | -0.4 | Cuerpo por defecto |
| `callout` | 16 px | 21 px | -0.3 | Cuerpo secundario |
| `subhead` | 15 px | 20 px | -0.2 | Etiquetas de campo |
| `footnote` | 13 px | 18 px | -0.1 | Texto auxiliar |
| `caption-1` | 12 px | 16 px | 0 | Metadatos |
| `caption-2` | 11 px | 13 px | 0.1 | Marcas de tiempo |

La familia de fuentes pasa a anteponer las de sistema:
`-apple-system, BlinkMacSystemFont, "SF Pro Text", var(--font-body), ...`.
Space Grotesk se conserva únicamente para títulos de marca.

Regla de migración: el texto de contenido sube de `text-sm` a `text-body`
(17 px). `text-xs` solo se conserva donde es genuinamente metadato, migrando a
`text-caption-1`. No es una sustitución mecánica: cada caso se evalúa por rol
del texto, no por su clase actual.

### 4.2 Tokens nuevos

Se añaden a `globals.css` y `tailwind.config.js`:

- **Alturas de barra:** `--nav-bar-h: 44px`, `--tab-bar-h: 49px`,
  `--large-title-h: 96px`.
- **Safe areas como utilidades:** `pt-safe`, `pb-safe`, `pl-safe`, `pr-safe`,
  para dejar de repetir `env(safe-area-inset-*)` a mano en seis archivos.
- **Hairline:** `--hairline: 0.5px` para separadores, en lugar del `h-[1px]`
  actual de `separator.tsx:22`.
- **Materiales translúcidos:** `--material-thin`, `--material-regular`,
  `--material-thick`, definidos como `blur()` + `saturate(180%)` + tinte, para
  sustituir los nueve usos ad-hoc de `backdrop-blur`.
- **Colores semánticos faltantes:** `--success` y `--warning`, hoy ausentes
  (`form-field.tsx:101` tiene `text-emerald-600` hardcodeado).
- **Overlay:** token propio en lugar del `bg-black/80` fijo de `sheet.tsx:24`.

Se corrige además que `--elevation-1` y `--elevation-2` solo existen en `.dark`,
por lo que hoy son clases muertas en tema claro.

### 4.3 Targets táctiles

Se añade una variante `touch` a los primitivos, con altura de 44 px, y se
convierte en el tamaño por defecto bajo el breakpoint móvil:

- `button.tsx`: nueva variante `touch` (`h-11`, `px-5`).
- `input.tsx`, `select.tsx`: `h-11` en móvil.
- `checkbox.tsx`, `radio-group.tsx`: mantienen su tamaño visual de 16 px pero
  reciben un área táctil de 44 px mediante pseudo-elemento.
- `calendar.tsx`: días a 44 px, navegación a 44 px.

Se elimina el `whitespace-nowrap` global de `button.tsx:7`, que hoy hace que
cualquier etiqueta larga desborde en lugar de envolver.

### 4.4 Breakpoint móvil

Se unifica en **768 px (`md`)**, que es el valor que ya usan `use-mobile.tsx` y
`data-table.tsx`. El único punto que cambia es `dashboard/layout.tsx:42`, que hoy
corta en 640. Por debajo de 768 px se presenta el shell móvil; por encima, el
layout de escritorio con sidebar.

### 4.5 Movimiento

`lib/motion.ts` ya usa springs pero con `bounce: 0` y duraciones de 0.15 a
0.35 s, una decisión tomada explícitamente en su comentario de cabecera. Para el
shell móvil se revierte parcialmente:

- **Presentación** (sheets, push de navegación): `stiffness 300, damping 30`.
- **Gestos con momentum** (arrastre de sheet, swipe actions): `stiffness 400,
  damping 35`, alimentado con la velocidad real del gesto.
- **Micro-interacciones**: se conservan los presets actuales.

Se añade a `globals.css` un bloque `@media (prefers-reduced-motion: reduce)`,
hoy inexistente, porque las animaciones de Radix y `tailwindcss-animate`
(`dialog.tsx:88-91`, `sheet.tsx:34`) no pasan por `useMotionPreset()` y por lo
tanto no respetan la preferencia del sistema.

## 5. Arquitectura del shell móvil

### 5.1 Tab Bar

Componente nuevo, visible solo bajo 768 px, fijo al borde inferior, con altura
de 49 px más `env(safe-area-inset-bottom)`, fondo de material translúcido y
separador hairline superior.

La composición se deriva del mismo predicado que ya usa el sidebar
(`isOperationalOnly`, definido en `packages/business/src/roleTaskMapping.ts:36-58`),
no del rol primario, porque existen usuarios con roles mixtos.

| Perfil | Tabs |
|---|---|
| Operativo puro | Tareas · Chat · Notificaciones · Ayuda |
| Recepción | Pedidos · Clientes · Chat · Notificaciones · Más |
| Admin y superuser | Panel · Pedidos · Chat · Notificaciones · Más |

El caso operativo es un mapeo uno a uno con su menú actual: no hay jerarquía
oculta. El botón "Más" abre un sheet con los destinos restantes, incluyendo
Configuración, Instalar aplicación y Reportar error.

Chat y Notificaciones muestran badge, reutilizando los hooks existentes
`useChatUnreadCount` y `useUnreadNotificationsCount`.

Bajo 768 px el sidebar y su `SidebarTrigger` dejan de renderizarse.

**Simplificación deliberada:** cada tab navega a su ruta raíz. No se implementan
stacks de navegación independientes por tab (el comportamiento de iOS donde cada
pestaña recuerda su profundidad), porque el App Router no lo soporta de forma
natural y el beneficio no justifica la complejidad en esta versión.

### 5.2 Bottom sheet

Se extiende `components/ui/sheet.tsx`, que ya soporta `side="bottom"`, para
añadir: grabber visible, arrastre vertical con Framer Motion, detents (medio a
50%, grande a 92%), cierre por velocidad de gesto y esquinas superiores
redondeadas.

Sustituye a los popovers y diálogos centrados en: filtros de pedidos
(`OrdersFilterBar.tsx:195`, hoy un popover de 336 px sobre un viewport de
375 px), menú de exportación, acciones masivas, selector de fecha y
`creatable-combobox`.

### 5.3 Navegación y gestos

- **Transición de ruta:** se reemplaza el fade vertical actual
  (`lib/motion.ts:78-83`) por push/pop direccional en X, con parallax del 30% en
  la pantalla saliente. Requiere llevar registro de la profundidad de ruta para
  distinguir push de pop.
- **`AnimatePresence`** pasa de `mode="wait"` a `mode="popLayout"`. El modo
  actual desmonta la pantalla saliente antes de montar la entrante, lo que
  produce un parpadeo.
- **Swipe-back:** gesto desde el borde izquierdo, con umbral de distancia y
  velocidad, que ejecuta `router.back()`.
- **Cambio de tab:** cross-fade inmediato, nunca push. En iOS cambiar de pestaña
  no es una navegación jerárquica.

### 5.4 Listas

Se introduce el patrón de lista inset-grouped: contenedor redondeado único con
separadores internos, en lugar de las tarjetas individuales con borde que usa
hoy `data-table.tsx:121-159`.

`data-table.tsx` recibe un mecanismo para declarar qué columnas aparecen en
móvil y con qué rol, mediante `meta` en `ColumnDef`:
`{ mobile: "primary" | "secondary" | "badge" | "hidden" }`. Hoy la tarjeta vuelca
las nueve columnas de Pedidos como pares etiqueta/valor, produciendo tarjetas de
unos 350 px que no se pueden recorrer con la vista.

El markup de tarjeta está duplicado literalmente en `data-table.tsx:121-159` y
`:246-284`; se extrae antes de modificarlo.

Se añaden swipe actions sobre las filas móviles, envolviendo cada fila en un
`motion.div` con `drag="x"`. Debe convivir con el `onRowClick` existente
mediante un umbral de arrastre que suprima el click.

### 5.5 Header con large title

Componente nuevo que sustituye al `Title.tsx` actual (un `<h1>` estático de
`text-4xl`): título grande al tope del scroll que colapsa a título centrado de
17 px en la barra de 44 px al desplazarse, con separador hairline que aparece
con el colapso.

### 5.6 Pull-to-refresh

Gesto de arrastre hacia abajo en el tope del scroll que dispara el `refetch` de
TanStack Query correspondiente. Se aplica en Pedidos, Notificaciones e Historial,
donde es el gesto esperado en iOS. `overscroll-behavior-y: none` ya está puesto
en `globals.css:226`, lo que evita que el gesto compita con el rebote nativo.

### 5.7 Teclado virtual

Se añade un hook basado en `visualViewport` que expone la altura del teclado, y
se declara `interactive-widget=resizes-content` en el viewport. El chat ancla su
composer sobre el teclado; los formularios largos desplazan el campo enfocado a
la vista.

### 5.8 Configuración PWA

Se completa: `apple-mobile-web-app-capable`, `apple-mobile-web-app-title`,
`apple-mobile-web-app-status-bar-style: black-translucent` (necesario para que el
contenido pase bajo el notch), apple touch icon de 180×180, splash screens para
los tamaños de iPhone vigentes, `orientation: "portrait"` e `id` en el manifest,
y atajos a Pedidos y Chat.

No se bloquea el zoom: los inputs ya están a 16 px, así que el zoom por foco no
ocurre, y mantener el zoom disponible es un requisito de accesibilidad.

## 6. Chat con estructura de WhatsApp

El chat recibe tratamiento propio porque es la única parte del proyecto que
requiere cambios de backend y porque su patrón de referencia no es iOS genérico
sino WhatsApp específicamente.

### 6.1 Decisiones

| Decisión | Elección |
|---|---|
| Fidelidad visual | Estructura de WhatsApp, color de marca. Las burbujas propias van en magenta, no en el verde de WhatsApp. |
| Checks de entrega | Incluidos, con los tres estados. Requiere backend. |
| Escribiendo y en línea | Ambos incluidos. Requiere backend. |
| Escritorio | Dos paneles fijos, al estilo de WhatsApp Web. |
| Móvil | Navegación de dos niveles: lista, y push al hilo. |

### 6.2 Estructura de navegación

Bajo 768 px el chat deja de mostrar lista e hilo apilados. Hoy
`chat/page.tsx:146` y `ConversationList.tsx:127` los apilan con la lista limitada
a `max-h-[45vh]`, lo que deja unos 230 px de mensajes visibles. Pasa a dos
niveles: la lista ocupa la pantalla completa, y tocar una conversación empuja el
hilo con la transición push definida en 5.3, con swipe-back para volver.

Sobre 768 px, dos paneles: lista fija a la izquierda (320 px) e hilo a la
derecha, con estado vacío cuando no hay conversación seleccionada.

### 6.3 Lista de conversaciones

Fila de 72 px de alto con:

- Avatar circular de 49 px a la izquierda.
- Nombre de la conversación en `headline` (17 px, semibold).
- Preview del último mensaje en `subhead` (15 px), en color atenuado, truncado a
  una línea. Con prefijo de remitente en conversaciones de área.
- Hora del último mensaje arriba a la derecha, en `footnote`, atenuada; en color
  de acento cuando hay mensajes sin leer.
- Badge circular de no leídos abajo a la derecha, alimentado por el
  `unreadCount` que la API ya entrega en `ChatConversation`.
- Separador hairline con sangría: empieza donde empieza el texto, no bajo el
  avatar.

Se añaden swipe actions sobre la fila, reutilizando el mecanismo de 5.4.

Se elimina el índice alfabético A-Z de `chat/page.tsx:180-196`, cuyos targets
miden unos 10 px (`text-[9px] px-1 py-[1px]`) y que WhatsApp no tiene. Se
sustituye por un campo de búsqueda al tope de la lista.

### 6.4 Hilo de mensajes

**Agrupación.** Los mensajes consecutivos del mismo remitente forman un grupo:
solo la primera burbuja lleva cola y solo la primera muestra el nombre del
remitente en conversaciones de área. La separación entre burbujas del mismo
grupo baja a 2 px, contra 8 px entre grupos.

**Cola.** Hoy se simula achatando una esquina (`MessageThread.tsx:428-429`, con
`rounded-br-md` y `rounded-bl-md`). Se sustituye por una cola real dibujada en
SVG en la esquina inferior del lado correspondiente, que es lo que da la
silueta reconocible.

**Hora dentro de la burbuja.** En la esquina inferior derecha, en `caption-2`
(11 px) atenuada. El último renglón de texto reserva espacio a la derecha para
que la hora no se superponga, que es como lo resuelve WhatsApp.

**Checks.** Junto a la hora, solo en mensajes propios: un check para enviado,
doble check para entregado, doble check en color de acento para leído.

**Separadores de fecha.** Píldora centrada con fondo translúcido y texto en
`caption-1` en mayúsculas: "HOY", "AYER" o la fecha.

**Fondo.** Patrón sutil derivado de la identidad de EMD, con opacidad muy baja,
definido para tema claro y oscuro. Cumple la función del wallpaper de WhatsApp:
separar visualmente el hilo del resto de la aplicación.

**Header del hilo.** Chevron de retroceso, avatar, nombre y, debajo, la línea de
estado: "escribiendo…" cuando aplica, en su defecto "en línea", y en su defecto
la última conexión.

Se conserva lo que ya funciona: adjuntos, imágenes, audio y referencias a
pedidos.

### 6.5 Composer

Se reconstruye el bloque de `MessageThread.tsx:617-679`, que hoy pone cuatro
controles, el área de texto y un botón "Enviar" con etiqueta en una sola fila,
dejando el campo en unos 100 px de ancho a 375 px.

- Campo de texto redondeado que crece hasta cinco líneas.
- Adjuntos colapsados tras un único botón que abre un action sheet.
- Botón circular a la derecha que alterna: micrófono cuando el campo está vacío,
  enviar cuando hay texto.
- Anclado sobre el teclado mediante el hook de 5.7.
- `enterKeyHint="send"`. Se elimina el atajo Shift+Enter del placeholder en
  táctil, donde no aplica.

Se corrige además `MessageThread.tsx:330`, que hace `scrollIntoView` con
`behavior: "smooth"` en cada cambio y compite con la animación del teclado de
iOS: pasa a asignación directa de `scrollTop`.

### 6.6 Cambios en el backend

Repositorio `backend-emd` (NestJS + Prisma + Socket.IO). Análisis realizado
sobre el esquema, el servicio de chat y el gateway de notificaciones.

**Lo que ya existe y se reutiliza.** `ChatConversationMember`
(`prisma/schema.prisma:369`) ya guarda `lastReadAt` por miembro, y
`chat.service.ts:355-363` ya lo usa para calcular `unreadCount`. Es decir, la
noción de "hasta dónde leyó cada usuario" ya está modelada: los checks de lectura
no requieren tabla nueva, solo exponer ese dato. El endpoint
`GET /chat/conversations/:id/members` (`chat.controller.ts:76`) ya devuelve los
miembros y solo necesita incluir el campo.

**Modelo de lectura.** Un mensaje se considera leído por un miembro cuando el
`lastReadAt` de ese miembro es posterior o igual al `createdAt` del mensaje. En
conversaciones de área, el doble check en color de acento aparece cuando **todos
los miembros no monitores, excluyendo al emisor**, cumplen esa condición. Los
miembros con `isMonitor` en verdadero (administradores y superusuarios que
observan el canal) quedan excluidos del cálculo: son observadores, y contarlos
haría que un mensaje nunca se marcara como leído.

**Estado "entregado".** Es el único de los tres estados que no se puede derivar
de lo existente. Requiere un campo `deliveredAt` en `ChatConversationMember`,
siguiendo el mismo patrón que `lastReadAt`, actualizado cuando el cliente
destinatario confirma la recepción por socket.

**Eventos de socket nuevos.** El gateway
(`src/notifications/notifications.gateway.ts`) hoy es unidireccional: emite
siete eventos y no escucha ninguno. No existe un solo `@SubscribeMessage` en el
proyecto, y la decisión está documentada como deliberada en sus líneas 169-174.

Este trabajo la revierte parcialmente, y conviene registrarlo como decisión
consciente: se añaden tres listeners (`chatDelivered`, `chatTyping`,
`chatStopTyping`). La mitigación es que **ninguno confía en el payload del
cliente**: el `conversationId` recibido se valida contra la membresía real
mediante `ChatService` antes de reemitir nada. El cliente nunca decide a quién
se le entrega un evento.

Se añaden también dos eventos emitidos: `chatRead`, disparado desde
`markConversationAsRead` (`chat.service.ts:677-691`) hacia los demás miembros, y
`presenceChanged`.

**Presencia.** El gateway ya hace `client.join('user:<id>')` en la conexión. Por
lo tanto el estado en línea se resuelve preguntando si esa sala tiene sockets,
sin construir un mapa propio de conexiones. Esto es importante porque
`common/adapters/redis-io.adapter.ts` activa el adaptador de Redis cuando existe
`REDIS_URL`, y ese adaptador sincroniza las salas entre instancias: consultar la
sala funciona igual con una instancia o con varias, mientras que un mapa en
memoria solo sería correcto con una.

Lo que sí falta hoy es que `handleDisconnect` (`:165-167`) no sabe qué usuario se
desconectó, porque el token decodificado no se guarda en `client.data`. Ese es el
primer arreglo.

Para "última vez" se añade `lastSeenAt` a `User`, escrito en la desconexión.

**Migraciones.** Prisma Migrate con SQL versionado en `prisma/migrations/`, con
el formato `<timestamp>_<snake_case>`. Se requieren dos columnas nuevas
(`ChatConversationMember.deliveredAt` y `User.lastSeenAt`), que pueden ir en una
sola migración. Ambas son nulables, por lo que no requieren backfill ni implican
riesgo sobre datos existentes.

**Resumen del trabajo de backend.**

| Función | Esquema | Socket | Endpoints |
|---|---|---|---|
| ✓✓ leído | Ninguno; reutiliza `lastReadAt` | Emite `chatRead` | Exponer `lastReadAt` en `/members` |
| ✓✓ entregado | `deliveredAt` en miembro | Escucha `chatDelivered` | Ninguno |
| Escribiendo | Ninguno | Escucha `chatTyping`/`chatStopTyping` | Ninguno |
| En línea | Ninguno | Emite `presenceChanged`; guardar usuario en `client.data` | Incluir estado en `/members` |
| Última vez | `lastSeenAt` en `User` | Escritura en desconexión | Incluir en `/members` |

## 7. Plan de fases

El orden responde a una restricción concreta: las fases 0 a 2 tocan archivos
compartidos (`button.tsx`, `globals.css`, `tailwind.config.js`, `motion.ts`), de
modo que paralelizarlas produciría conflictos. La fase 5 sí es masivamente
paralelizable porque cada página es independiente una vez fijados la fundación y
el shell.

**Fase 0 — Bugs funcionales.** B1 a B6. Independientes entre sí, paralelizables.

**Fase 1 — Fundación.** Escala tipográfica, tokens nuevos, variante táctil de
44 px en los primitivos, unificación del breakpoint, presets de movimiento y
bloque de `prefers-reduced-motion`. Secuencial.

**Fase 2 — Shell móvil.** Tab Bar, bottom sheet con detents, action sheet,
header con large title, swipe-back y transiciones push/pop, pull-to-refresh,
swipe actions, hook de teclado, configuración PWA. Parcialmente paralelizable
por componente.

**Fase 3 — Corte vertical del operario.** `orders` y `orders/[id]`, en ese
orden. Valida que el shell funciona en la ruta real de trabajo antes de
escalarlo al resto. Secuencial, con revisión al final.

**Fase 4 — Chat con estructura de WhatsApp.** Se divide en dos, y el orden
importa porque el frontend consume lo que el backend expone:

- **4a, backend.** Migración de las dos columnas, exposición de `lastReadAt` y
  presencia en `/members`, guardado del usuario en `client.data`, los tres
  listeners nuevos con validación de membresía, y los eventos `chatRead` y
  `presenceChanged`. Repositorio `backend-emd`.
- **4b, frontend.** Navegación de dos niveles en móvil y dos paneles en
  escritorio, lista de conversaciones, burbujas con cola y agrupación, checks,
  separadores de fecha, fondo, header con estado y composer nuevo.

**Fase 5 — Resto de páginas.** Dashboard, notificaciones, clientes, usuarios,
configuración, historial, ayuda, login, rendimiento, admin, más los redirects de
T11. Incluye resolver T9 (dar trigger táctil al command palette u omitirlo en
móvil, y ocultar los atajos de teclado en táctil) y T10 (unificar el login).
Configuración se reconstruye como lista agrupada estilo Ajustes de iOS, para lo
cual sus siete secciones locales se extraen a `components/settings/`.
Paralelizable con un agente por página.

**Fase 6 — Escritorio y gráficas.** Verificación de que el escritorio no se
degradó, más la adaptación táctil de Recharts (T8).

## 8. Criterios de aceptación

1. Ningún control interactivo mide menos de 44×44 px bajo 768 px de ancho.
2. Ninguna página produce scroll horizontal a 375 px de ancho.
3. Un operario puede abrir un pedido, cambiar su estado y adjuntar una foto sin
   que ningún control quede fuera del alcance del pulgar ni tapado por el
   teclado.
4. La captura de foto funciona de extremo a extremo en iOS Safari en modo
   standalone, incluyendo conversión de HEIC y compresión bajo el límite.
5. El login ofrece autofill del llavero de iOS.
6. Los seis bugs de la sección 3.2 quedan corregidos y verificados.
7. El escritorio conserva su comportamiento actual: sidebar, tablas y densidad
   de información no se degradan.
8. `prefers-reduced-motion` desactiva las animaciones nuevas.
9. En el chat, un mensaje propio recorre visiblemente los tres estados: enviado,
   entregado y leído. En un canal de área, el estado leído solo aparece cuando
   todos los miembros no monitores lo han leído.
10. El indicador de escritura aparece y desaparece de forma fiable, y el estado
    en línea es correcto con el adaptador de Redis activo y sin él.
11. Ningún listener de socket actúa sobre un `conversationId` sin validar antes
    la membresía real del emisor contra la base de datos.

## 9. Fuera de alcance

- Stacks de navegación independientes por tab (justificado en 5.1).
- Cambios de backend fuera del chat. Los del chat están acotados a lo descrito
  en 6.6: dos columnas nulables, tres listeners de socket y dos eventos nuevos.
  No se tocan los contratos de pedidos, clientes, usuarios ni notificaciones.
- Historial de "última vez" más allá de una marca de tiempo por usuario. No se
  registra actividad detallada.
- Reemplazo de Recharts por otra librería de gráficas; solo se adapta al tacto.
- Aplicación nativa real o envoltorio tipo Capacitor. El objetivo es una PWA que
  se sienta nativa.
- Internacionalización. La aplicación permanece en español.

## 10. Riesgos

- **Migración tipográfica amplia.** Subir el cuerpo de 14 a 17 px cambia el
  volumen de todas las pantallas y puede romper layouts que asumían texto
  pequeño. Se mitiga haciéndolo en la fase 1, antes de adaptar páginas, para que
  el trabajo de la fase 4 ya parta de la escala final.
- **Swipe-back contra swipe actions.** Ambos gestos son horizontales. Se mitiga
  restringiendo swipe-back a una zona de borde de 20 px.
- **Rendimiento de las tarjetas móviles.** Virtualizar la rama móvil requiere
  altura de fila fija; `measureElement` durante la inercia es costoso en Safari.
- **Regresión en escritorio.** Todo cambio en los primitivos afecta ambas
  plataformas. La fase 6 existe específicamente para detectarlo.
- **Superficie de ataque nueva en el socket.** Pasar el gateway de
  unidireccional a bidireccional introduce entradas que antes no existían, y
  revierte una decisión de diseño deliberada del proyecto. Se mitiga validando
  la membresía contra la base de datos en cada listener y no reemitiendo jamás a
  destinatarios derivados del payload del cliente.
- **Volumen de eventos de escritura.** El indicador de "escribiendo" puede
  generar mucho tráfico de socket si se emite en cada tecla. Se mitiga con
  supresión en el cliente y expiración por tiempo en el receptor, de modo que un
  indicador nunca quede colgado si se pierde el evento de cierre.
- **Presencia entre empleados.** Mostrar quién está en línea cambia la dinámica
  social de una herramienta de trabajo. La decisión fue tomada explícitamente
  por el dueño del producto; se registra aquí porque conviene poder revertirla
  sin desmontar el resto del chat, por lo que se implementa detrás de una
  condición que permita apagarla.

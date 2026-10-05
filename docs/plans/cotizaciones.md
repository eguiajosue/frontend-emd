# Plan: Cotizaciones

## Qué hace Recepción hoy
Manda por WhatsApp un listado así:
```
* OFISDECO .✅enviada -en espera de montajes
* ESTEBAN TALAMAS . ☑️pendiente lleve la camioneta para medir
* DDN . ☑️HOY
* IHS . ☑️en espera de montajes *prioridad mañana
```

## Decisiones del usuario
- Captura mínima: **cliente o empresa** (registrado del catálogo o texto libre, como en Nuevo pedido) + **descripción**.
- Dos grupos con subestados:
  - **Por enviar (pendientes)**: Lista · Pendiente medidas · Info · Esperando montaje.
  - **Enviadas**: Esperando respuesta (estado inicial al enviar) · Aceptada · No aceptada · Comentarios.
- **Prioridad**: Hoy / Mañana / Normal. Se guarda como fecha (`priorityDate`), no como texto, para que al día siguiente se muestre "Atrasada" en vez de seguir diciendo "Hoy".
- Extras: **pegar lista de WhatsApp** (crea varias de golpe detectando estado y prioridad), **copiar para WhatsApp** (mismo formato ✅/☑️), **convertir en pedido** (una aceptada abre Nuevo pedido prellenado y queda ligada al pedido), **ligar a cliente registrado**.
- Acceso: Recepción y admin/superuser; lista compartida entre ellos.

## Backend (NestJS + Prisma)
Modelo `Quote`:
- `id`, `clientId Int?` (FK Client, SetNull), `clientName String` (texto libre o nombre del cliente al momento), `description String` (≤ 1000)
- `stage` enum-like String: `por_enviar` | `enviada`
- `status` String: por_enviar → `lista` | `pendiente_medidas` | `info` | `esperando_montaje`; enviada → `esperando_respuesta` | `aceptada` | `no_aceptada` | `comentarios`
- `comment String?` (≤ 1000; útil en "comentarios"/"no aceptada")
- `priorityDate DateTime? @db.Date` (null = Normal)
- `sentAt DateTime?` (se fija al pasar a enviada), `orderId Int? @unique` (FK Order, SetNull) cuando se convierte en pedido
- `createdById Int?` (SetNull), `createdAt`, `updatedAt`
- Índices: `(stage, status)`, `(priorityDate)`, `(updatedAt)`
Endpoints `quotes` (roles recepcion/admin/superuser):
- `GET /quotes?stage=&status=&q=` → lista (orden: prioridad vencida/hoy/mañana primero, luego updatedAt desc).
- `POST /quotes` `{ clientId?, clientName, description, stage?, status?, priorityDate?, comment? }`.
- `POST /quotes/bulk` `{ items: [...] }` (≤ 100) para "pegar lista", en una transacción.
- `PATCH /quotes/:id` (cualquier campo editable; validar status ∈ stage; al pasar a enviada sin status → esperando_respuesta y `sentAt=now`).
- `POST /quotes/:id/link-order` `{ orderId }` (sólo si status = aceptada; valida que el pedido exista).
- `DELETE /quotes/:id` (204).
Validaciones en español; specs de servicio y de roles.

## Frontend (apps/web)
- Ruta `/dashboard/cotizaciones`, ítem "Cotizaciones" en el menú (Operación, Recepción/admin, icono `FileText`/`ReceiptText`), integrado con la barra personalizable.
- Vista: pestañas **Por enviar** / **Enviadas** con contadores; dentro, filtros por subestado (chips) y búsqueda; lista/tarjetas con cliente, descripción, chip de prioridad (Hoy/Mañana/Atrasada), subestado editable en un clic, comentario.
- Alta rápida (cliente con el mismo combobox de clientes + descripción + subestado + prioridad), atajo de teclado.
- "Pegar de WhatsApp": textarea → parser puro (`lib/quotes/parseWhatsApp.ts`) que detecta cliente, descripción, ✅ (enviada) / ☑️ (por enviar), palabras clave (enviada, en espera de montajes, medir/medidas, HOY, prioridad mañana) → vista previa editable → crear en bloque.
- "Copiar para WhatsApp": generador puro (`lib/quotes/formatWhatsApp.ts`) → portapapeles.
- "Convertir en pedido": en una aceptada abre `CreateOrderDialog` prellenado (cliente + descripción) y al crearse liga `orderId`; la tarjeta muestra "Pedido #N".
- Tests: parser (con el listado real del usuario), formatter, hooks, página (cambios de estado, filtros, alta, pegar, copiar, convertir), nav; e2e del flujo principal.

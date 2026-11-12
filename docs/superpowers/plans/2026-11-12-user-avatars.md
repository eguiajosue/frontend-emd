# Avatares generados por usuario — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada usuario muestra un avatar generado a partir de una semilla, y puede sortear uno nuevo con el botón "Otro".

**Architecture:** `User.avatarSeed String?` en backend (null = semilla es el id). `PATCH /users/me/avatar` sortea la semilla en el servidor. Un componente `UserAvatar` en el frontend convierte la semilla en SVG con DiceBear y deja las iniciales como respaldo; reemplaza el avatar de usuario en los sitios que hoy usan `AvatarFallback`.

**Tech Stack:** NestJS + Prisma + Jest (`backend-emd`); Next.js + Radix Avatar + React Query + Vitest (`frontend-emd/apps/web`); DiceBear.

**Spec:** `frontend-emd/docs/superpowers/specs/2026-11-12-user-avatars-design.md`

Ambos repos se desarrollan en la rama `claude/magical-noether-qwtju7`.

## Global Constraints

- Sin subir fotos, sin galería de opciones, sin editar el avatar de otra persona.
- La semilla la genera el servidor; el endpoint no recibe body.
- Null en `avatarSeed` = semilla `String(id)`.
- Las iniciales siguen como `AvatarFallback`.
- DiceBear con un solo estilo, importado sin traer toda la colección; confirmar tamaño y licencia antes de instalar.
- `CreateOrderDialog.tsx:1563` es el avatar de un *cliente*, no de un usuario: no se toca.
- No exponer `password` en ningún payload nuevo.

## Review Focus

- Dos sorteos seguidos dan semillas distintas (el servidor no repite la anterior por azar de caché).
- Usuario con `avatarSeed` null y `id` válido: avatar estable entre recargas.
- Payload sin `id` ni `avatarSeed` (por ejemplo un autor borrado): cae a iniciales, sin error.
- Doble clic rápido en "Otro": no deja el avatar propio desincronizado del guardado.
- Imagen que falla al cargar: se ve el respaldo de iniciales.
- Listas largas del chat: el SVG de una misma semilla no se regenera en cada render.
- Petición sin sesión a `PATCH /users/me/avatar`: 401.

---

### Task 1: Backend — columna y endpoint

**Files:**
- Modify: `backend-emd/prisma/schema.prisma` (modelo `User`, junto a `lastSeenAt`)
- Create: `backend-emd/prisma/migrations/20261112120000_user_avatar_seed/migration.sql`
- Modify: `backend-emd/src/user/user.service.ts`, `backend-emd/src/user/user.controller.ts`
- Test: `backend-emd/src/user/user.avatar.spec.ts`

**Interfaces:**
- Produces: `UserService.rerollAvatar(userId: number): Promise<{ avatarSeed: string }>`; ruta `PATCH /users/me/avatar` → `{ avatarSeed: string }`.

- [ ] **Step 1: Test que falla** en `user.avatar.spec.ts`, con un Prisma mínimo como en `user.storage.spec.ts`:
  - `rerollAvatar guarda y devuelve una semilla hex de 12 caracteres`: espera `user.update` llamado con `where: { id: 7 }` y `data: { avatarSeed }`, y que el resultado sea `{ avatarSeed }` con `/^[0-9a-f]{12}$/`.
  - `dos sorteos dan semillas distintas`.
- [ ] **Step 2:** `cd backend-emd && npx jest src/user/user.avatar.spec.ts` → falla (`rerollAvatar is not a function`).
- [ ] **Step 3:** Añadir `avatarSeed String? // Semilla del avatar generado. Null = se usa el id.` al modelo `User`; la migración es `ALTER TABLE "User" ADD COLUMN "avatarSeed" TEXT;`. Implementar `rerollAvatar` con `randomBytes(6).toString('hex')` y `prisma.user.update(... select: { avatarSeed: true })`. En el controlador, `@Patch('me/avatar')` con `@ApiBearerAuth() @UseGuards(AuthGuard)` y `@ActiveUser() user: AccessTokenPayload` → `rerollAvatar(user.sub)`, definido junto a `me/preferences` y antes de `:id`. Correr `npx prisma generate`.
- [ ] **Step 4:** el mismo comando de Jest pasa; `npx tsc --noEmit` sin errores.
- [ ] **Step 5: Commit** `feat(user): avatarSeed y PATCH /users/me/avatar`.

### Task 2: Backend — avatarSeed en los payloads que muestran usuarios

**Files:**
- Modify: `backend-emd/src/chat/chat.service.ts` (`USER_SUMMARY_SELECT` ~línea 93, mapeo del directorio ~863, mapeo de `otherUser` ~466-499)
- Modify: `backend-emd/src/order/order.service.ts` (`ASSIGNED_USER_SELECT` ~línea 152; cubre asignado, creador y autor de notas)
- Modify: el `select` del usuario en el log de auditoría de pedidos (localizar con `grep -rn "orderAuditLog" backend-emd/src`)
- Test: spec existente más cercano de cada servicio, o `backend-emd/src/chat/chat.avatar.spec.ts`

**Interfaces:**
- Consumes: columna `User.avatarSeed` de la Task 1.
- Produces: `avatarSeed: string | null` junto a `id` en usuarios de chat (remitente, miembros, `otherUser`), en `assignedUser`/`user` de pedidos y notas, y en el `user` de cada entrada de auditoría.

- [ ] **Step 1: Test que falla:** el mapeo del directorio de chat devuelve `avatarSeed` para cada usuario (`expect(result[0]).toHaveProperty('avatarSeed', 'abc123')` con un usuario de prueba que lo tiene).
- [ ] **Step 2:** correrlo → falla.
- [ ] **Step 3:** añadir `avatarSeed: true` a los tres `select` y propagarlo en los dos mapeos de chat que construyen objetos a mano. No tocar `USER_SAFE_SELECT`: `GET /auth/profile` ya devuelve todos los escalares salvo `password`.
- [ ] **Step 4:** correr `npx jest src/chat src/order src/user` y `npx tsc --noEmit`; pasan.
- [ ] **Step 5: Commit** `feat(avatar): exponer avatarSeed en chat, pedidos y auditoría`.

### Task 3: Frontend — dependencia, tipos y `UserAvatar`

**Files:**
- Modify: `frontend-emd/apps/web/package.json` (+ lockfile)
- Modify: `frontend-emd/packages/types/src/index.ts` (`AssignedUser` ~línea 257 y los tipos de usuario de chat ~817-839: añadir `avatarSeed?: string | null`)
- Create: `frontend-emd/apps/web/src/lib/avatar.ts`
- Create: `frontend-emd/apps/web/src/components/UserAvatar.tsx`
- Test: `frontend-emd/apps/web/src/lib/avatar.test.ts`, `frontend-emd/apps/web/src/components/UserAvatar.test.tsx`

**Interfaces:**
- Produces: `avatarSeedFor(user?: { id?: number | string | null; avatarSeed?: string | null } | null): string | null` (`avatarSeed ?? String(id)`, `null` si no hay ninguno); `avatarDataUri(seed: string): string` (SVG como data URI, memoizado por semilla); `<UserAvatar user={...} initials={string} className? fallbackClassName? />`.

- [ ] **Step 1:** verificar DiceBear antes de instalar: `pnpm view @dicebear/core license version` y `pnpm view @dicebear/collection license version`; confirmar que se puede importar un solo estilo (`import { thumbs } from "@dicebear/collection"`) y que el bundle no arrastra toda la colección. Si la licencia o el tamaño no sirven, parar y avisar antes de seguir.
- [ ] **Step 2: Tests que fallan:** en `avatar.test.ts`: `avatarSeedFor({ id: 5, avatarSeed: null })` → `"5"`; `avatarSeed` presente gana sobre `id`; `avatarSeedFor(null)` → `null`; `avatarDataUri("a")` empieza por `data:image/svg+xml` y llamarla dos veces con la misma semilla devuelve el mismo string. En `UserAvatar.test.tsx`: con usuario muestra una `<img>` cuyo `src` es `avatarDataUri(seed)`; sin `id` ni semilla muestra solo las iniciales; con error de carga de imagen muestra las iniciales.
- [ ] **Step 3:** correr `pnpm --filter web test avatar` → falla.
- [ ] **Step 4:** instalar `@dicebear/core` y `@dicebear/collection`; implementar las tres piezas. `UserAvatar` compone `Avatar`/`AvatarImage`/`AvatarFallback` de `ui/avatar.tsx` y pasa `className`/`fallbackClassName` tal cual; la imagen solo se renderiza si hay semilla.
- [ ] **Step 5:** `pnpm --filter web test avatar` pasa y `pnpm --filter web exec tsc --noEmit` sin errores.
- [ ] **Step 6: Commit** `feat(avatar): UserAvatar con DiceBear`.

### Task 4: Frontend — avatar propio y botón "Otro"

**Files:**
- Create: `frontend-emd/apps/web/src/hooks/useMyAvatar.ts`
- Modify: `frontend-emd/apps/web/src/components/AppTopBar.tsx` (`UserMenu`, ~líneas 95-135) y `frontend-emd/apps/web/src/components/MobileMoreSheet.tsx` (~línea 113)
- Test: `frontend-emd/apps/web/src/hooks/useMyAvatar.test.tsx`

**Interfaces:**
- Consumes: `UserAvatar`, `avatarSeedFor` (Task 3); `PATCH /users/me/avatar` y `GET /auth/profile` (Task 1).
- Produces: `useMyAvatar(): { user: { id: string; avatarSeed: string | null }; reroll: () => void; isRerolling: boolean }`.

- [ ] **Step 1: Test que falla** (`useMyAvatar.test.tsx`, mockeando el cliente de API como lo hace `useUserPreferences`): `reroll` llama a `PATCH /users/me/avatar`, y tras responder `{ avatarSeed: "abc123" }` el hook devuelve esa semilla sin recargar; `reroll` mientras `isRerolling` es `true` no lanza una segunda petición.
- [ ] **Step 2:** correrlo → falla.
- [ ] **Step 3:** implementar el hook con React Query: la semilla actual sale de `GET /auth/profile` (clave `["profile"]`), la mutación pone el resultado en esa caché. Seguir el patrón de fetch de `useUserPreferences.ts`. En `UserMenu`, usar `UserAvatar` con las iniciales actuales y añadir un `DropdownMenuItem` "Otro avatar" que llame a `reroll`; deshabilitado mientras `isRerolling`. En `MobileMoreSheet`, usar `UserAvatar` con `useMyAvatar`, sin botón.
- [ ] **Step 4:** `pnpm --filter web test useMyAvatar AppTopBar MobileMoreSheet` pasa (ajustar el mock de `MobileMoreSheet.test.tsx` si el hook nuevo lo rompe).
- [ ] **Step 5: Commit** `feat(avatar): botón Otro y avatar propio`.

### Task 5: Frontend — avatares de otros usuarios

**Files:**
- Modify: `frontend-emd/apps/web/src/app/dashboard/chat/components/MessageThread.tsx` (líneas ~564, ~638 conversación directa, ~699 miembros)
- Modify: `frontend-emd/apps/web/src/app/dashboard/chat/components/ConversationList.tsx` (~línea 71, solo conversaciones directas)
- Modify: `frontend-emd/apps/web/src/components/orders/OrderCard.tsx` (~línea 154)
- Modify: `frontend-emd/apps/web/src/components/orders/detail/OrderActivitySections.tsx` (~línea 156) y `frontend-emd/apps/web/src/lib/orderAuditLog.ts` (`AuditLogLine` gana `actor`)
- Test: tests existentes de `ConversationList`, `MessageThread`, `orderAuditLog`

**Interfaces:**
- Consumes: `UserAvatar` (Task 3), `avatarSeed` en los payloads (Task 2).

- [ ] **Step 1: Test que falla:** en `orderAuditLog` test, `buildAuditLines(entry)[0].actor` conserva `id` y `avatarSeed` de `entry.user`; en `ConversationList.test.tsx`, una conversación directa con `otherUser.avatarSeed = "abc123"` renderiza la `<img>` de esa semilla, y una de área sigue mostrando el icono `#`.
- [ ] **Step 2:** correrlos → fallan.
- [ ] **Step 3:** sustituir cada `Avatar`+`AvatarFallback` de usuario por `UserAvatar`, conservando las clases de tamaño y color que ya tiene cada sitio. En conversaciones directas usar `conversation.otherUser`; en grupos de área no hay avatar de usuario. No cambiar `CreateOrderDialog`.
- [ ] **Step 4:** `pnpm --filter web test` completo, `pnpm --filter web exec tsc --noEmit` y `pnpm --filter web lint` pasan.
- [ ] **Step 5: Commit** `feat(avatar): avatares generados en chat y pedidos`.

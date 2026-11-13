# Avatares generados por usuario — diseño corto

Repos: `backend-emd` (columna + endpoint) y `frontend-emd` (componente + botón).

## Intención y por qué
Hoy los 8 sitios con avatar muestran solo iniciales (`AvatarFallback`); no hay imagen ni campo en `User`.
Se quiere que cada usuario tenga un avatar generado solo, sin subir fotos, y poder cambiarlo con un botón "Otro" que sortee uno nuevo. Los demás usuarios deben ver el avatar elegido (chat, pedidos).

## Metas
- Todo usuario muestra avatar desde el día uno, sin migrar datos.
- Botón "Otro" en el menú de cuenta: sortea un avatar nuevo y lo guarda.
- Los demás lo ven en chat, tarjetas de pedido y actividad.

## No metas
- Subir fotos, galería para elegir entre opciones, editar el avatar de otra persona, avatar por dispositivo.

## Anti-metas
- Que el avatar rompa la lectura en tamaños de 20–28 px (las iniciales siguen como respaldo mientras carga o si falla).
- Que el cliente pueda guardar texto arbitrario como semilla.

## Restricciones
- Cuentas compartidas (`isSharedAccount`): el avatar es de la cuenta, no de la persona.
- Preferencias privadas (`navPreferences`…) no sirven: otros usuarios no las leen.

## Aproximaciones (elegida: B)
- A. Solo frontend, semilla = id del usuario. Barata, pero no se puede cambiar.
- **B. Columna `User.avatarSeed String?`. Elegida.** Null = se usa el id como semilla. "Otro" guarda una semilla nueva. Los demás la ven porque viaja con el usuario.
- C. Dentro de las preferencias Json existentes. Descartada: son privadas.

## Diseño
**Backend**
- Migración: `avatarSeed String?` en `User`.
- `PATCH /user/me/avatar`, sin body: el servidor genera la semilla (`crypto.randomBytes`, hex corto), la guarda y devuelve `{ avatarSeed }`. Sin input del cliente, no hay nada que validar.
- Incluir `avatarSeed` en los lugares donde se devuelven usuarios: `auth.profile`, miembros/autores de chat, usuario asignado de pedidos, auditoría. La lista exacta la fija el plan (hay varios `select` de `firstName`).
- Test de servicio: sortea, guarda, y dos llamadas dan semillas distintas.

**Frontend**
- Dependencia: DiceBear (`@dicebear/core` + un solo estilo, importado de forma que no entre toda la colección).
- Un componente `UserAvatar` sobre `ui/avatar.tsx`: genera el SVG como data URI desde `avatarSeed ?? String(id)`, lo pone en `AvatarImage` y deja `AvatarFallback` con las iniciales.
- Sustituir el `Avatar` + `AvatarFallback` de los 8 sitios por `UserAvatar`, pasándole el usuario.
- Botón "Otro" en el menú de cuenta de `AppTopBar`; llama al endpoint y refresca el usuario en sesión.
- Test del componente: usa la semilla, cae a id, muestra iniciales si no hay imagen.

## Decisiones mías (revisables)
- Semilla generada en el servidor, no en el cliente.
- Botón en el menú de cuenta de `AppTopBar`.
- Estilo concreto de DiceBear, y si su tamaño y licencia son aceptables, los confirma el plan antes de instalar.

## Pendiente del plan
- Qué payloads no traen `id`/`avatarSeed` hoy y hay que ampliar.
- Cómo se refresca el usuario en sesión tras sortear (según cómo guarda el estado `AppTopBar`).

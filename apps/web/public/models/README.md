# Modelos 3D del creador de mockups

## `tshirt.glb` — playera básica

- Origen: [pmndrs/examples](https://github.com/pmndrs/examples), ejemplo
  `t-shirt-configurator` (archivo `shirt_baked_collapsed.glb`, sin cambios).
- Licencia: MIT — Copyright (c) 2024 Poimandres.
- Contenido: malla `T_Shirt_male`, material `lambert1` con normal map de tela y
  oclusión ambiental horneada (texturas embebidas).
- Se eligió sobre `shirt_baked_lower2.glb` (más ligero) porque ése viene con
  compresión Draco (requiere el decodificador wasm, que no se puede bajar de un
  CDN) y trae un nodo `Plane` y transformaciones extra.

Texto de la licencia MIT:

```
Copyright (c) 2024 Poimandres

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Gorra trucker (Richardson 112)

No hay archivo: la gorra se construye por código en
`src/components/mockups/TruckerCapModel.ts` (forma en `capShape.ts`), sin
assets de terceros. Si más adelante se consigue un GLB con licencia (TODO R5),
debe exponer las mallas `front`, `mesh` y `visor` y usar el mismo espacio local
(+Z frente, +Y arriba, metros) para que los presets sigan sirviendo.

## Caja de cartón del Modo TV de Tareas (llegada de paquetes 3D)

No hay archivo: la caja se construye por código en
`src/components/tasks/tv/arrival3d/cardboardBox.ts` (paredes con
`RoundedBoxGeometry`, solapas con bisagra, cinta, etiqueta de envío) y sus
texturas se pintan en `<canvas>` en `arrival3d/textures.ts` (kraft con
fibras, motas y corrugado; marcas impresas; la hoja del pedido se copia del
DOM). La iluminación usa `RoomEnvironment` de three.js (MIT, incluido en el
paquete `three`). Sin assets de terceros ni descargas en runtime.

Se intentó bajar una caja CC0 (Kenney.nl, Poly Pizza, Quaternius), pero la
red del entorno de desarrollo bloquea esos sitios. Si más adelante se agrega
un GLB (CC0, ≤ 500 KB, en esta carpeta, que queda fuera del precache del
Service Worker), debe exponer las solapas como nodos separados con el pivote
en la bisagra, base en y=0 y frente hacia +Z, y registrarse aquí con origen y
licencia.

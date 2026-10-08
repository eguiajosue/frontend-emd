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

## Vehículos, taza y mousepad (GLB de Sketchfab)

Todos se cargan con `src/components/mockups/GlbModel.ts`, que dice qué
materiales son pintura (los únicos que cambian de color) y cómo se coloca cada
modelo. Los archivos de esta carpeta son una **versión optimizada** de los
originales (texturas a ≤ 1024 px en WebP, geometría cuantizada, sin texturas
rotas; la pickup, la minivan y el camión no se simplificaron de más porque las
mallas simplificadas se veían manchadas). Si se cambia un GLB hay que volver a
calcular los presets de `lib/mockups/presets.ts` (`vehicleModels.test.ts`
avisa cuando dejan de caer sobre la pintura).

| Archivo | Modelo | Autor | Licencia | Pintura recoloreable |
| --- | --- | --- | --- | --- |
| `car.glb` | [2018 Nissan Sentra Sylphy SL](https://sketchfab.com/3d-models/2018-nissan-sentra-sylphy-sl-e8d8321daf184fe58e41509964d61141) | Ddiaz Design | **CC BY-NC-SA 4.0** (uso no comercial) | `Paint_MAT` |
| `minivan.glb` | Ford Transit L4H3 (van de carga) | — (el archivo no trae autor; viene en `Van.zip`) | por confirmar | `Car Paint` |
| `pickup.glb` | [Dodge car (Ram 1500)](https://sketchfab.com/3d-models/dodge-car-6071336118d845d7b7439dba16ca2a5a) | UE4 CG model | CC BY 4.0 | `body__prim_env_4_spec*` |
| `truck.glb` | [Truck](https://sketchfab.com/3d-models/truck-eda924f23ba04cd5b1e5160abf2320fa) | ROY | CC BY 4.0 | cabina: `head_paint`; caja: `bodycolour` |
| `mug.glb` | [Plain Mug](https://sketchfab.com/3d-models/plain-mug-19c8fe5702b544d0a1409d3dac1cf90e) | LightSwitch | CC BY 4.0 | `Material.001` |
| `mousepad.glb` | [Mousepad](https://sketchfab.com/3d-models/mousepad-7f7fd0de74f64b8ebd34c9aa4c0c82e8) | TymonG | CC BY 4.0 | `Material` (sin su textura) |

Atribución requerida por CC BY 4.0: los autores de la tabla.

> ⚠️ `car.glb` es **CC BY-NC-SA**: no permite uso comercial. Antes de
> publicar el estudio de mockups a clientes hay que conseguir una licencia
> comercial del autor o cambiar el modelo.

Convención de ejes (la de todo el estudio): +Z al frente, +Y arriba, la
izquierda del vehículo en +X. Giros aplicados al cargar: la pickup (`rotationY:
π`, el GLB mira a -Z) y la taza (`-π/2`, el asa pasa de -Z a +X).

## Gorra trucker (Richardson 112)

No hay archivo: la gorra se construye por código en
`src/components/mockups/TruckerCapModel.ts` (forma en `capShape.ts`), sin
assets de terceros. Si más adelante se consigue un GLB con licencia (TODO R5),
debe exponer las mallas `front`, `mesh` y `visor` y usar el mismo espacio local
(+Z frente, +Y arriba, metros) para que los presets sigan sirviendo.

## Impresora térmica del Modo TV de Tareas (llegada de pedidos 3D)

No hay archivo: la impresora se construye por código en
`src/components/tasks/tv/arrival3d/thermalPrinter.ts` (cuerpo y tapa con
`RoundedBoxGeometry`, ranura con barra de corte dentada, guillotina, LED,
botón de avance y logo pintado en `<canvas>`). El ticket se copia del DOM a
una `CanvasTexture` (`arrival3d/textures.ts`). La iluminación usa
`RoomEnvironment` de three.js (MIT, incluido en el paquete `three`). Sin
assets de terceros ni descargas en runtime.

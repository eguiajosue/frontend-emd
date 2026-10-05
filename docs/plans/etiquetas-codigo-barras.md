# Plan: etiquetas con código de barras + escaneo en Inventario

## Decisiones del usuario
- Impresión en **impresora de etiquetas térmica** (rollo), etiqueta **35×80 mm**, una por página, desde el navegador.
- Escaneo con **lector USB/Bluetooth** (modo teclado) **y cámara del celular**.
- Al escanear en Inventario: **modo Entrada / Salida**; cada escaneo suma o resta 1 (sonido + aviso), con opción de ajustar la cantidad antes de confirmar.
- La etiqueta lleva: **nombre de la empresa**, **nombre del artículo**, **código legible** bajo las barras y **departamento/área**.

## Decisiones técnicas (por defecto)
- Simbología **Code 128** (lee cualquier lector; admite letras y números).
- Cada artículo de inventario recibe un **código propio** autogenerado (p. ej. `EMD-000123`, único). También se puede **ligar un código existente** (EAN/UPC del fabricante) al artículo.
- Escanear un código **desconocido** ofrece ligarlo a un artículo o crear uno nuevo.
- Librerías: `jsbarcode` (MIT) para dibujar el código en SVG; cámara con la API nativa `BarcodeDetector` cuando exista y `@zxing/browser` (MIT/Apache) como respaldo. Carga diferida.
- Impresión: página de impresión con `@page { size: 80mm 35mm; margin: 0 }`, vista previa, imprimir 1 o N copias, o varias etiquetas de distintos artículos en lote.

## Backend
- `InventoryItem.barcode String? @unique` (+ migración que asigna `EMD-` + id con ceros a los existentes).
- `GET /inventory/items/by-barcode/:code` (respeta departamento/permisos de inventario actuales).
- `PATCH` del artículo acepta `barcode` (validación de formato/unicidad, 409 si ya existe).
- Los movimientos usan el endpoint de movimientos existente (entrada/salida con cantidad).

## Frontend
- Inventario: botón **Imprimir etiqueta** por artículo y **Imprimir etiquetas** en lote (selección).
- Inventario: modo **Escanear** (Entrada/Salida): campo con foco que recibe el lector USB (detecta ráfaga de teclas + Enter), botón **Usar cámara**; lista de escaneos de la sesión con deshacer.
- Tests: generación de código, parser del lector (ráfaga vs. tecleo humano), flujo escanear → movimiento, desconocido → ligar; e2e con escaneo simulado.

## Orden
Después de Cotizaciones (cola: barra + mockups v2 → Cotizaciones → Etiquetas).

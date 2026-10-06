import { afterEach, vi } from "vitest";

// El setup corre para TODOS los tests, incluidos los de `src/lib` que van en
// node y no tienen `window`. Todo lo de DOM se salta ahí.
const isBrowserLike = typeof window !== "undefined";

if (isBrowserLike) {
  await import("@testing-library/jest-dom/vitest");
  const { cleanup } = await import("@testing-library/react");
  afterEach(cleanup);
}

// jsdom no implementa estas dos y varios componentes de shadcn/ui y de
// framer-motion las tocan al montar. Sin los stubs el test falla por el
// entorno, no por el componente.
if (isBrowserLike && !window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

if (isBrowserLike && !window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Tampoco IntersectionObserver, que el scroll infinito del calendario mobile
// usa para detectar cuándo cargar más meses (ver MobileMonthList).
if (isBrowserLike && !window.IntersectionObserver) {
  window.IntersectionObserver = class {
    constructor(_callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {}
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
    root = null;
    rootMargin = "";
    thresholds: number[] = [];
  } as unknown as typeof IntersectionObserver;
}

// Tampoco implementa scrollIntoView, que MessageThread usa para bajar al
// último mensaje tras cada render.
if (isBrowserLike && !window.Element.prototype.scrollIntoView) {
  window.Element.prototype.scrollIntoView = vi.fn();
}

// Ni scrollTo, que el wizard de pedidos usa para volver arriba al cambiar de paso.
if (isBrowserLike && !window.Element.prototype.scrollTo) {
  window.Element.prototype.scrollTo = vi.fn();
}

// Ni la API de Pointer Capture, que Radix Select toca en su manejo interno
// de pointerdown/pointerup (ver @radix-ui/react-select).
if (isBrowserLike && !window.Element.prototype.hasPointerCapture) {
  window.Element.prototype.hasPointerCapture = () => false;
  window.Element.prototype.setPointerCapture = () => {};
  window.Element.prototype.releasePointerCapture = () => {};
}

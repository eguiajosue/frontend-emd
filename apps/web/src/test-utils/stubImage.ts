/** jsdom no carga imágenes: Radix solo pinta <img> tras un `load`, así que se simula. */
export function stubImage(outcome: "load" | "error") {
  const original = window.Image;
  class FakeImage {
    complete = false;
    naturalWidth = 0;
    private listeners: Record<string, ((e: unknown) => void)[]> = {};
    addEventListener(type: string, cb: (e: unknown) => void) {
      (this.listeners[type] ??= []).push(cb);
    }
    removeEventListener() {}
    set src(_: string) {
      queueMicrotask(() => {
        if (outcome === "load") {
          this.complete = true;
          this.naturalWidth = 1;
        }
        this.listeners[outcome]?.forEach((cb) => cb({ currentTarget: this }));
      });
    }
  }
  window.Image = FakeImage as unknown as typeof Image;
  return () => {
    window.Image = original;
  };
}

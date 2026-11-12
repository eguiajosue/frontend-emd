import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { UserAvatar } from "./UserAvatar";
import { avatarDataUri } from "@/lib/avatar";

/** jsdom no carga imágenes: Radix solo pinta <img> tras un `load`, así que se simula. */
function stubImage(outcome: "load" | "error") {
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

describe("UserAvatar", () => {
  let restore = () => {};
  beforeEach(() => {
    restore = () => {};
  });
  afterEach(() => restore());

  it("muestra el avatar generado desde la semilla guardada", async () => {
    restore = stubImage("load");
    const { container } = render(<UserAvatar user={{ id: 3, avatarSeed: "abc123" }} initials="AG" />);
    await waitFor(() => expect(container.querySelector("img")?.getAttribute("src")).toBe(avatarDataUri("abc123")));
  });

  it("sin semilla usa el id como semilla", async () => {
    restore = stubImage("load");
    const { container } = render(<UserAvatar user={{ id: 3, avatarSeed: null }} initials="AG" />);
    await waitFor(() => expect(container.querySelector("img")?.getAttribute("src")).toBe(avatarDataUri("3")));
  });

  it("sin id ni semilla muestra solo las iniciales", () => {
    const { container } = render(<UserAvatar user={{}} initials="AG" />);
    expect(screen.getByText("AG")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
  });

  it("si la imagen falla al cargar, quedan las iniciales", async () => {
    restore = stubImage("error");
    const { container } = render(<UserAvatar user={{ id: 3 }} initials="AG" />);
    expect(await screen.findByText("AG")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
  });
});

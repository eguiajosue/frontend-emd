import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UserAvatar } from "./user-avatar";

/** jsdom no carga imágenes: simulamos un navegador que ya la tiene lista. */
function stubImageLoad() {
  vi.stubGlobal(
    "Image",
    class {
      complete = true;
      naturalWidth = 1;
      referrerPolicy = "";
      crossOrigin: string | null = null;
      src = "";
      addEventListener() {}
      removeEventListener() {}
    }
  );
}

describe("UserAvatar", () => {
  beforeEach(stubImageLoad);
  afterEach(() => vi.unstubAllGlobals());

  it("muestra el blobatar generado a partir del username", async () => {
    const { container } = render(<UserAvatar seed="ana">AN</UserAvatar>);
    await waitFor(() => expect(container.querySelector("img")).not.toBeNull());
    const src = container.querySelector("img")!.getAttribute("src")!;
    expect(src.startsWith("data:image/svg+xml")).toBe(true);
  });

  it("el mismo username da siempre el mismo blobatar y otro da uno distinto", async () => {
    const srcOf = async (seed: string) => {
      const { container, unmount } = render(<UserAvatar seed={seed}>X</UserAvatar>);
      await waitFor(() => expect(container.querySelector("img")).not.toBeNull());
      const src = container.querySelector("img")!.getAttribute("src");
      unmount();
      return src;
    };
    expect(await srcOf("ana")).toBe(await srcOf("ana"));
    expect(await srcOf("ana")).not.toBe(await srcOf("beto"));
  });

  it("sin semilla muestra sólo las iniciales", () => {
    const { container } = render(<UserAvatar seed="">AN</UserAvatar>);
    expect(screen.getByText("AN")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
  });
});

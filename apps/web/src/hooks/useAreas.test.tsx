import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Area } from "@/types";
import { DEFAULT_AREAS, getAreaCatalog, resetAreaCatalog } from "@emd/business/src/areas";
import { AreaCatalogSync, useAreaOptions } from "./useAreas";

const request = vi.fn();
vi.mock("@/lib/api", () => ({ request: (...args: unknown[]) => request(...args) }));
vi.mock("@/hooks/useEntity", () => ({ useAuthToken: () => "t", CATALOG_STALE_TIME: 0 }));

const impresion3d: Area = {
  ...DEFAULT_AREAS[0],
  id: 7,
  slug: "impresion-3d",
  name: "Impresión 3D",
  icon: "Box",
  color: "#7c3aed",
  sortOrder: 70,
};

function Options() {
  const options = useAreaOptions("production");
  return <p>{options.map((o) => o.label).join(" | ")}</p>;
}

function renderSync() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AreaCatalogSync />
      <Options />
    </QueryClientProvider>
  );
}

afterEach(() => {
  resetAreaCatalog();
  localStorage.clear();
  request.mockReset();
});

describe("AreaCatalogSync", () => {
  it("trae el catálogo, lo guarda y las pantallas ven el área nueva", async () => {
    request.mockResolvedValue([...DEFAULT_AREAS, impresion3d]);
    const { container } = renderSync();

    expect(await screen.findByText(/Impresión 3D/)).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith("areas", { token: "t" });
    expect(getAreaCatalog().map((a) => a.slug)).toContain("impresion-3d");
    expect(container.querySelector("style")?.textContent).toContain('[data-area="impresion-3d"]');
    expect(JSON.parse(localStorage.getItem("emd_area_catalog") ?? "[]")).toHaveLength(7);
  });

  it("mientras llega la respuesta usa el último catálogo guardado", async () => {
    localStorage.setItem("emd_area_catalog", JSON.stringify([...DEFAULT_AREAS, impresion3d]));
    request.mockReturnValue(new Promise(() => {}));
    renderSync();

    await waitFor(() => expect(screen.getByText(/Impresión 3D/)).toBeInTheDocument());
  });

  it("si el backend falla se queda con las seis de siempre", async () => {
    request.mockRejectedValue(new Error("caído"));
    renderSync();

    await waitFor(() => expect(request).toHaveBeenCalled());
    expect(screen.getByText("Taller | DTF | Bordado | Láser | Impresiones")).toBeInTheDocument();
  });
});

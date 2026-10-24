"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Area } from "@emd/types";
import {
  DEFAULT_AREAS,
  getAreaCatalog,
  setAreaCatalog,
  subscribeAreaCatalog,
} from "@emd/business/src/areas";
import { request } from "@/lib/api";
import { ENDPOINTS, queryKeys } from "@/lib/queryKeys";
import { areaOptions, areaToneCss, productionAreaOptions } from "@/lib/areas";
import { CATALOG_STALE_TIME, useAuthToken } from "@/hooks/useEntity";

/** Copia local del último catálogo, para no arrancar con el de fábrica en cada visita. */
const AREA_CATALOG_STORAGE_KEY = "emd_area_catalog";

function readCachedCatalog(): Area[] | null {
  try {
    const raw = localStorage.getItem(AREA_CATALOG_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Area[]) : null;
  } catch {
    return null;
  }
}

function writeCachedCatalog(areas: Area[]) {
  try {
    localStorage.setItem(AREA_CATALOG_STORAGE_KEY, JSON.stringify(areas));
  } catch {
    // Sin acceso a localStorage: sólo no se cachea.
  }
}

/**
 * Catálogo de áreas actual (activas y desactivadas). Se vuelve a renderizar
 * cuando llega el catálogo del backend o cambia.
 */
export function useAreaCatalog(): readonly Area[] {
  return useSyncExternalStore(subscribeAreaCatalog, getAreaCatalog, () => DEFAULT_AREAS);
}

/** Opciones de selector: todas las áreas activas, o sólo las de producción. */
export function useAreaOptions(kind: "all" | "production" = "all") {
  const catalog = useAreaCatalog();
  // `catalog` cambia de referencia sólo cuando cambia el catálogo.
  return useMemo(
    () => (kind === "production" ? productionAreaOptions() : areaOptions()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catalog, kind]
  );
}

/**
 * Trae `GET /areas` con la sesión iniciada, lo vuelca al catálogo compartido
 * e inyecta los colores de `data-area` de cada área. Va una sola vez, en
 * `Providers`.
 */
export function AreaCatalogSync() {
  const token = useAuthToken();
  const catalog = useAreaCatalog();

  // El catálogo guardado se aplica después de montar: el HTML del servidor
  // siempre sale con el de fábrica y no hay diferencias al hidratar.
  useEffect(() => {
    setAreaCatalog(readCachedCatalog());
  }, []);

  const { data } = useQuery<Area[]>({
    queryKey: queryKeys.all("areas"),
    enabled: Boolean(token),
    staleTime: CATALOG_STALE_TIME,
    meta: { silentError: true },
    queryFn: () => request<Area[]>(ENDPOINTS.areas, { token }),
  });

  useEffect(() => {
    if (!data || data.length === 0) return;
    setAreaCatalog(data);
    writeCachedCatalog(data);
  }, [data]);

  const css = useMemo(() => areaToneCss(catalog), [catalog]);
  return <style data-area-tones="">{css}</style>;
}

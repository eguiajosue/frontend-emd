"use client";

import { useCallback, useEffect, useState } from "react";
import { AREA_OPTIONS } from "@/lib/areas";
import type { CalendarEventCategory } from "@/types";

export type CategoryFilter = "todos" | CalendarEventCategory;
export type AreaFilter = "todas" | (typeof AREA_OPTIONS)[number]["value"];

const CATEGORY_FILTER_KEY = "calendar-category-filter";
const AREA_FILTER_KEY = "calendar-area-filter";
const TASKS_PANEL_KEY = "calendar-tasks-panel-open";

const VALID_CATEGORIES: CategoryFilter[] = [
  "todos",
  "instalacion",
  "visita",
  "entrega",
  "junta",
  "otro",
];

const VALID_AREAS: AreaFilter[] = ["todas", ...AREA_OPTIONS.map((o) => o.value)];

function isCategoryFilter(value: string | null): value is CategoryFilter {
  return value !== null && (VALID_CATEGORIES as string[]).includes(value);
}

function isAreaFilter(value: string | null): value is AreaFilter {
  return value !== null && (VALID_AREAS as string[]).includes(value);
}

/**
 * Filtros de categoría/área y estado del panel de tareas del calendario: se
 * recuerdan entre visitas (mismo patrón que useDensity), no requieren
 * backend. `mounted` evita un flash de "Todos"/"Todas" antes de leer
 * localStorage.
 */
export function useCalendarPrefs() {
  const [categoryFilter, setCategoryFilterState] = useState<CategoryFilter>("todos");
  const [areaFilter, setAreaFilterState] = useState<AreaFilter>("todas");
  const [tasksPanelOpen, setTasksPanelOpenState] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const storedCategory = localStorage.getItem(CATEGORY_FILTER_KEY);
      if (isCategoryFilter(storedCategory)) setCategoryFilterState(storedCategory);
      const storedArea = localStorage.getItem(AREA_FILTER_KEY);
      if (isAreaFilter(storedArea)) setAreaFilterState(storedArea);
      const storedPanel = localStorage.getItem(TASKS_PANEL_KEY);
      if (storedPanel !== null) setTasksPanelOpenState(storedPanel === "true");
    } catch {
      // Sin acceso a localStorage: se queda en los valores por defecto.
    }
  }, []);

  const setCategoryFilter = useCallback((next: CategoryFilter) => {
    setCategoryFilterState(next);
    try {
      localStorage.setItem(CATEGORY_FILTER_KEY, next);
    } catch {
      // No pasa nada si no se puede persistir.
    }
  }, []);

  const setAreaFilter = useCallback((next: AreaFilter) => {
    setAreaFilterState(next);
    try {
      localStorage.setItem(AREA_FILTER_KEY, next);
    } catch {
      // No pasa nada si no se puede persistir.
    }
  }, []);

  const setTasksPanelOpen = useCallback((next: boolean) => {
    setTasksPanelOpenState(next);
    try {
      localStorage.setItem(TASKS_PANEL_KEY, String(next));
    } catch {
      // No pasa nada si no se puede persistir.
    }
  }, []);

  return {
    categoryFilter,
    setCategoryFilter,
    areaFilter,
    setAreaFilter,
    tasksPanelOpen,
    setTasksPanelOpen,
    mounted,
  };
}

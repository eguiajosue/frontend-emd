"use client";

import { useCallback, useEffect, useState } from "react";
import type { CalendarEventCategory } from "@/types";

export type CategoryFilter = "todos" | CalendarEventCategory;

const CATEGORY_FILTER_KEY = "calendar-category-filter";
const TASKS_PANEL_KEY = "calendar-tasks-panel-open";

const VALID_CATEGORIES: CategoryFilter[] = [
  "todos",
  "instalacion",
  "visita",
  "entrega",
  "junta",
  "otro",
];

function isCategoryFilter(value: string | null): value is CategoryFilter {
  return value !== null && (VALID_CATEGORIES as string[]).includes(value);
}

/**
 * Filtro de categoría y estado del panel de tareas del calendario: se
 * recuerdan entre visitas (mismo patrón que useDensity), no requieren
 * backend. `mounted` evita un flash de "Todos" antes de leer localStorage.
 */
export function useCalendarPrefs() {
  const [categoryFilter, setCategoryFilterState] = useState<CategoryFilter>("todos");
  const [tasksPanelOpen, setTasksPanelOpenState] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const storedCategory = localStorage.getItem(CATEGORY_FILTER_KEY);
      if (isCategoryFilter(storedCategory)) setCategoryFilterState(storedCategory);
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

  const setTasksPanelOpen = useCallback((next: boolean) => {
    setTasksPanelOpenState(next);
    try {
      localStorage.setItem(TASKS_PANEL_KEY, String(next));
    } catch {
      // No pasa nada si no se puede persistir.
    }
  }, []);

  return { categoryFilter, setCategoryFilter, tasksPanelOpen, setTasksPanelOpen, mounted };
}

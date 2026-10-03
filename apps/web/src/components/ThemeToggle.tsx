"use client";

import { useEffect, useState } from "react";
import type { MouseEvent } from "react";
import { Moon, Sun } from "lucide-react";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { runInkSplashTransition } from "@/lib/themeTransition";

/**
 * Toggle de tema claro/oscuro. next-themes ya lo persiste en localStorage;
 * además se guarda como preferencia del usuario en el backend para que la
 * cuenta mantenga el mismo tema en cualquier navegador.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { updatePreferences } = useUserPreferences();
  const [mounted, setMounted] = useState(false);

  // Evita mismatch de hidratación: el tema real sólo se conoce en el cliente.
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  const handleToggle = (e: MouseEvent<HTMLButtonElement>) => {
    const next = isDark ? "light" : "dark";
    const applyChange = () => {
      setTheme(next);
      updatePreferences({ themePreference: next });
    };
    runInkSplashTransition(applyChange, { x: e.clientX, y: e.clientY });
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      onClick={handleToggle}
      className="shrink-0"
    >
      {mounted ? (
        isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4 opacity-0" />
      )}
    </Button>
  );
}

/**
 * Sol / luna apilados (segmento superior del riel de escritorio): las dos
 * opciones a la vista, la activa marcada, en vez de un único botón que
 * alterna sin decir en qué tema estás.
 */
export function ThemeRailSwitch() {
  const { resolvedTheme, setTheme } = useTheme();
  const { updatePreferences } = useUserPreferences();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const current = mounted ? (resolvedTheme === "dark" ? "dark" : "light") : null;

  const choose = (next: "light" | "dark", e: MouseEvent<HTMLButtonElement>) => {
    if (next === current) return;
    runInkSplashTransition(
      () => {
        setTheme(next);
        updatePreferences({ themePreference: next });
      },
      { x: e.clientX, y: e.clientY }
    );
  };

  return (
    <div role="radiogroup" aria-label="Tema" className="flex flex-col items-center gap-1">
      {(
        [
          { value: "light", label: "Modo claro", Icon: Sun },
          { value: "dark", label: "Modo oscuro", Icon: Moon },
        ] as const
      ).map(({ value, label, Icon }) => {
        const active = current === value;
        return (
          <SimpleTooltip key={value} label={label} side="right">
            <Button
              variant="ghost"
              size="icon"
              role="radio"
              aria-checked={active}
              aria-label={label}
              onClick={(e) => choose(value, e)}
              className={cn(
                "h-10 w-10 text-muted-foreground",
                active && "bg-muted text-foreground ring-1 ring-border"
              )}
            >
              <Icon className="!size-[1.15rem]" />
            </Button>
          </SimpleTooltip>
        );
      })}
    </div>
  );
}

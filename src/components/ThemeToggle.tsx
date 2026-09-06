"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useUserPreferences } from "@/hooks/useUserPreferences";

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

  const handleToggle = () => {
    const next = isDark ? "light" : "dark";
    setTheme(next);
    updatePreferences({ themePreference: next });
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

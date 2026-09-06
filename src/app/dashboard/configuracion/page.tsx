"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Check, Laptop, Moon, Sun } from "lucide-react";
import Title from "@/components/Title";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { useAccentColor } from "@/hooks/useAccentColor";
import { ACCENT_OPTIONS } from "@/lib/accent";
import { DEFAULT_LANGUAGE, LANGUAGE_OPTIONS, LANGUAGE_STORAGE_KEY } from "@/lib/language";
import { useEntityList, useEntityMutations } from "@/hooks/useEntity";
import { getErrorMessage } from "@/lib/api";

/** Roles operativos de producción, con su etiqueta legible. */
const OPERATIONAL_ROLE_LABELS: { role: string; label: string }[] = [
  { role: "taller", label: "Taller" },
  { role: "dtf", label: "DTF" },
  { role: "bordado", label: "Bordado" },
  { role: "diseno", label: "Diseño" },
  { role: "laser", label: "Láser" },
  { role: "impresiones", label: "Impresiones" },
];

interface AreaVisibility {
  role: string;
  generalViewEnabled: boolean;
}

const THEME_OPTIONS = [
  { id: "light", label: "Claro", icon: Sun },
  { id: "dark", label: "Oscuro", icon: Moon },
  { id: "system", label: "Sistema", icon: Laptop },
];

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const { accent, setAccent, mounted } = useAccentColor();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Apariencia</CardTitle>
        <CardDescription>Personalizá cómo se ve la app para vos.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium">Tema</p>
          <div className="flex flex-wrap gap-2">
            {THEME_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = mounted && theme === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTheme(opt.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                    active
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-input hover:bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Color de acento</p>
          <p className="text-xs text-muted-foreground">
            Cambia el color principal usado en botones, enlaces y resaltados.
          </p>
          <div className="flex flex-wrap gap-3">
            {ACCENT_OPTIONS.map((opt) => {
              const active = mounted && accent === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  title={opt.label}
                  aria-label={opt.label}
                  onClick={() => setAccent(opt.id)}
                  className={cn(
                    "relative flex h-9 w-9 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-shadow",
                    active ? "ring-2 ring-foreground" : "hover:ring-2 hover:ring-border"
                  )}
                  style={{ backgroundColor: `hsl(${opt.previewHsl})` }}
                >
                  {active && <Check className="h-4 w-4 text-white drop-shadow" />}
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LanguageSection() {
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (stored) setLanguage(stored);
    } catch {
      // Sin acceso a localStorage: se queda en español.
    }
  }, []);

  const handleSelect = (id: string, available: boolean) => {
    if (!available) {
      toast.info("La traducción completa estará disponible próximamente.");
      return;
    }
    setLanguage(id);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, id);
    } catch {
      // No pasa nada si no se puede persistir.
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Idioma</CardTitle>
        <CardDescription>
          Elegí el idioma de la interfaz. Por ahora sólo español está disponible.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {LANGUAGE_OPTIONS.map((opt) => {
          const active = mounted && language === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleSelect(opt.id, opt.available)}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                active
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-input hover:bg-muted",
                !opt.available && "opacity-60"
              )}
            >
              {opt.label}
              {!opt.available && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Próximamente
                </span>
              )}
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

function AreaVisibilitySection() {
  const { data: rows, isPending, isError } = useEntityList<AreaVisibility>("areaVisibility");
  const { update } = useEntityMutations<AreaVisibility, { generalViewEnabled: boolean }>(
    "areaVisibility"
  );
  const [savingRole, setSavingRole] = useState<string | null>(null);

  const rowsByRole = new Map(rows.map((r) => [r.role, r]));

  const handleToggle = async (role: string, next: boolean) => {
    setSavingRole(role);
    try {
      await update(role, { generalViewEnabled: next });
      toast.success(
        `Visibilidad de "${OPERATIONAL_ROLE_LABELS.find((r) => r.role === role)?.label ?? role}" actualizada.`
      );
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo actualizar la visibilidad del área."));
    } finally {
      setSavingRole(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Visibilidad por área</CardTitle>
        <CardDescription>
          Cuando está activado, todos los usuarios de esa área ven todos los pedidos
          asignados a esa etapa. Cuando está desactivado, cada usuario sólo ve los
          pedidos que le fueron asignados específicamente a él (los pedidos sin
          asignar siguen siendo visibles para todos).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="space-y-3">
            {OPERATIONAL_ROLE_LABELS.map((r) => (
              <Skeleton key={r.role} className="h-10 w-full" />
            ))}
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">
            No se pudo cargar la configuración de visibilidad por área.
          </p>
        ) : (
          <div className="divide-y">
            {OPERATIONAL_ROLE_LABELS.map(({ role, label }) => {
              const row = rowsByRole.get(role);
              const enabled = row?.generalViewEnabled ?? true;
              return (
                <div key={role} className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium">{label}</span>
                  <Switch
                    checked={enabled}
                    disabled={savingRole === role}
                    onCheckedChange={(checked) => handleToggle(role, checked)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ConfiguracionPage() {
  const { isAdmin, roles } = usePermissions();
  const canManageAreaVisibility = isAdmin || roles.includes("recepcion");

  return (
    <div className="space-y-6">
      <Title title="Configuración" />
      <div className="grid gap-6 lg:max-w-2xl">
        <AppearanceSection />
        <LanguageSection />
        {canManageAreaVisibility && <AreaVisibilitySection />}
      </div>
    </div>
  );
}

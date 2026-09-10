"use client";

import { useEffect, useState, type ComponentType } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  AlertTriangle,
  AtSign,
  BellOff,
  BellRing,
  Check,
  Clock,
  Factory,
  Laptop,
  Loader2,
  Moon,
  Sun,
  Volume2,
  VolumeX,
} from "lucide-react";
import Title from "@/components/Title";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useDensity } from "@/hooks/useDensity";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useSoundPreference } from "@/hooks/useSoundPreference";
import { useAuthToken } from "@/hooks/useEntity";
import { playSuccessSound } from "@/lib/sound";
import { ACCENT_OPTIONS, isHexColor } from "@/lib/accent";
import { DEFAULT_LANGUAGE, LANGUAGE_OPTIONS, LANGUAGE_STORAGE_KEY } from "@/lib/language";
import { useEntityList, useEntityMutations } from "@/hooks/useEntity";
import { useAppSettings, useUpdateAppSettings } from "@/hooks/useSettings";
import { getErrorMessage } from "@/lib/api";
import {
  isIOSInstallRequired,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";

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
  const { updatePreferences } = useUserPreferences();

  const handleThemeSelect = (id: string) => {
    setTheme(id);
    updatePreferences({ themePreference: id });
  };

  const handleAccentSelect = (id: string) => {
    setAccent(id);
    updatePreferences({ accentColor: id });
  };

  const handleCustomColor = (hex: string) => {
    if (!isHexColor(hex)) return;
    setAccent(hex);
    updatePreferences({ accentColor: hex });
  };

  const isCustomAccent = mounted && isHexColor(accent);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Apariencia</CardTitle>
        <CardDescription>Personalizar cómo se ve la app.</CardDescription>
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
                  onClick={() => handleThemeSelect(opt.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors active:scale-[0.97]",
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
          <div className="flex flex-wrap items-center gap-3">
            {ACCENT_OPTIONS.map((opt) => {
              const active = mounted && accent === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  title={opt.label}
                  aria-label={opt.label}
                  onClick={() => handleAccentSelect(opt.id)}
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

            <label
              title="Color personalizado"
              aria-label="Elegir color de acento personalizado"
              className={cn(
                "relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-dashed ring-offset-2 ring-offset-background transition-shadow",
                isCustomAccent
                  ? "ring-2 ring-foreground border-solid"
                  : "border-muted-foreground/40 hover:ring-2 hover:ring-border"
              )}
              style={isCustomAccent ? { backgroundColor: accent } : undefined}
            >
              {isCustomAccent ? (
                <Check className="h-4 w-4 text-white drop-shadow" />
              ) : (
                <span className="text-base leading-none">+</span>
              )}
              <input
                type="color"
                value={isCustomAccent ? accent : "#000000"}
                onChange={(e) => handleCustomColor(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LanguageSection() {
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [mounted, setMounted] = useState(false);
  const { updatePreferences } = useUserPreferences();

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
    updatePreferences({ languagePreference: id });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Idioma</CardTitle>
        <CardDescription>
          Idioma de la interfaz. Por ahora sólo español está disponible.
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
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors active:scale-[0.97]",
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

function DensitySection() {
  const { density, setDensity, mounted } = useDensity();
  const { updatePreferences } = useUserPreferences();

  const handleToggle = (checked: boolean) => {
    const next = checked ? "compact" : "comfortable";
    setDensity(next);
    updatePreferences({ density: next });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vista compacta</CardTitle>
        <CardDescription>
          Reduce el espaciado de las tarjetas y listas de pedidos para ver más
          contenido en pantalla.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Usar vista compacta</span>
          <Switch checked={mounted && density === "compact"} onCheckedChange={handleToggle} />
        </div>
      </CardContent>
    </Card>
  );
}

function SoundSection() {
  const { soundEnabled, setSoundEnabled, mounted } = useSoundPreference();

  const handleToggle = (checked: boolean) => {
    setSoundEnabled(checked);
    // Confirmación audible inmediata sólo cuando se está activando: es la
    // forma más directa de mostrar causalidad ("esto es lo que vas a oír").
    if (checked) playSuccessSound();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sonido</CardTitle>
        <CardDescription>
          Un tono breve al llegar un pedido nuevo o asignado, y otro más
          sutil al guardar cambios. Se puede silenciar en cualquier momento.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-medium">
            {mounted && soundEnabled ? (
              <Volume2 className="h-4 w-4 text-muted-foreground" />
            ) : (
              <VolumeX className="h-4 w-4 text-muted-foreground" />
            )}
            Sonido de notificaciones
          </span>
          <Switch checked={mounted && soundEnabled} onCheckedChange={handleToggle} />
        </div>
      </CardContent>
    </Card>
  );
}

/** Fila de un toggle individual de notificaciones, deshabilitada visualmente en modo silencio. */
function NotificationToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 py-3 transition-opacity",
        disabled && "opacity-40"
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium leading-none">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function NotificationsSection() {
  const { preferences, isLoading, updatePreferences } = useUserPreferences();
  const token = useAuthToken();
  const [pushBusy, setPushBusy] = useState(false);

  const muted = preferences?.notificationsMuted ?? false;
  const mentionsOnly = preferences?.notifyMentionsOnly ?? false;
  const productionUpdates = preferences?.notifyProductionUpdates ?? true;
  const criticalAlerts = preferences?.notifyCriticalAlerts ?? true;

  const handleMuteToggle = async (checked: boolean) => {
    await updatePreferences({ notificationsMuted: checked });
    if (checked) {
      // Silenciar todo también corta el push real: sin esto el navegador
      // seguiría recibiendo notificaciones aunque la app las ignore.
      await unsubscribeFromPush(token);
    }
  };

  const handleEnablePush = async () => {
    if (!isPushSupported()) {
      toast.error("Este navegador no soporta notificaciones push.");
      return;
    }
    if (isIOSInstallRequired()) {
      toast.error(
        "En iPhone/iPad, primero agregá EMD a la pantalla de inicio (compartir → Agregar a inicio) para poder activar el push."
      );
      return;
    }
    setPushBusy(true);
    try {
      const subscription = await subscribeToPush(token);
      if (!subscription) {
        toast.error(
          "No se pudo activar el push. Revisá los permisos de notificaciones del navegador."
        );
        return;
      }
      // Activar push mientras el modo silencio está prendido sería
      // contradictorio: el usuario lo está pidiendo, así que también
      // reactivamos las notificaciones.
      if (muted) {
        await updatePreferences({ notificationsMuted: false });
      }
      playSuccessSound();
      toast.success("Notificaciones push activadas en este dispositivo.");
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo activar el push."));
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Notificaciones</CardTitle>
            <CardDescription>
              Qué te avisa EMD y cómo, en la app y por push.
            </CardDescription>
          </div>
          <span
            aria-hidden
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
              muted ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
            )}
          >
            {muted ? <BellOff className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/40 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Modo silencio</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Corta todas las notificaciones de la app y el push, como en WhatsApp.
                </p>
              </div>
              <Switch checked={muted} onCheckedChange={handleMuteToggle} />
            </div>

            <div className="divide-y">
              <NotificationToggleRow
                icon={AtSign}
                label="Sólo menciones directas"
                description="Avisar únicamente cuando te mencionen a vos. (Próximamente: el chat todavía no tiene @menciones.)"
                checked={mentionsOnly}
                disabled={muted}
                onCheckedChange={(checked) => updatePreferences({ notifyMentionsOnly: checked })}
              />
              <NotificationToggleRow
                icon={Factory}
                label="Actualizaciones de producción"
                description="Pedidos asignados, cambios de estado y novedades de área."
                checked={productionUpdates}
                disabled={muted}
                onCheckedChange={(checked) =>
                  updatePreferences({ notifyProductionUpdates: checked })
                }
              />
              <NotificationToggleRow
                icon={AlertTriangle}
                label="Alertas críticas"
                description="Avisos importantes que no encajan en producción."
                checked={criticalAlerts}
                disabled={muted}
                onCheckedChange={(checked) => updatePreferences({ notifyCriticalAlerts: checked })}
              />
            </div>

            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Activá el push para recibir avisos aunque tengas la pestaña cerrada.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleEnablePush}
                disabled={pushBusy}
                className="shrink-0"
              >
                {pushBusy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <BellRing className="mr-2 h-4 w-4" />
                )}
                Activar notificaciones push
              </Button>
            </div>
          </>
        )}
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
      playSuccessSound();
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

function DeliveredRetentionSection() {
  const { data: settings, isPending, deliveredRetentionHours } = useAppSettings();
  const { update, isUpdating } = useUpdateAppSettings();
  const [value, setValue] = useState<string>("");

  useEffect(() => {
    if (settings) setValue(String(settings.deliveredRetentionHours));
  }, [settings]);

  const handleSave = async () => {
    const hours = Number(value);
    if (!Number.isInteger(hours) || hours < 1 || hours > 720) {
      toast.error("Ingresar un número entero entre 1 y 720 horas.");
      return;
    }
    try {
      await update({ deliveredRetentionHours: hours });
      playSuccessSound();
      toast.success("Retención de pedidos entregados actualizada.");
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo actualizar la configuración."));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Retención de pedidos entregados</CardTitle>
        <CardDescription>
          Los pedidos entregados dejarán de mostrarse en el tablero después de
          este tiempo. Siguen disponibles en el Historial.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <Skeleton className="h-10 w-full max-w-xs" />
        ) : (
          <div className="flex items-end gap-3">
            <FormField
              label="Horas de retención"
              htmlFor="delivered-retention-hours"
              icon={Clock}
              hint="Entre 1 y 720 horas (30 días)."
              className="max-w-xs"
            >
              <Input
                id="delivered-retention-hours"
                type="number"
                min={1}
                max={720}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </FormField>
            <Button
              onClick={handleSave}
              disabled={
                isUpdating || value === "" || Number(value) === deliveredRetentionHours
              }
            >
              Guardar
            </Button>
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
        <DensitySection />
        <SoundSection />
        <NotificationsSection />
        <LanguageSection />
        {canManageAreaVisibility && <AreaVisibilitySection />}
        {isAdmin && <DeliveredRetentionSection />}
      </div>
    </div>
  );
}

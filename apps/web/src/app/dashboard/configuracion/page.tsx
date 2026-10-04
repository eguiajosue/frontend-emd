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
  Plus,
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useDensity } from "@/hooks/useDensity";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useSoundPreference } from "@/hooks/useSoundPreference";
import { useAuthToken } from "@/hooks/useEntity";
import { playSuccessSound } from "@/lib/sound";
import { ACCENT_OPTIONS, isHexColor } from "@/lib/accent";
import { DEFAULT_LANGUAGE, LANGUAGE_OPTIONS, LANGUAGE_STORAGE_KEY } from "@/lib/language";
import { CATALOG_STALE_TIME, useEntityList, useEntityMutations } from "@/hooks/useEntity";
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
      <CardContent className="space-y-7">
        <div className="space-y-2.5">
          <p className="text-sm font-medium" id="theme-label">Tema</p>
          <p className="text-xs text-muted-foreground" id="theme-hint">
            Por defecto la app usa el tema claro. &quot;Sistema&quot; sigue la configuración de tu dispositivo.
          </p>
          <ToggleGroup
            type="single"
            variant="segmented"
            value={mounted ? theme ?? "" : ""}
            onValueChange={(v) => v && handleThemeSelect(v)}
            aria-labelledby="theme-label"
            aria-describedby="theme-hint"
            className="w-fit flex-wrap justify-start rounded-full border bg-card p-1"
          >
            {THEME_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <ToggleGroupItem key={opt.id} value={opt.id} className="gap-2">
                  <Icon aria-hidden />
                  {opt.label}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        </div>

        <div className="space-y-2.5">
          <p className="text-sm font-medium" id="accent-label">Color de acento</p>
          <p className="text-xs text-muted-foreground">
            Cambia el color principal usado en botones, enlaces y resaltados.
          </p>
          <div className="flex flex-wrap items-center gap-3" role="group" aria-labelledby="accent-label">
            {ACCENT_OPTIONS.map((opt) => {
              const active = mounted && accent === opt.id;
              return (
                <SimpleTooltip key={opt.id} label={opt.label}>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={opt.label}
                    aria-pressed={active}
                    onClick={() => handleAccentSelect(opt.id)}
                    className={cn(
                      "relative h-9 w-9 rounded-full ring-offset-2 ring-offset-background transition-shadow hover:opacity-90",
                      active ? "ring-2 ring-foreground" : "hover:ring-2 hover:ring-border"
                    )}
                    style={{ backgroundColor: `hsl(${opt.previewHsl})` }}
                  >
                    {active && <Check className="h-4 w-4 text-white drop-shadow" />}
                  </Button>
                </SimpleTooltip>
              );
            })}

            <Label
              title="Color personalizado"
              className={cn(
                "relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-dashed ring-offset-2 ring-offset-background transition-shadow focus-within:ring-2 focus-within:ring-ring",
                isCustomAccent
                  ? "ring-2 ring-foreground border-solid"
                  : "border-muted-foreground/40 hover:ring-2 hover:ring-border"
              )}
              style={isCustomAccent ? { backgroundColor: accent } : undefined}
            >
              {isCustomAccent ? (
                <Check className="h-4 w-4 text-white drop-shadow" />
              ) : (
                <Plus className="h-4 w-4 text-muted-foreground" aria-hidden />
              )}
              {/* shadcn no trae selector de color: Input nativo type="color",
                  invisible sobre el círculo, abre el picker del sistema. */}
              <Input
                type="color"
                value={isCustomAccent ? accent : "#000000"}
                onChange={(e) => handleCustomColor(e.target.value)}
                aria-label="Elegir color de acento personalizado"
                className="absolute inset-0 h-full w-full cursor-pointer rounded-full border-0 p-0 opacity-0"
              />
            </Label>
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
      <CardContent>
        <ToggleGroup
          type="single"
          variant="segmented"
          value={mounted ? language : ""}
          onValueChange={(v) => {
            const opt = LANGUAGE_OPTIONS.find((o) => o.id === v);
            if (opt) handleSelect(opt.id, opt.available);
          }}
          aria-label="Idioma"
          className="w-fit flex-wrap justify-start rounded-full border bg-card p-1"
        >
          {LANGUAGE_OPTIONS.map((opt) => (
            <ToggleGroupItem
              key={opt.id}
              value={opt.id}
              className={cn("gap-2", !opt.available && "text-muted-foreground")}
            >
              {opt.label}
              {!opt.available && <Badge variant="muted">Próximamente</Badge>}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
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
        <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/60 px-4 py-3">
          <Label htmlFor="pref-compact">Usar vista compacta</Label>
          <Switch
            id="pref-compact"
            checked={mounted && density === "compact"}
            onCheckedChange={handleToggle}
          />
        </div>
      </CardContent>
    </Card>
  );
}

const TIME_FORMAT_OPTIONS: { id: "24h" | "12h"; label: string; example: string }[] = [
  { id: "24h", label: "24 horas", example: "14:30" },
  { id: "12h", label: "AM/PM", example: "2:30 p. m." },
];

function TimeFormatSection() {
  const { timeFormat, setTimeFormat, mounted } = useTimeFormat();
  const { updatePreferences } = useUserPreferences();

  const handleSelect = (id: "24h" | "12h") => {
    setTimeFormat(id);
    updatePreferences({ timeFormatPreference: id });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Formato de hora</CardTitle>
        <CardDescription>
          Cómo se muestran las horas en toda la app (calendario, pedidos, chat).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ToggleGroup
          type="single"
          variant="outline"
          value={mounted ? timeFormat : ""}
          onValueChange={(v) => v && handleSelect(v as "24h" | "12h")}
          aria-label="Formato de hora"
          className="flex-wrap justify-start"
        >
          {TIME_FORMAT_OPTIONS.map((opt) => (
            <ToggleGroupItem
              key={opt.id}
              value={opt.id}
              className="h-auto min-w-[8rem] flex-col items-start gap-0.5 rounded-xl px-4 py-2.5 data-[state=on]:border-foreground/60 data-[state=on]:bg-muted"
            >
              {opt.label}
              <span className="text-xs font-normal text-muted-foreground">{opt.example}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
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
        <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/60 px-4 py-3">
          <Label htmlFor="pref-sound" className="flex items-center gap-2">
            {mounted && soundEnabled ? (
              <Volume2 className="h-4 w-4 text-muted-foreground" />
            ) : (
              <VolumeX className="h-4 w-4 text-muted-foreground" />
            )}
            Sonido de notificaciones
          </Label>
          <Switch id="pref-sound" checked={mounted && soundEnabled} onCheckedChange={handleToggle} />
        </div>
      </CardContent>
    </Card>
  );
}

/** Fila de un toggle individual de notificaciones, deshabilitada visualmente en modo silencio. */
function NotificationToggleRow({
  id,
  icon: Icon,
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string;
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
          <Label htmlFor={id} className="leading-none">
            {label}
          </Label>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
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
        "En iPhone/iPad, primero agrega EMD a la pantalla de inicio (compartir → Agregar a inicio) para poder activar el push."
      );
      return;
    }
    setPushBusy(true);
    try {
      const subscription = await subscribeToPush(token);
      if (!subscription) {
        toast.error(
          "No se pudo activar el push. Revisa los permisos de notificaciones del navegador."
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
            <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/60 px-4 py-3">
              <div>
                <Label htmlFor="notify-muted">Modo silencio</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Corta todas las notificaciones de la app y el push, como en WhatsApp.
                </p>
              </div>
              <Switch id="notify-muted" checked={muted} onCheckedChange={handleMuteToggle} />
            </div>

            <div className="divide-y divide-border/60">
              <NotificationToggleRow
                id="notify-mentions"
                icon={AtSign}
                label="Sólo menciones directas"
                description="Avisar únicamente cuando te mencionen a ti. (Próximamente: el chat todavía no tiene @menciones.)"
                checked={mentionsOnly}
                disabled={muted}
                onCheckedChange={(checked) => updatePreferences({ notifyMentionsOnly: checked })}
              />
              <NotificationToggleRow
                id="notify-production"
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
                id="notify-critical"
                icon={AlertTriangle}
                label="Alertas críticas"
                description="Avisos importantes que no encajan en producción."
                checked={criticalAlerts}
                disabled={muted}
                onCheckedChange={(checked) => updatePreferences({ notifyCriticalAlerts: checked })}
              />
            </div>

            <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Activa el push para recibir avisos aunque tengas la pestaña cerrada.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleEnablePush}
                disabled={pushBusy}
                className="shrink-0"
              >
                {pushBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <BellRing className="h-4 w-4" />
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
  const { data: rows, isPending, isError } = useEntityList<AreaVisibility>("areaVisibility", {
    staleTime: CATALOG_STALE_TIME,
  });
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
          <div className="divide-y divide-border/60">
            {OPERATIONAL_ROLE_LABELS.map(({ role, label }) => {
              const row = rowsByRole.get(role);
              const enabled = row?.generalViewEnabled ?? true;
              return (
                <div key={role} className="flex items-center justify-between py-3">
                  <Label htmlFor={`area-visibility-${role}`}>{label}</Label>
                  <Switch
                    id={`area-visibility-${role}`}
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
      {/* Dos columnas en pantallas anchas (flujo tipo masonry con `columns`,
          así tarjetas de alto distinto no dejan huecos); una sola en el resto. */}
      <div className="max-w-6xl gap-6 xl:columns-2 [&>*]:mb-6 [&>*]:break-inside-avoid">
        <AppearanceSection />
        <DensitySection />
        <TimeFormatSection />
        <SoundSection />
        <NotificationsSection />
        <LanguageSection />
        {canManageAreaVisibility && <AreaVisibilitySection />}
        {isAdmin && <DeliveredRetentionSection />}
      </div>
    </div>
  );
}

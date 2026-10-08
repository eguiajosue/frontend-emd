"use client";

import { useEffect, useState } from "react";
import { BellRing, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { request } from "@/lib/api";
import { getBrowserPushSubscription, isIOSInstallRequired, isPushSupported } from "@/lib/push";
import type { PortalStageKey } from "@/lib/clientPortal";

/** Etapas en las que todavía tiene sentido pedir el aviso. */
const BEFORE_READY: PortalStageKey[] = ["diseno", "autorizacion", "produccion"];

const storageKey = (token: string) => `emd-portal-aviso:${token}`;

function readFlag(token: string) {
  try {
    return localStorage.getItem(storageKey(token)) === "1";
  } catch {
    return false;
  }
}
function writeFlag(token: string, on: boolean) {
  try {
    if (on) localStorage.setItem(storageKey(token), "1");
    else localStorage.removeItem(storageKey(token));
  } catch {
    /* sin almacenamiento: sólo se pierde el recordatorio visual */
  }
}

type State = "idle" | "working" | "on" | "denied" | "error";

/**
 * "Avísame cuando esté listo": suscribe este navegador al aviso del pedido
 * (Web Push desde el portal; el backend lo manda una vez, al quedar listo).
 * Se oculta donde el navegador no puede recibir push.
 */
export function ReadyNotice({ token, stage }: { token: string; stage: PortalStageKey }) {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<State>("idle");

  useEffect(() => {
    setSupported(isPushSupported() && !isIOSInstallRequired());
    if (readFlag(token) && typeof Notification !== "undefined" && Notification.permission === "granted") setState("on");
  }, [token]);

  if (!supported || !BEFORE_READY.includes(stage)) return null;

  const enable = async () => {
    setState("working");
    try {
      const sub = await getBrowserPushSubscription();
      if (!sub) {
        setState(typeof Notification !== "undefined" && Notification.permission === "denied" ? "denied" : "error");
        return;
      }
      await request(`portal/${token}/push`, {
        method: "POST",
        body: { endpoint: sub.endpoint, keys: { p256dh: sub.keys!.p256dh, auth: sub.keys!.auth } },
      });
      writeFlag(token, true);
      setState("on");
    } catch {
      setState("error");
    }
  };

  const disable = async () => {
    setState("working");
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      // No se da de baja el navegador entero (puede tener otros avisos): sólo este pedido.
      if (sub) await request(`portal/${token}/push`, { method: "DELETE", body: { endpoint: sub.endpoint } });
      writeFlag(token, false);
      setState("idle");
    } catch {
      setState("on");
    }
  };

  if (state === "on") {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-muted/60 px-4 py-3 text-sm" role="status">
        <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
        <span className="flex-1">Te avisaremos en este dispositivo cuando tu pedido esté listo.</span>
        <Button variant="link" size="sm" className="h-auto p-0 text-muted-foreground" onClick={() => void disable()}>
          No avisarme
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-dashed border-border px-4 py-3">
      <Button variant="outline" className="w-full gap-2 sm:w-auto" disabled={state === "working"} onClick={() => void enable()}>
        {state === "working" ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
        Avísame cuando esté listo
      </Button>
      {state === "denied" && (
        <p className="mt-2 text-xs text-muted-foreground">
          Tu navegador tiene bloqueadas las notificaciones de esta página. Actívalas en los ajustes del sitio y vuelve a intentarlo.
        </p>
      )}
      {state === "error" && <p className="mt-2 text-xs text-muted-foreground">No se pudo activar el aviso. Inténtalo de nuevo más tarde.</p>}
    </div>
  );
}

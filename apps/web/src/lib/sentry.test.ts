import { afterEach, describe, expect, it, vi } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";
import {
  buildSentryOptions,
  getSentryDsn,
  isSentryTunnelPath,
  parseSampleRate,
  scrubEvent,
  SENTRY_TUNNEL_ROUTE,
} from "./sentry";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("parseSampleRate", () => {
  it("por defecto 0 (sólo errores, sin trazas)", () => {
    expect(parseSampleRate(undefined)).toBe(0);
    expect(parseSampleRate("")).toBe(0);
    expect(parseSampleRate("  ")).toBe(0);
  });

  it("acepta valores entre 0 y 1", () => {
    expect(parseSampleRate("0.1")).toBe(0.1);
    expect(parseSampleRate("1")).toBe(1);
  });

  it("valores inválidos o fuera de rango cuentan como 0", () => {
    expect(parseSampleRate("abc")).toBe(0);
    expect(parseSampleRate("-0.5")).toBe(0);
    expect(parseSampleRate("2")).toBe(0);
    expect(parseSampleRate("Infinity")).toBe(0);
  });
});

describe("scrubEvent", () => {
  it("quita cookies, cabeceras de auth y el cuerpo de la request", () => {
    const event: ErrorEvent = {
      type: undefined,
      request: {
        url: "https://app.example.com/dashboard",
        method: "POST",
        cookies: { "next-auth.session-token": "secreto" },
        data: { password: "x" },
        headers: {
          Cookie: "next-auth.session-token=secreto",
          Authorization: "Bearer abc",
          "x-api-key": "k",
          "user-agent": "Mozilla",
          "content-type": "application/json",
        },
      },
    };

    const result = scrubEvent(event);

    expect(result.request?.cookies).toBeUndefined();
    expect(result.request?.data).toBeUndefined();
    expect(result.request?.headers).toEqual({
      "user-agent": "Mozilla",
      "content-type": "application/json",
    });
    expect(result.request?.url).toBe("https://app.example.com/dashboard");
  });

  it("no toca eventos sin request", () => {
    const event: ErrorEvent = { type: undefined, message: "hola" };
    expect(scrubEvent(event)).toEqual({ type: undefined, message: "hola" });
  });
});

describe("isSentryTunnelPath", () => {
  it("reconoce la ruta del túnel (con o sin barra final) y nada más", () => {
    expect(SENTRY_TUNNEL_ROUTE).toBe("/monitoring");
    expect(isSentryTunnelPath("/monitoring")).toBe(true);
    expect(isSentryTunnelPath("/monitoring/")).toBe(true);
    expect(isSentryTunnelPath("/monitoringx")).toBe(false);
    expect(isSentryTunnelPath("/dashboard/monitoring")).toBe(false);
  });
});

describe("getSentryDsn / buildSentryOptions", () => {
  it("sin DSN Sentry queda apagado", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    expect(getSentryDsn()).toBeUndefined();
  });

  it("con DSN arma opciones sin PII y sin trazas por defecto", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://abc@o0.ingest.sentry.io/0");
    vi.stubEnv("SENTRY_ENVIRONMENT", "");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE", "");
    const dsn = getSentryDsn();
    expect(dsn).toBe("https://abc@o0.ingest.sentry.io/0");

    const options = buildSentryOptions(dsn!);
    expect(options.sendDefaultPii).toBe(false);
    // Muestreo 0 = sin la clave: el SDK no crea spans.
    expect("tracesSampleRate" in options).toBe(false);
    expect(options.sendClientReports).toBe(false);
    expect("environment" in options).toBe(false);
    expect(options.beforeSend).toBe(scrubEvent);
    expect(options.beforeSendTransaction).toBe(scrubEvent);
  });

  it("toma entorno y muestreo de las variables", () => {
    vi.stubEnv("SENTRY_ENVIRONMENT", "preview");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE", "0.25");
    const options = buildSentryOptions("https://abc@o0.ingest.sentry.io/0");
    expect(options).toMatchObject({ environment: "preview", tracesSampleRate: 0.25 });
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, AuthFetchError } from "@emd/api-client";
import {
  classifyError,
  describeError,
  ERROR_CATALOG,
  getAppErrorMessage,
  getErrorMessage,
  getLoginErrorMessage,
  isTechnicalMessage,
  kindFromStatus,
  type ErrorKind,
} from "./errorMessages";

afterEach(() => vi.unstubAllGlobals());

describe("kindFromStatus", () => {
  it.each<[number, ErrorKind]>([
    [0, "network"],
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "notFound"],
    [408, "timeout"],
    [409, "conflict"],
    [410, "gone"],
    [413, "tooLarge"],
    [422, "validation"],
    [429, "rateLimited"],
    [500, "server"],
    [502, "server"],
    [503, "maintenance"],
    [504, "timeout"],
  ])("%i -> %s", (status, kind) => {
    expect(kindFromStatus(status)).toBe(kind);
  });
});

describe("classifyError", () => {
  it("AuthFetchError y 401 son sesión expirada", () => {
    expect(classifyError(new AuthFetchError("x", 401)).kind).toBe("unauthorized");
    expect(classifyError(new ApiError("x", 401)).kind).toBe("unauthorized");
  });

  it("status 0 sin red es offline; con red es network", () => {
    vi.stubGlobal("navigator", { onLine: false });
    expect(classifyError(new ApiError("Failed to fetch", 0)).kind).toBe("offline");
    vi.stubGlobal("navigator", { onLine: true });
    expect(classifyError(new ApiError("Failed to fetch", 0)).kind).toBe("network");
  });

  it("un TypeError de fetch es network y un AbortError es timeout", () => {
    vi.stubGlobal("navigator", { onLine: true });
    expect(classifyError(new TypeError("Failed to fetch")).kind).toBe("network");
    const abort = new Error("aborted");
    abort.name = "AbortError";
    expect(classifyError(abort).kind).toBe("timeout");
  });

  it("usa los códigos conocidos del backend por encima del status", () => {
    expect(classifyError(new ApiError("x", 500, { code: "P2002" })).kind).toBe("conflict");
  });

  it("lo desconocido es unknown", () => {
    vi.stubGlobal("navigator", { onLine: true });
    expect(classifyError("boom").kind).toBe("unknown");
    expect(classifyError(undefined).kind).toBe("unknown");
  });
});

describe("isTechnicalMessage", () => {
  it.each([
    "Failed to fetch",
    "NetworkError when attempting to fetch resource.",
    "Load failed",
    "ThrottlerException: Too Many Requests",
    "Error 500: Internal Server Error",
    "Unexpected token < in JSON",
    "email must be an email",
    "Error interno del servidor",
    "",
  ])("%j es técnico", (message) => {
    expect(isTechnicalMessage(message)).toBe(true);
  });

  it.each(["La plantilla no existe", "Ya existe un área con ese nombre", "Sin permisos para acceder a esta sección"])(
    "%j se puede mostrar",
    (message) => {
      expect(isTechnicalMessage(message)).toBe(false);
    },
  );
});

describe("getErrorMessage", () => {
  it("nunca muestra mensajes crudos de red", () => {
    vi.stubGlobal("navigator", { onLine: true });
    const text = getErrorMessage(new ApiError("Failed to fetch", 0));
    expect(text).toBe(ERROR_CATALOG.network.description);
    expect(text).not.toMatch(/fetch/i);
  });

  it("traduce el throttler en inglés", () => {
    expect(getErrorMessage(new ApiError("ThrottlerException: Too Many Requests", 429))).toBe(
      ERROR_CATALOG.rateLimited.description,
    );
  });

  it("conserva el mensaje específico del backend en español", () => {
    expect(getErrorMessage(new ApiError("Ya existe un área con ese nombre", 409))).toBe(
      "Ya existe un área con ese nombre",
    );
    expect(getErrorMessage(new ApiError("La plantilla no existe", 404), "No se pudo cargar")).toBe(
      "La plantilla no existe",
    );
  });

  it("usa el texto de contexto cuando el backend no aporta nada útil", () => {
    expect(getErrorMessage(new ApiError("Bad Request", 400), "No se pudo guardar el material.")).toBe(
      "No se pudo guardar el material.",
    );
    expect(getErrorMessage(new ApiError("Registro no encontrado", 404), "No se pudo abrir.")).toBe(
      "Registro no encontrado",
    );
  });

  it("5xx genérico del backend cae al catálogo; uno deliberado se conserva", () => {
    expect(getErrorMessage(new ApiError("Error interno del servidor", 500))).toBe(ERROR_CATALOG.server.description);
    expect(getErrorMessage(new ApiError("El servicio de correo no está configurado todavía", 500))).toBe(
      "El servicio de correo no está configurado todavía",
    );
  });

  it("413 y 403 tienen copia propia", () => {
    expect(getErrorMessage(new ApiError("Payload Too Large", 413))).toBe(ERROR_CATALOG.tooLarge.description);
    expect(getErrorMessage(new ApiError("Forbidden resource", 403))).toBe(
      "No tienes permiso para realizar esta acción.",
    );
  });

  it("un valor desconocido usa el fallback o el genérico", () => {
    vi.stubGlobal("navigator", { onLine: true });
    expect(getErrorMessage("boom", "No se pudo guardar.")).toBe("No se pudo guardar.");
    expect(getErrorMessage(null)).toBe(ERROR_CATALOG.unknown.description);
  });

  it("una sesión expirada se explica", () => {
    expect(getErrorMessage(new AuthFetchError("Sesión expirada", 401))).toMatch(/sesión expiró/i);
  });
});

describe("describeError", () => {
  it("devuelve título, descripción y acción del catálogo", () => {
    const info = describeError(new ApiError("Too Many Requests", 429));
    expect(info.kind).toBe("rateLimited");
    expect(info.title).toBe(ERROR_CATALOG.rateLimited.title);
    expect(info.action.type).toBe("wait");
    expect(info.retryable).toBe(true);
  });

  it("401 pide iniciar sesión y no es reintentable", () => {
    const info = describeError(new ApiError("Unauthorized", 401));
    expect(info.action).toEqual({ type: "login", label: "Iniciar sesión" });
    expect(info.retryable).toBe(false);
  });

  it("usa el mensaje del backend como descripción si es presentable", () => {
    expect(describeError(new ApiError("Sin acceso a esta notificación", 403)).description).toBe(
      "Sin acceso a esta notificación",
    );
  });

  it("todo el catálogo está en español y con acción", () => {
    for (const entry of Object.values(ERROR_CATALOG)) {
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.description).toMatch(/[a-záéíóú]/i);
      expect(entry.description).not.toMatch(/failed|error 5|exception/i);
    }
  });
});

describe("getAppErrorMessage", () => {
  it("respeta Error propios en español y filtra los técnicos", () => {
    vi.stubGlobal("navigator", { onLine: true });
    expect(getAppErrorMessage(new Error("El 3D no admite imágenes SVG"), "x")).toBe("El 3D no admite imágenes SVG");
    expect(getAppErrorMessage(new TypeError("Failed to fetch"), "No se pudo leer el diseño.")).toBe(
      ERROR_CATALOG.network.description,
    );
    expect(getAppErrorMessage(new Error("Unexpected token"), "No se pudo leer el diseño.")).toBe(
      "No se pudo leer el diseño.",
    );
  });
});

describe("getLoginErrorMessage", () => {
  it("traduce CredentialsSignin", () => {
    expect(getLoginErrorMessage("CredentialsSignin")).toMatch(/incorrectos/);
    expect(getLoginErrorMessage()).toMatch(/incorrectos/);
    expect(getLoginErrorMessage("Whatever")).toBe(ERROR_CATALOG.unknown.description);
  });
});

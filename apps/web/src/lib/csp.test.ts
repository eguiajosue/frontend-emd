import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, generateNonce, resolveConnectSrc } from "./csp";

function directive(csp: string, name: string): string | undefined {
  return csp.split("; ").find((part) => part.startsWith(`${name} `));
}

describe("buildContentSecurityPolicy", () => {
  it("en producción: nonce + strict-dynamic, sin unsafe-inline ni unsafe-eval en scripts", () => {
    const csp = buildContentSecurityPolicy({
      nonce: "abc123",
      isDev: false,
      backendUrl: "https://backend-emd.onrender.com",
    });
    expect(directive(csp, "script-src")).toBe("script-src 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(directive(csp, "script-src")).not.toContain("'unsafe-inline'");
  });

  it("en desarrollo agrega unsafe-eval (HMR de Next)", () => {
    const csp = buildContentSecurityPolicy({ nonce: "n", isDev: true, backendUrl: undefined });
    expect(directive(csp, "script-src")).toBe("script-src 'nonce-n' 'strict-dynamic' 'unsafe-eval'");
  });

  it("sin nonce (Service Worker) sólo permite scripts del propio origen", () => {
    const csp = buildContentSecurityPolicy({ isDev: false, backendUrl: undefined });
    expect(directive(csp, "script-src")).toBe("script-src 'self'");
  });

  it("conserva el resto de directivas", () => {
    const csp = buildContentSecurityPolicy({
      nonce: "n",
      isDev: false,
      backendUrl: "https://api.example.com/v1",
    });
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("img-src 'self' data: blob: https:");
    expect(csp).toContain("font-src 'self' data:");
    expect(csp).toContain("connect-src 'self' https://api.example.com wss://api.example.com");
    expect(csp).toContain("worker-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("object-src 'none'");
  });
});

describe("resolveConnectSrc", () => {
  it("usa ws: para un backend http", () => {
    expect(resolveConnectSrc("http://localhost:4010")).toBe(
      "connect-src 'self' http://localhost:4010 ws://localhost:4010"
    );
  });

  it("si la URL falta o es inválida cae al comportamiento abierto anterior", () => {
    expect(resolveConnectSrc(undefined)).toBe("connect-src 'self' https: wss: http: ws:");
    expect(resolveConnectSrc("ftp://x")).toBe("connect-src 'self' https: wss: http: ws:");
  });
});

describe("generateNonce", () => {
  it("genera nonces base64 distintos en cada llamada", () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});

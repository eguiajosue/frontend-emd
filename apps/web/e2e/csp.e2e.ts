import { expect, test } from "./helpers";

/**
 * CSP con nonce por request (src/middleware.ts + src/lib/csp.ts): cada
 * documento trae un nonce nuevo, sin `'unsafe-inline'` ni `'unsafe-eval'` en
 * scripts, y la página igual hidrata (el guardia de `helpers.ts` falla el test
 * si el navegador bloquea algo).
 */

function scriptSrc(csp: string | null): string {
  return (csp ?? "").split("; ").find((d) => d.startsWith("script-src ")) ?? "";
}

test("el login trae una CSP con nonce distinto en cada request y la página funciona", async ({ page }) => {
  const first = await page.goto("/login");
  const csp1 = first!.headers()["content-security-policy"] ?? null;
  expect(scriptSrc(csp1)).toMatch(/^script-src 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'$/);

  // Los scripts inline (Next + acento + next-themes) llevan el nonce de la cabecera.
  const nonce = /'nonce-([^']+)'/.exec(csp1!)![1];
  const inlineSinNonce = await page.evaluate(
    (expected) =>
      Array.from(document.querySelectorAll("script")).filter((s) => s.nonce !== expected).length,
    nonce,
  );
  expect(inlineSinNonce).toBe(0);

  // Hidratada: el formulario responde.
  await page.locator("#username").fill("recepcion1");
  await expect(page.locator("#username")).toHaveValue("recepcion1");

  const second = await page.goto("/login");
  const csp2 = second!.headers()["content-security-policy"] ?? null;
  expect(csp2).not.toBe(csp1);
});

test("el Service Worker recibe una CSP sin nonce, sólo con scripts del propio origen", async ({ request }) => {
  const res = await request.get("/sw.js");
  expect(res.ok()).toBe(true);
  expect(scriptSrc(res.headers()["content-security-policy"] ?? null)).toBe("script-src 'self'");
});

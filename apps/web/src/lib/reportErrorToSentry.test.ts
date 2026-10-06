import { afterEach, describe, expect, it, vi } from "vitest";

const captureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({ captureException }));

import { reportErrorToSentry } from "./reportErrorToSentry";

afterEach(() => {
  vi.unstubAllEnvs();
  captureException.mockReset();
});

describe("reportErrorToSentry", () => {
  it("sin DSN no carga el SDK ni reporta nada", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    reportErrorToSentry(new Error("x"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(captureException).not.toHaveBeenCalled();
  });

  it("con DSN reporta el error", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://abc@o0.ingest.sentry.io/0");
    const error = new Error("boom");
    reportErrorToSentry(error);
    await vi.waitFor(() => expect(captureException).toHaveBeenCalledWith(error));
  });
});

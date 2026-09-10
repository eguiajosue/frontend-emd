import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { OnboardingTour } from "./OnboardingTour";

const updatePreferences = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: "authenticated" }),
}));

vi.mock("@/lib/motion", () => ({
  useMotionPreset: () => ({ reduced: false }),
}));

vi.mock("@/hooks/useUserPreferences", () => ({
  useUserPreferences: () => ({
    preferences: { hasSeenOnboarding: false },
    updatePreferences,
  }),
}));

const useIsMobileMock = vi.fn();
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => useIsMobileMock(),
}));

describe("OnboardingTour", () => {
  let originalQuerySelector: typeof document.querySelector;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock document.querySelector to return a mock element for tour targets
    originalQuerySelector = document.querySelector;
    document.querySelector = vi.fn((selector: string) => {
      if (
        selector === '[data-tour="sidebar-nav"]' ||
        selector === '[data-tour="new-order-button"]' ||
        selector === '[data-tour="theme-toggle"]' ||
        selector === '[data-tour="help-link"]'
      ) {
        return {
          getBoundingClientRect: () => ({
            top: 100,
            left: 100,
            width: 50,
            height: 50,
            right: 150,
            bottom: 150,
            x: 100,
            y: 100,
            toJSON: () => ({}),
          }),
        } as any;
      }
      return originalQuerySelector.call(document, selector);
    });
  });

  afterEach(() => {
    document.querySelector = originalQuerySelector;
  });

  it("en móvil no se activa ni marca hasSeenOnboarding", async () => {
    useIsMobileMock.mockReturnValue(true);
    render(<OnboardingTour />);
    // El tour normalmente activa a los 400ms; esperamos más que eso.
    await new Promise((r) => setTimeout(r, 500));
    expect(updatePreferences).not.toHaveBeenCalled();
  });

  it("en escritorio sí se activa", async () => {
    useIsMobileMock.mockReturnValue(false);
    const { container } = render(<OnboardingTour />);
    await waitFor(
      () => {
        expect(container.querySelector(".fixed.inset-0")).toBeTruthy();
      },
      { timeout: 1000 }
    );
  });
});

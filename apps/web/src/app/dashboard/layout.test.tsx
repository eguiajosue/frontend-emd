import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Layout from "./layout";

const mocks = vi.hoisted(() => ({
  pathname: "/dashboard/orders",
  isBranch: false,
  replace: vi.fn(),
  pageMounted: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ replace: mocks.replace, push: vi.fn() }),
}));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ isBranch: mocks.isBranch }) }));
vi.mock("@/hooks/useSocket", async () => {
  const { createContext } = await import("react");
  return { useSocket: () => ({ current: null }), ChatSocketContext: createContext(null) };
});
vi.mock("@/hooks/useNotifications", () => ({ useUnreadNotificationsCount: () => ({ count: 0 }) }));
vi.mock("@/hooks/useNavPreferences", () => ({ useNavPreferences: () => ({ expanded: false, setExpanded: vi.fn() }) }));
vi.mock("@/lib/motion", () => ({
  useMotionPreset: () => ({
    routeTransition: { initial: false, animate: {}, exit: {}, transition: { duration: 0 } },
  }),
}));
vi.mock("@/components/AppHeaderNav", () => ({ useBreadcrumbs: () => [] }));
vi.mock("@/components/app-sidebar", () => ({
  AppSidebar: () => null,
  RAIL_OFFSET_COLLAPSED: "5.75rem",
  RAIL_OFFSET_EXPANDED: "16.5rem",
}));
vi.mock("@/components/MobileTabBar", () => ({ MobileTabBar: () => null }));
vi.mock("@/components/CommandPalette", () => ({ CommandPalette: () => null }));
vi.mock("@/components/KeyboardShortcuts", () => ({ KeyboardShortcuts: () => null }));
vi.mock("@/components/OnboardingTour", () => ({ OnboardingTour: () => null }));
vi.mock("@/components/AppTopBar", () => ({ AppTopBar: () => null }));

function Page() {
  mocks.pageMounted();
  return <p>contenido de la página</p>;
}

beforeEach(() => {
  mocks.pathname = "/dashboard/orders";
  mocks.isBranch = false;
  mocks.replace.mockReset();
  mocks.pageMounted.mockReset();
});

describe("dashboard layout - cuenta de sucursal", () => {
  it("en una ruta prohibida redirige a Mis pedidos y NO monta la página (sin consultas)", () => {
    mocks.isBranch = true;
    mocks.pathname = "/dashboard/clientes";
    render(
      <Layout>
        <Page />
      </Layout>
    );

    expect(mocks.replace).toHaveBeenCalledWith("/dashboard/orders");
    expect(mocks.pageMounted).not.toHaveBeenCalled();
    expect(screen.queryByText("contenido de la página")).not.toBeInTheDocument();
    expect(screen.getByTestId("branch-redirecting")).toBeInTheDocument();
  });

  it("en una ruta permitida muestra la página y no redirige", () => {
    mocks.isBranch = true;
    mocks.pathname = "/dashboard/mockups";
    render(
      <Layout>
        <Page />
      </Layout>
    );

    expect(mocks.replace).not.toHaveBeenCalled();
    expect(screen.getByText("contenido de la página")).toBeInTheDocument();
  });

  it("los demás roles ven cualquier ruta sin redirección", () => {
    mocks.pathname = "/dashboard/clientes";
    render(
      <Layout>
        <Page />
      </Layout>
    );

    expect(mocks.replace).not.toHaveBeenCalled();
    expect(screen.getByText("contenido de la página")).toBeInTheDocument();
  });
});

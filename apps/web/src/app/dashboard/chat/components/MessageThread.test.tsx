import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Socket } from "socket.io-client";
import { MessageThread } from "./MessageThread";
import { ChatSocketContext } from "@/hooks/useSocket";
import type { ChatConversation, ChatMember, ChatMessage } from "@/types";

// MessageThread renderiza <OrderPicker> (usa useOrders -> useSession +
// react-query), que necesita un SessionProvider y un QueryClient reales; el
// SessionProvider se mockea igual que en
// `apps/web/src/app/dashboard/chat/page.test.tsx`, y el QueryClient se provee
// con un wrapper mínimo (ver `renderThread` más abajo) para no depender de
// ninguno de los dos en este test.
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { id: "1" } } }),
}));

function renderThread(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

const conversation: ChatConversation = {
  id: 1,
  type: "direct",
  area: null,
  title: "Ana Gómez",
  otherUser: {
    id: 20,
    username: "ana",
    firstName: "Ana",
    lastName: "Gómez",
    isOnline: false,
    lastSeenAt: null,
  },
  lastMessageAt: "2026-01-01T10:00:00.000Z",
  lastMessage: null,
  unreadCount: 0,
  isMonitor: false,
};

function makeMember(overrides: Partial<ChatMember>): ChatMember {
  return {
    id: 20,
    username: "ana",
    firstName: "Ana",
    lastName: "Gómez",
    isMonitor: false,
    lastReadAt: null,
    deliveredAt: null,
    isOnline: false,
    lastSeenAt: null,
    ...overrides,
  };
}

function makeMessage(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: 1,
    conversationId: 1,
    body: "Hola",
    createdAt: "2026-01-01T10:00:00.000Z",
    senderId: 10, // el usuario actual
    ...overrides,
  } as ChatMessage;
}

describe("MessageThread - checks de mensajes propios", () => {
  it("muestra un solo check cuando nadie más recibió el mensaje todavía", () => {
    const message = makeMessage({ id: 1 });
    renderThread(
      <MessageThread
        conversation={conversation}
        messages={[message]}
        members={[makeMember({})]}
        isLoading={false}
        isSending={false}
        currentUserId={10}
        onSend={async () => {}}
      />
    );
    expect(screen.getByTestId("check-sent-1")).toBeInTheDocument();
    expect(screen.queryByTestId("check-delivered-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("check-read-1")).not.toBeInTheDocument();
  });

  it("muestra doble check gris cuando el otro miembro lo recibió pero no lo leyó", () => {
    const message = makeMessage({ id: 2, createdAt: "2026-01-01T10:00:00.000Z" });
    renderThread(
      <MessageThread
        conversation={conversation}
        messages={[message]}
        members={[
          makeMember({ deliveredAt: "2026-01-01T10:00:05.000Z", lastReadAt: null }),
        ]}
        isLoading={false}
        isSending={false}
        currentUserId={10}
        onSend={async () => {}}
      />
    );
    expect(screen.getByTestId("check-delivered-2")).toBeInTheDocument();
    expect(screen.queryByTestId("check-read-2")).not.toBeInTheDocument();
  });

  it("muestra doble check azul cuando el otro miembro ya lo leyó", () => {
    const message = makeMessage({ id: 3, createdAt: "2026-01-01T10:00:00.000Z" });
    renderThread(
      <MessageThread
        conversation={conversation}
        messages={[message]}
        members={[
          makeMember({
            deliveredAt: "2026-01-01T10:00:05.000Z",
            lastReadAt: "2026-01-01T10:00:10.000Z",
          }),
        ]}
        isLoading={false}
        isSending={false}
        currentUserId={10}
        onSend={async () => {}}
      />
    );
    expect(screen.getByTestId("check-read-3")).toBeInTheDocument();
  });

  it("ignora a los miembros monitor (isMonitor) para calcular el check", () => {
    const message = makeMessage({ id: 4, createdAt: "2026-01-01T10:00:00.000Z" });
    renderThread(
      <MessageThread
        conversation={conversation}
        messages={[message]}
        members={[
          // el único miembro real no leyó...
          makeMember({ id: 20, lastReadAt: null, deliveredAt: null }),
          // ...pero un admin monitor sí "leyó" el canal (no debe alcanzar para el check azul)
          makeMember({ id: 99, isMonitor: true, lastReadAt: "2026-01-01T10:00:10.000Z" }),
        ]}
        isLoading={false}
        isSending={false}
        currentUserId={10}
        onSend={async () => {}}
      />
    );
    expect(screen.queryByTestId("check-read-4")).not.toBeInTheDocument();
  });

  it("no muestra checks en mensajes ajenos", () => {
    const message = makeMessage({ id: 5, senderId: 20 });
    renderThread(
      <MessageThread
        conversation={conversation}
        messages={[message]}
        members={[makeMember({})]}
        isLoading={false}
        isSending={false}
        currentUserId={10}
        onSend={async () => {}}
      />
    );
    expect(screen.queryByTestId(/check-.*-5/)).not.toBeInTheDocument();
  });
});

describe("MessageThread - estado del header (presencia y escribiendo)", () => {
  it('muestra "en línea" cuando el otro miembro está online', () => {
    renderThread(
      <MessageThread
        conversation={conversation}
        messages={[]}
        members={[makeMember({ isOnline: true })]}
        isLoading={false}
        isSending={false}
        currentUserId={10}
        onSend={async () => {}}
      />
    );
    expect(screen.getByText(/en línea/i)).toBeInTheDocument();
  });

  it("muestra la última conexión cuando está offline y tiene lastSeenAt", () => {
    renderThread(
      <MessageThread
        conversation={conversation}
        messages={[]}
        members={[makeMember({ isOnline: false, lastSeenAt: "2026-01-01T09:00:00.000Z" })]}
        isLoading={false}
        isSending={false}
        currentUserId={10}
        onSend={async () => {}}
      />
    );
    expect(screen.getByText(/última vez/i)).toBeInTheDocument();
  });

  it("no muestra nada de presencia si nunca se conectó (lastSeenAt null)", () => {
    renderThread(
      <MessageThread
        conversation={conversation}
        messages={[]}
        members={[makeMember({ isOnline: false, lastSeenAt: null })]}
        isLoading={false}
        isSending={false}
        currentUserId={10}
        onSend={async () => {}}
      />
    );
    expect(screen.queryByText(/en línea/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/última vez/i)).not.toBeInTheDocument();
  });
});

describe("MessageThread - badge de presencia en el header", () => {
  it("muestra el punto verde sobre el avatar cuando el otro miembro está en línea", () => {
    renderThread(
      <MessageThread
        conversation={conversation}
        messages={[]}
        members={[makeMember({ isOnline: true })]}
        isLoading={false}
        isSending={false}
        currentUserId={10}
        onSend={async () => {}}
      />
    );
    expect(screen.getByTestId("presence-badge")).toBeInTheDocument();
  });

  it("no muestra el punto cuando el otro miembro está offline", () => {
    renderThread(
      <MessageThread
        conversation={conversation}
        messages={[]}
        members={[makeMember({ isOnline: false })]}
        isLoading={false}
        isSending={false}
        currentUserId={10}
        onSend={async () => {}}
      />
    );
    expect(screen.queryByTestId("presence-badge")).not.toBeInTheDocument();
  });

  it("no muestra el punto en canales de área", () => {
    const areaConversation: ChatConversation = {
      ...conversation,
      type: "area",
      area: "Diseño",
      title: "Diseño",
      otherUser: null,
    };
    renderThread(
      <MessageThread
        conversation={areaConversation}
        messages={[]}
        members={[makeMember({ isOnline: true, isMonitor: false })]}
        isLoading={false}
        isSending={false}
        currentUserId={10}
        onSend={async () => {}}
      />
    );
    expect(screen.queryByTestId("presence-badge")).not.toBeInTheDocument();
  });
});

describe("MessageThread - emite chatTyping al escribir", () => {
  it("emite chatTyping una sola vez al empezar a escribir, y chatStopTyping tras el timeout", () => {
    vi.useFakeTimers();
    try {
      const emit = vi.fn();
      const fakeSocket = { emit } as unknown as Socket;
      const fakeSocketRef = { current: fakeSocket };

      renderThread(
        <ChatSocketContext.Provider value={fakeSocketRef}>
          <MessageThread
            conversation={conversation}
            messages={[]}
            members={[makeMember({})]}
            isLoading={false}
            isSending={false}
            currentUserId={10}
            onSend={async () => {}}
          />
        </ChatSocketContext.Provider>
      );

      const textarea = screen.getByRole("textbox");
      // Simula el usuario tipeando letra por letra (dispara un onChange por
      // tecla, como en la vida real), sin depender de userEvent + fake
      // timers (combinación frágil).
      fireEvent.change(textarea, { target: { value: "h" } });
      fireEvent.change(textarea, { target: { value: "ho" } });
      fireEvent.change(textarea, { target: { value: "hol" } });
      fireEvent.change(textarea, { target: { value: "hola" } });

      expect(emit).toHaveBeenCalledWith("chatTyping", { conversationId: conversation.id });
      expect(emit).toHaveBeenCalledTimes(1); // no reemite en cada tecla

      vi.advanceTimersByTime(3000);
      expect(emit).toHaveBeenCalledWith("chatStopTyping", { conversationId: conversation.id });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("MessageThread - navegación mobile (volver a la lista)", () => {
  it("no muestra botón de volver si no se pasa onBack", () => {
    renderThread(
      <MessageThread
        conversation={conversation}
        messages={[]}
        members={[makeMember({})]}
        isLoading={false}
        isSending={false}
        currentUserId={10}
        onSend={async () => {}}
      />
    );
    expect(screen.queryByLabelText("Volver a conversaciones")).not.toBeInTheDocument();
  });

  it("llama a onBack al tocar el botón de volver", () => {
    const onBack = vi.fn();
    renderThread(
      <MessageThread
        conversation={conversation}
        messages={[]}
        members={[makeMember({})]}
        isLoading={false}
        isSending={false}
        currentUserId={10}
        onSend={async () => {}}
        onBack={onBack}
      />
    );
    fireEvent.click(screen.getByLabelText("Volver a conversaciones"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

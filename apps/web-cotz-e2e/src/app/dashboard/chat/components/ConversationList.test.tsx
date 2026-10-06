import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ConversationList } from "./ConversationList";
import { markUserTyping } from "@/hooks/useChatTyping";
import type { ChatConversation, ChatMessage } from "@/types";

function makeConversation(overrides: Partial<ChatConversation>): ChatConversation {
  const lastMessage: ChatMessage = {
    id: 1,
    conversationId: 1,
    body: "Hola",
    createdAt: "2026-01-01T10:00:00.000Z",
    senderId: 20,
  };
  return {
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
    lastMessage,
    unreadCount: 0,
    isMonitor: false,
    ...overrides,
  };
}

describe("ConversationList", () => {
  it("muestra la hora del último mensaje", () => {
    render(
      <ConversationList
        conversations={[makeConversation({})]}
        isLoading={false}
        selectedId={null}
        onSelect={() => {}}
        onNewDirect={() => {}}
      />
    );
    expect(screen.getByText(/^\d{1,2}:\d{2}/)).toBeInTheDocument();
  });

  it('reemplaza el preview por "escribiendo…" cuando el otro está tipeando', () => {
    markUserTyping(1, 20);
    render(
      <ConversationList
        conversations={[makeConversation({ id: 1 })]}
        isLoading={false}
        selectedId={null}
        onSelect={() => {}}
        onNewDirect={() => {}}
      />
    );
    expect(screen.getByText(/escribiendo/i)).toBeInTheDocument();
    expect(screen.queryByText("Hola")).not.toBeInTheDocument();
  });
});

describe("ConversationList - badge de presencia sobre el avatar", () => {
  it("muestra el punto verde cuando el otro usuario de un DM está en línea", () => {
    render(
      <ConversationList
        conversations={[
          makeConversation({
            id: 1,
            otherUser: {
              id: 20,
              username: "ana",
              firstName: "Ana",
              lastName: "Gómez",
              isOnline: true,
              lastSeenAt: null,
            },
          }),
        ]}
        isLoading={false}
        selectedId={null}
        onSelect={() => {}}
        onNewDirect={() => {}}
      />
    );
    expect(screen.getByTestId("presence-badge-1")).toBeInTheDocument();
  });

  it("no muestra el punto cuando el otro usuario está offline", () => {
    render(
      <ConversationList
        conversations={[
          makeConversation({
            id: 1,
            otherUser: {
              id: 20,
              username: "ana",
              firstName: "Ana",
              lastName: "Gómez",
              isOnline: false,
              lastSeenAt: null,
            },
          }),
        ]}
        isLoading={false}
        selectedId={null}
        onSelect={() => {}}
        onNewDirect={() => {}}
      />
    );
    expect(screen.queryByTestId("presence-badge-1")).not.toBeInTheDocument();
  });

  it("no muestra el punto en canales de área (aunque no aplique isOnline)", () => {
    render(
      <ConversationList
        conversations={[
          makeConversation({
            id: 2,
            type: "area",
            area: "Diseño",
            title: "Diseño",
            otherUser: null,
          }),
        ]}
        isLoading={false}
        selectedId={null}
        onSelect={() => {}}
        onNewDirect={() => {}}
      />
    );
    expect(screen.queryByTestId("presence-badge-2")).not.toBeInTheDocument();
  });
});

describe("ConversationList - buscador", () => {
  it("filtra por título de la conversación", () => {
    render(
      <ConversationList
        conversations={[
          makeConversation({ id: 1, title: "Ana Gómez" }),
          makeConversation({ id: 2, title: "Diseño", type: "area", area: "diseno", otherUser: null }),
        ]}
        isLoading={false}
        selectedId={null}
        onSelect={() => {}}
        onNewDirect={() => {}}
      />
    );
    expect(screen.getByText("Ana Gómez")).toBeInTheDocument();
    expect(screen.getByText("Diseño")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Buscar…"), {
      target: { value: "ana" },
    });

    expect(screen.getByText("Ana Gómez")).toBeInTheDocument();
    expect(screen.queryByText("Diseño")).not.toBeInTheDocument();
  });

  it('muestra "Sin resultados." cuando el filtro no matchea nada', () => {
    render(
      <ConversationList
        conversations={[makeConversation({ id: 1, title: "Ana Gómez" })]}
        isLoading={false}
        selectedId={null}
        onSelect={() => {}}
        onNewDirect={() => {}}
      />
    );
    fireEvent.change(screen.getByPlaceholderText("Buscar…"), {
      target: { value: "zzz" },
    });
    expect(screen.getAllByText("Sin resultados.")).toHaveLength(2);
  });
});

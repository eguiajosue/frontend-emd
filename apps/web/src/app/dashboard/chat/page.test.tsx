import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import ChatPage from "./page";

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { id: "1" } } }),
}));

vi.mock("@/hooks/useChat", () => ({
  chatDisplayName: (u: { username: string }) => u.username,
  useChatConversations: () => ({
    conversations: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useChatMessages: () => ({ messages: [], isLoading: false }),
  useChatMembers: () => ({ members: [] }),
  useChatUsers: () => ({ users: [] }),
  useChatMutations: () => ({
    sendMessage: vi.fn(),
    isSending: false,
    markAsRead: vi.fn(),
    createDirect: vi.fn(),
  }),
}));

vi.mock("./components/ConversationList", () => ({
  ConversationList: () => <div data-testid="conversation-list" />,
}));

vi.mock("./components/MessageThread", () => ({
  MessageThread: () => <div data-testid="message-thread" />,
}));

describe("ChatPage", () => {
  it("usa una altura dinámica que se achica con el teclado de iOS", () => {
    const { container } = render(<ChatPage />);
    const shell = container.querySelector('[class*="calc(100dvh"]');
    expect(shell).toBeTruthy();
  });

  it("ya no usa 100vh, que no se achica con el teclado", () => {
    const { container } = render(<ChatPage />);
    const stale = container.querySelector('[class*="calc(100vh"]');
    expect(stale).toBeNull();
  });
});

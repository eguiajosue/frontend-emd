"use client";

/**
 * Capa de datos del chat interno, sobre React Query y el cliente HTTP único
 * (`request` -> `authFetch`), igual que el resto de la app.
 *
 * La entrega en vivo NO abre ningún socket propio: `useSocket` (la única
 * conexión de la app, montada en el layout del dashboard) escucha el evento
 * `chatMessage` e invalida estas mismas query keys.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request, unwrapList, type Paginated } from "@/lib/api";
import { ENDPOINTS, queryKeys } from "@/lib/queryKeys";
import { useAuthToken } from "@/hooks/useEntity";
import type {
  ChatConversation,
  ChatMember,
  ChatMessage,
  ChatUserOption,
} from "@/types";

const CHAT_KEY = queryKeys.all("chat");

export const chatQueryKeys = {
  all: () => CHAT_KEY,
  conversations: () => [...CHAT_KEY, "conversations"] as const,
  messages: (id: number) => [...CHAT_KEY, "messages", id] as const,
  members: (id: number) => [...CHAT_KEY, "members", id] as const,
  users: () => [...CHAT_KEY, "users"] as const,
};

/** `GET /chat/conversations`: canales de área + mensajes directos visibles. */
export function useChatConversations() {
  const token = useAuthToken();

  const query = useQuery<ChatConversation[]>({
    queryKey: chatQueryKeys.conversations(),
    enabled: Boolean(token),
    queryFn: () =>
      request<ChatConversation[]>(`${ENDPOINTS.chat}/conversations`, { token }),
    placeholderData: (previous) => previous,
  });

  return {
    conversations: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Total de mensajes sin leer, derivado de la misma query de conversaciones
 * (no hace una request extra) para el badge del menú.
 */
export function useChatUnreadCount(): number {
  const { conversations } = useChatConversations();
  return conversations.reduce((acc, c) => acc + (c.unreadCount ?? 0), 0);
}

/**
 * `GET /chat/conversations/:id/messages` paginado. El backend devuelve del
 * más nuevo al más viejo; acá se invierte para renderizar el hilo en orden
 * cronológico.
 */
export function useChatMessages(conversationId: number | null, limit = 50) {
  const token = useAuthToken();

  const query = useQuery<ChatMessage[]>({
    queryKey: chatQueryKeys.messages(conversationId ?? 0),
    enabled: Boolean(token) && Boolean(conversationId),
    queryFn: async () => {
      const payload = await request<ChatMessage[] | Paginated<ChatMessage>>(
        `${ENDPOINTS.chat}/conversations/${conversationId}/messages`,
        { token, params: { page: 1, limit } }
      );
      return unwrapList<ChatMessage>(payload).slice().reverse();
    },
    placeholderData: (previous) => previous,
  });

  return {
    messages: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}

/** `GET /chat/conversations/:id/members`, con el indicador de monitoreo. */
export function useChatMembers(conversationId: number | null) {
  const token = useAuthToken();

  const query = useQuery<ChatMember[]>({
    queryKey: chatQueryKeys.members(conversationId ?? 0),
    enabled: Boolean(token) && Boolean(conversationId),
    queryFn: () =>
      request<ChatMember[]>(
        `${ENDPOINTS.chat}/conversations/${conversationId}/members`,
        { token }
      ),
  });

  return { members: query.data ?? [], isLoading: query.isLoading };
}

/** `GET /chat/users`: con quién se puede abrir un mensaje directo. */
export function useChatUsers(enabled: boolean) {
  const token = useAuthToken();

  const query = useQuery<ChatUserOption[]>({
    queryKey: chatQueryKeys.users(),
    enabled: Boolean(token) && enabled,
    queryFn: () => request<ChatUserOption[]>(`${ENDPOINTS.chat}/users`, { token }),
  });

  return { users: query.data ?? [], isLoading: query.isLoading };
}

/** Mutaciones del chat: enviar, marcar leído y abrir un mensaje directo. */
export function useChatMutations() {
  const token = useAuthToken();
  const queryClient = useQueryClient();

  const invalidateConversations = () =>
    queryClient.invalidateQueries({ queryKey: chatQueryKeys.conversations() });

  const sendMessage = useMutation({
    mutationFn: ({
      conversationId,
      body,
      orderId,
    }: {
      conversationId: number;
      body: string;
      orderId?: number;
    }) =>
      request<ChatMessage>(
        `${ENDPOINTS.chat}/conversations/${conversationId}/messages`,
        { method: "POST", token, body: { body, ...(orderId ? { orderId } : {}) } }
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: chatQueryKeys.messages(variables.conversationId),
      });
      void invalidateConversations();
    },
  });

  const markAsRead = useMutation({
    mutationFn: (conversationId: number) =>
      request<{ message: string }>(
        `${ENDPOINTS.chat}/conversations/${conversationId}/read`,
        { method: "POST", token }
      ),
    onSuccess: invalidateConversations,
  });

  const createDirect = useMutation({
    mutationFn: (userId: number) =>
      request<ChatConversation>(`${ENDPOINTS.chat}/conversations/direct`, {
        method: "POST",
        token,
        body: { userId },
      }),
    onSuccess: invalidateConversations,
  });

  return {
    sendMessage: (conversationId: number, body: string, orderId?: number) =>
      sendMessage.mutateAsync({ conversationId, body, orderId }),
    isSending: sendMessage.isPending,
    markAsRead: (conversationId: number) =>
      markAsRead.mutateAsync(conversationId).catch(() => undefined),
    createDirect: (userId: number) => createDirect.mutateAsync(userId),
  };
}

/** Nombre visible de un usuario del chat. */
export function chatDisplayName(user?: {
  firstName?: string;
  lastName?: string | null;
  username?: string;
} | null): string {
  if (!user) return "Usuario";
  const full = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return full || user.username || "Usuario";
}

/** Iniciales para el avatar. */
export function chatInitials(user?: {
  firstName?: string;
  lastName?: string | null;
  username?: string;
} | null): string {
  if (!user) return "??";
  const first = user.firstName?.[0] ?? user.username?.[0] ?? "?";
  const last = user.lastName?.[0] ?? user.username?.[1] ?? "";
  return `${first}${last}`.toUpperCase();
}

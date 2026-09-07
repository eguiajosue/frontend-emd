"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import Title from "@/components/Title";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorState } from "@/components/feedback/states";
import { getErrorMessage, isSessionExpiredError } from "@/lib/api";
import {
  chatDisplayName,
  useChatConversations,
  useChatMembers,
  useChatMessages,
  useChatMutations,
  useChatUsers,
} from "@/hooks/useChat";
import { ConversationList } from "./components/ConversationList";
import { MessageThread } from "./components/MessageThread";

export default function ChatPage() {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ? Number(session.user.id) : null;

  const { conversations, isLoading, isError, error, refetch } =
    useChatConversations();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [directOpen, setDirectOpen] = useState(false);
  const [userFilter, setUserFilter] = useState("");

  const { messages, isLoading: loadingMessages } = useChatMessages(selectedId);
  const { members } = useChatMembers(selectedId);
  const { users } = useChatUsers(directOpen);
  const { sendMessage, isSending, markAsRead, createDirect } =
    useChatMutations();

  // Primera conversación por defecto, una vez cargada la lista.
  useEffect(() => {
    if (selectedId === null && conversations.length > 0) {
      setSelectedId(conversations[0].id);
    }
  }, [conversations, selectedId]);

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  // Abrir una conversación (o recibir un mensaje nuevo en la abierta) la marca
  // como leída, así el badge del menú refleja lo que el usuario ya vio.
  const lastMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;
  useEffect(() => {
    if (selectedId) void markAsRead(selectedId);
    // `markAsRead` viene de una mutación estable; sólo depende de qué se leyó.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, lastMessageId]);

  const handleSend = async (body: string, orderId?: number) => {
    if (!selectedId) return;
    try {
      await sendMessage(selectedId, body, orderId);
    } catch (err) {
      if (!isSessionExpiredError(err)) {
        toast.error(getErrorMessage(err, "No se pudo enviar el mensaje."));
      }
    }
  };

  const startDirect = async (userId: number) => {
    try {
      const conversation = await createDirect(userId);
      setDirectOpen(false);
      setUserFilter("");
      setSelectedId(conversation.id);
    } catch (err) {
      if (!isSessionExpiredError(err)) {
        toast.error(getErrorMessage(err, "No se pudo abrir el chat."));
      }
    }
  };

  const filteredUsers = users.filter((u) => {
    const needle = userFilter.trim().toLowerCase();
    if (!needle) return true;
    return (
      chatDisplayName(u).toLowerCase().includes(needle) ||
      u.username.toLowerCase().includes(needle) ||
      u.roles.some((r) => r.toLowerCase().includes(needle))
    );
  });

  if (isError) {
    return (
      <div>
        <Title title="Chat interno" />
        <ErrorState
          description={getErrorMessage(error, "No se pudo cargar el chat.")}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  return (
    <div>
      <Title title="Chat interno" />
      <p className="pb-4 text-sm text-muted-foreground">
        Canales entre Recepción y cada área, y mensajes directos entre usuarios.
        Las cuentas de administración participan de todas las conversaciones
        para monitoreo y figuran como tales en la lista de participantes.
      </p>

      <div className="flex h-[calc(100vh-16rem)] min-h-[420px] flex-col overflow-hidden rounded-lg border md:flex-row">
        <ConversationList
          conversations={conversations}
          isLoading={isLoading}
          selectedId={selectedId}
          onSelect={(conversation) => setSelectedId(conversation.id)}
          onNewDirect={() => setDirectOpen(true)}
        />
        <MessageThread
          conversation={selected}
          messages={messages}
          members={members}
          isLoading={loadingMessages}
          isSending={isSending}
          currentUserId={currentUserId}
          onSend={handleSend}
        />
      </div>

      <Dialog open={directOpen} onOpenChange={setDirectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo mensaje directo</DialogTitle>
            <DialogDescription>
              Elegí con quién querés hablar.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            placeholder="Buscar por nombre, usuario o área"
          />
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {filteredUsers.length === 0 ? (
              <p className="p-2 text-sm text-muted-foreground">
                No se encontraron usuarios.
              </p>
            ) : (
              filteredUsers.map((user) => (
                <Button
                  key={user.id}
                  variant="ghost"
                  className="w-full justify-between"
                  onClick={() => void startDirect(user.id)}
                >
                  <span>{chatDisplayName(user)}</span>
                  <span className="text-xs text-muted-foreground">
                    {user.roles.join(", ") || `@${user.username}`}
                  </span>
                </Button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

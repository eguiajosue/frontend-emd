"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { cn } from "@/lib/utils";
import { useVisualViewport } from "@/hooks/useVisualViewport";
import {
  chatDisplayName,
  useChatConversations,
  useChatMembers,
  useChatMessages,
  useChatMutations,
  useChatUsers,
} from "@/hooks/useChat";
import type { ChatAttachmentInput } from "@/types";
import { ConversationList } from "./components/ConversationList";
import { MessageThread } from "./components/MessageThread";
import { MediaPanel } from "./components/MediaPanel";

export default function ChatPage() {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ? Number(session.user.id) : null;

  const { conversations, isLoading, isError, error, refetch } =
    useChatConversations();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // En mobile la lista y el hilo son pantallas separadas (como una app
  // nativa de mensajería): sólo una está visible a la vez. En md+ esto no
  // tiene efecto — ambas quedan visibles siempre lado a lado.
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");
  const [directOpen, setDirectOpen] = useState(false);
  const [userFilter, setUserFilter] = useState("");

  // Hilo abierto en mobile = pantalla completa (ver `className` del hilo):
  // sigue el área visible para que el teclado de iOS no tape el compositor,
  // y la página de atrás no se desplaza mientras tanto.
  const threadOpen = mobileView === "thread";
  const viewport = useVisualViewport(threadOpen);
  useEffect(() => {
    if (!threadOpen || !window.matchMedia("(max-width: 767px)").matches) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [threadOpen]);

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

  const handleSend = async (
    body: string,
    orderId?: number,
    attachment?: ChatAttachmentInput
  ) => {
    if (!selectedId) return;
    try {
      await sendMessage(selectedId, body, orderId, attachment);
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
      setMobileView("thread");
    } catch (err) {
      if (!isSessionExpiredError(err)) {
        toast.error(getErrorMessage(err, "No se pudo abrir el chat."));
      }
    }
  };

  const filteredUsers = useMemo(() => {
    const needle = userFilter.trim().toLowerCase();
    return users
      .filter((u) => {
        if (!needle) return true;
        return (
          chatDisplayName(u).toLowerCase().includes(needle) ||
          u.username.toLowerCase().includes(needle)
        );
      })
      .sort((a, b) =>
        chatDisplayName(a).localeCompare(chatDisplayName(b), "es", {
          sensitivity: "base",
        })
      );
  }, [users, userFilter]);

  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const letterOf = (u: (typeof filteredUsers)[number]) =>
    chatDisplayName(u).trim().charAt(0).toUpperCase();
  const availableLetters = new Set(filteredUsers.map(letterOf));
  const letterRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const userListRef = useRef<HTMLDivElement>(null);

  const scrollToLetter = (letter: string) => {
    const el = letterRefs.current[letter];
    if (el) el.scrollIntoView({ block: "start" });
  };

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

      {/* Lista, hilo y archivos son tres tarjetas blancas separadas (en
          mobile se ve una sola a la vez, ver `mobileView`). En mobile no hay
          alto fijo: la lista crece con su contenido y el hilo se abre en
          pantalla completa por encima de la barra superior y de la de tabs,
          como en WhatsApp o iMessage. `--chat-vvh`/`--chat-vvt` son el área
          visible (ver `useVisualViewport`). */}
      <div
        className="flex flex-col md:h-[calc(100dvh-11rem)] md:min-h-[280px] md:flex-row md:gap-4"
        style={
          viewport
            ? ({
                "--chat-vvh": `${viewport.height}px`,
                "--chat-vvt": `${viewport.offsetTop}px`,
              } as React.CSSProperties)
            : undefined
        }
      >
        <ConversationList
          conversations={conversations}
          isLoading={isLoading}
          selectedId={selectedId}
          onSelect={(conversation) => {
            setSelectedId(conversation.id);
            setMobileView("thread");
          }}
          onNewDirect={() => setDirectOpen(true)}
          className={cn(mobileView === "thread" && "hidden md:flex")}
        />
        <MessageThread
          conversation={selected}
          messages={messages}
          members={members}
          isLoading={loadingMessages}
          isSending={isSending}
          currentUserId={currentUserId}
          onSend={handleSend}
          onBack={() => setMobileView("list")}
          className={cn(
            mobileView === "list"
              ? "hidden md:flex"
              : "max-md:fixed max-md:inset-x-0 max-md:top-[var(--chat-vvt,0px)] max-md:z-40 max-md:h-[var(--chat-vvh,100dvh)] max-md:rounded-none max-md:border-0"
          )}
        />
        {selected ? <MediaPanel messages={messages} /> : null}
      </div>

      <Dialog open={directOpen} onOpenChange={setDirectOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nuevo mensaje directo</DialogTitle>
            <DialogDescription>
              Seleccionar con quién hablar.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            placeholder="Buscar por nombre o usuario"
            className="rounded-full"
          />
          <div className="flex gap-1">
            <div className="flex shrink-0 flex-col items-center justify-center py-1 text-[10px] font-medium leading-none text-muted-foreground">
              {ALPHABET.map((letter) => (
                <Button
                  key={letter}
                  type="button"
                  variant="bare"
                  size="bare"
                  disabled={!availableLetters.has(letter)}
                  onClick={() => scrollToLetter(letter)}
                  aria-label={`Ir a la letra ${letter}`}
                  className={cn(
                    "rounded px-1 py-[1px] text-[10px] font-medium leading-none hover:text-primary disabled:opacity-100",
                    availableLetters.has(letter)
                      ? "text-foreground"
                      : "text-muted-foreground/30"
                  )}
                >
                  {letter}
                </Button>
              ))}
            </div>
            <div
              ref={userListRef}
              className="max-h-72 flex-1 space-y-1 overflow-y-auto"
            >
              {filteredUsers.length === 0 ? (
                <p className="p-2 text-sm text-muted-foreground">
                  No se encontraron usuarios.
                </p>
              ) : (
                filteredUsers.map((user, index) => {
                  const letter = letterOf(user);
                  const isFirstOfLetter =
                    index === 0 || letterOf(filteredUsers[index - 1]) !== letter;
                  return (
                    <div
                      key={user.id}
                      ref={
                        isFirstOfLetter
                          ? (el) => {
                              letterRefs.current[letter] = el;
                            }
                          : undefined
                      }
                    >
                      <Button
                        variant="ghost"
                        className="w-full justify-start rounded-lg"
                        onClick={() => void startDirect(user.id)}
                      >
                        {chatDisplayName(user)}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

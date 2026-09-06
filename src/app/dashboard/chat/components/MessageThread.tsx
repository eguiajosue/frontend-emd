"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { chatDisplayName, chatInitials } from "@/hooks/useChat";
import type { ChatConversation, ChatMember, ChatMessage } from "@/types";

interface MessageThreadProps {
  conversation: ChatConversation | null;
  messages: ChatMessage[];
  members: ChatMember[];
  isLoading: boolean;
  isSending: boolean;
  currentUserId: number | null;
  onSend: (body: string) => Promise<void>;
}

/** Hora corta (HH:mm) para el pie de cada mensaje. */
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Separador de día dentro del hilo. */
function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function MessageThread({
  conversation,
  messages,
  members,
  isLoading,
  isSending,
  currentUserId,
  onSend,
}: MessageThreadProps) {
  const [draft, setDraft] = useState("");
  const [showMembers, setShowMembers] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setDraft("");
    setShowMembers(false);
  }, [conversation?.id]);

  if (!conversation) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
        Elegí una conversación para empezar a chatear.
      </div>
    );
  }

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || isSending) return;
    setDraft("");
    await onSend(body);
  };

  let lastDay = "";

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col">
      <header className="flex items-center justify-between gap-2 border-b p-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{conversation.title}</h2>
          <p className="truncate text-xs text-muted-foreground">
            {conversation.type === "area"
              ? "Canal entre Recepción y el área"
              : "Mensaje directo"}
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowMembers((v) => !v)}
        >
          <Users className="mr-1 h-4 w-4" />
          Participantes ({members.length})
        </Button>
      </header>

      {showMembers ? (
        <div className="border-b bg-muted/40 p-3">
          <ul className="flex flex-wrap gap-2">
            {members.map((member) => (
              <li
                key={member.id}
                className="flex items-center gap-2 rounded-md border bg-background px-2 py-1 text-xs"
              >
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[10px]">
                    {chatInitials(member)}
                  </AvatarFallback>
                </Avatar>
                <span>{chatDisplayName(member)}</span>
                {member.isMonitor ? (
                  <Badge variant="secondary" className="gap-1 font-normal">
                    <Eye className="h-3 w-3" />
                    admin (monitoreo)
                  </Badge>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="pt-2 text-xs text-muted-foreground">
            Las cuentas de administración participan de todas las conversaciones
            para monitoreo interno y se muestran acá.
          </p>
        </div>
      ) : null}

      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {isLoading && messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">Cargando mensajes…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay mensajes en esta conversación.
          </p>
        ) : (
          messages.map((message) => {
            const mine = message.senderId === currentUserId;
            const day = formatDay(message.createdAt);
            const showDay = day !== lastDay;
            lastDay = day;
            const author = message.sender ?? {
              id: message.senderId,
              username: message.senderUsername ?? "",
              firstName: message.senderName ?? "Usuario",
              lastName: null,
            };

            return (
              <div key={message.id}>
                {showDay ? (
                  <div className="flex items-center gap-2 py-3">
                    <Separator className="flex-1" />
                    <span className="text-xs capitalize text-muted-foreground">
                      {day}
                    </span>
                    <Separator className="flex-1" />
                  </div>
                ) : null}
                <div
                  className={cn(
                    "flex items-end gap-2",
                    mine ? "justify-end" : "justify-start"
                  )}
                >
                  {!mine ? (
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className="text-[10px]">
                        {chatInitials(author)}
                      </AvatarFallback>
                    </Avatar>
                  ) : null}
                  <div
                    className={cn(
                      "max-w-[75%] rounded-lg px-3 py-2 text-sm",
                      mine
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    )}
                  >
                    {!mine ? (
                      <p className="pb-0.5 text-xs font-medium opacity-80">
                        {chatDisplayName(author)}
                      </p>
                    ) : null}
                    <p className="whitespace-pre-wrap break-words">
                      {message.body}
                    </p>
                    <p
                      className={cn(
                        "pt-1 text-[10px]",
                        mine
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground"
                      )}
                    >
                      {formatTime(message.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Escribí un mensaje… (Enter para enviar, Shift+Enter para saltar línea)"
            className="max-h-40 min-h-[44px] resize-none"
            maxLength={2000}
          />
          <Button
            onClick={() => void handleSend()}
            disabled={isSending || !draft.trim()}
          >
            <Send className="mr-1 h-4 w-4" />
            Enviar
          </Button>
        </div>
      </div>
    </section>
  );
}

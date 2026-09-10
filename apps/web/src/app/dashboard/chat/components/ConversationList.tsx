"use client";

import { Hash, MessageSquarePlus } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { chatInitials } from "@/hooks/useChat";
import { useChatTyping } from "@/hooks/useChatTyping";
import type { ChatConversation } from "@/types";

interface ConversationListProps {
  conversations: ChatConversation[];
  isLoading: boolean;
  selectedId: number | null;
  onSelect: (conversation: ChatConversation) => void;
  onNewDirect: () => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface ConversationRowProps {
  conversation: ChatConversation;
  active: boolean;
  onSelect: (conversation: ChatConversation) => void;
}

function ConversationRow({ conversation, active, onSelect }: ConversationRowProps) {
  const typingUserIds = useChatTyping(conversation.id);
  const isTyping = typingUserIds.length > 0;

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(conversation)}
        className={cn(
          "group relative flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-colors",
          active
            ? "bg-primary/10 text-foreground"
            : "text-foreground/90 hover:bg-accent"
        )}
      >
        {active ? (
          <motion.span
            layoutId="chat-conversation-active"
            className="absolute inset-0 rounded-xl bg-primary/10"
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
          />
        ) : null}
        <span className="relative z-10 shrink-0">
          {conversation.type === "area" ? (
            <span
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full",
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Hash className="h-4 w-4" />
            </span>
          ) : (
            <Avatar className="h-9 w-9">
              <AvatarFallback
                className={cn(
                  "text-xs font-semibold",
                  active && "bg-primary text-primary-foreground"
                )}
              >
                {chatInitials({
                  username: "",
                  firstName: conversation.title,
                  lastName: null,
                })}
              </AvatarFallback>
            </Avatar>
          )}
        </span>
        <span className="relative z-10 min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span
              className={cn(
                "block min-w-0 flex-1 truncate font-medium",
                active && "text-primary"
              )}
            >
              {conversation.title}
            </span>
            {conversation.lastMessageAt ? (
              <span className="shrink-0 text-[11px] text-muted-foreground/80">
                {formatTime(conversation.lastMessageAt)}
              </span>
            ) : null}
          </span>
          {isTyping ? (
            <span className="block truncate text-xs italic text-primary">
              escribiendo…
            </span>
          ) : conversation.lastMessage ? (
            <span className="block truncate text-xs text-muted-foreground">
              {conversation.lastMessage.body}
            </span>
          ) : (
            <span className="block truncate text-xs text-muted-foreground/70">
              {conversation.type === "area" ? "Canal de área" : "Mensaje directo"}
            </span>
          )}
        </span>
        {conversation.unreadCount > 0 ? (
          <span className="relative z-10 ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
            {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
          </span>
        ) : null}
      </button>
    </li>
  );
}

export function ConversationList({
  conversations,
  isLoading,
  selectedId,
  onSelect,
  onNewDirect,
}: ConversationListProps) {
  const areas = conversations.filter((c) => c.type === "area");
  const directs = conversations.filter((c) => c.type === "direct");

  const renderGroup = (label: string, items: ChatConversation[]) => (
    <div className="mb-4">
      <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">
        {label}
      </p>
      {items.length === 0 ? (
        <p className="px-3 py-2 text-sm text-muted-foreground">
          No hay conversaciones.
        </p>
      ) : (
        <ul className="space-y-1">
          {items.map((conversation) => (
            <ConversationRow
              key={conversation.id}
              conversation={conversation}
              active={selectedId === conversation.id}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <aside className="flex max-h-[45vh] w-full min-w-0 flex-col border-b bg-card/40 md:h-full md:max-h-none md:w-80 md:border-b-0 md:border-r">
      <div className="flex items-center justify-between gap-2 border-b p-3.5">
        <h2 className="text-sm font-semibold tracking-tight">Conversaciones</h2>
        <Button size="sm" className="gap-1.5 rounded-full" onClick={onNewDirect}>
          <MessageSquarePlus className="h-3.5 w-3.5" />
          Nuevo
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2.5">
        {isLoading && conversations.length === 0 ? (
          <div className="space-y-2 p-1" role="status" aria-busy="true" aria-label="Cargando conversaciones">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : (
          <>
            {renderGroup("Canales de área", areas)}
            {renderGroup("Mensajes directos", directs)}
          </>
        )}
      </div>
    </aside>
  );
}

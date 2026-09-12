"use client";

import { useMemo, useState } from "react";
import { Hash, MessageSquarePlus, Search } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { chatInitials } from "@/hooks/useChat";
import { useChatTyping } from "@/hooks/useChatTyping";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import type { ChatConversation } from "@/types";

interface ConversationListProps {
  conversations: ChatConversation[];
  isLoading: boolean;
  selectedId: number | null;
  onSelect: (conversation: ChatConversation) => void;
  onNewDirect: () => void;
  className?: string;
}

interface ConversationRowProps {
  conversation: ChatConversation;
  active: boolean;
  onSelect: (conversation: ChatConversation) => void;
}

function ConversationRow({ conversation, active, onSelect }: ConversationRowProps) {
  const typingUserIds = useChatTyping(conversation.id);
  const isTyping = typingUserIds.length > 0;
  const { formatTime } = useTimeFormat();

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
          {/* Punto de presencia "en línea": sólo mensajes directos con el
              otro usuario conectado ahora mismo (mismo patrón que el
              indicador de sesión propia en app-sidebar.tsx). */}
          {conversation.type === "direct" && conversation.otherUser?.isOnline ? (
            <span
              aria-hidden
              data-testid={`presence-badge-${conversation.id}`}
              className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background"
            />
          ) : null}
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
                {formatTime(new Date(conversation.lastMessageAt))}
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
  className,
}: ConversationListProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, search]);

  const areas = filtered.filter((c) => c.type === "area");
  const directs = filtered.filter((c) => c.type === "direct");

  const renderGroup = (label: string, items: ChatConversation[]) => (
    <div className="mb-4">
      <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">
        {label}
      </p>
      {items.length === 0 ? (
        <p className="px-3 py-2 text-sm text-muted-foreground">
          {search.trim() ? "Sin resultados." : "No hay conversaciones."}
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
    <aside
      className={cn(
        // Antes esto convivía apilado con MessageThread en la misma pantalla
        // mobile (de ahí el max-h-[45vh] + border-b) — ahora en mobile son
        // pantallas separadas (ver mobileView en page.tsx), así que la lista
        // ocupa el alto completo igual que el hilo.
        "flex h-full w-full min-w-0 flex-col bg-card/40 md:w-80 md:border-r",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b p-3.5">
        <h2 className="text-sm font-semibold tracking-tight">Conversaciones</h2>
        <Button size="sm" className="gap-1.5 rounded-full" onClick={onNewDirect}>
          <MessageSquarePlus className="h-3.5 w-3.5" />
          Nuevo
        </Button>
      </div>
      <div className="border-b p-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar…"
            className="h-9 rounded-full pl-8 text-sm"
          />
        </div>
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

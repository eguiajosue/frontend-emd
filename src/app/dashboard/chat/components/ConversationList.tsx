"use client";

import { Hash, MessageSquarePlus, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChatConversation } from "@/types";

interface ConversationListProps {
  conversations: ChatConversation[];
  isLoading: boolean;
  selectedId: number | null;
  onSelect: (conversation: ChatConversation) => void;
  onNewDirect: () => void;
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
      <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {items.length === 0 ? (
        <p className="px-3 py-2 text-sm text-muted-foreground">
          No hay conversaciones.
        </p>
      ) : (
        <ul className="space-y-1">
          {items.map((conversation) => (
            <li key={conversation.id}>
              <button
                type="button"
                onClick={() => onSelect(conversation)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                  selectedId === conversation.id &&
                    "bg-primary/10 text-primary"
                )}
              >
                {conversation.type === "area" ? (
                  <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {conversation.title}
                  </span>
                  {conversation.lastMessage ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {conversation.lastMessage.body}
                    </span>
                  ) : null}
                </span>
                {conversation.unreadCount > 0 ? (
                  <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                    {conversation.unreadCount > 99
                      ? "99+"
                      : conversation.unreadCount}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <aside className="flex h-full w-full min-w-0 flex-col border-b md:w-72 md:border-b-0 md:border-r">
      <div className="flex items-center justify-between border-b p-3">
        <h2 className="text-sm font-semibold">Conversaciones</h2>
        <Button size="sm" variant="outline" onClick={onNewDirect}>
          <MessageSquarePlus className="mr-1 h-4 w-4" />
          Nuevo
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading && conversations.length === 0 ? (
          <div className="space-y-2 p-1">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
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

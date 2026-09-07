"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, ExternalLink, Paperclip, Send, Users, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { chatDisplayName, chatInitials } from "@/hooks/useChat";
import { useMotionPreset } from "@/lib/motion";
import { useOrders } from "@/hooks/useOrders";
import type { ChatConversation, ChatMember, ChatMessage, ChatOrderRef, Order } from "@/types";

interface MessageThreadProps {
  conversation: ChatConversation | null;
  messages: ChatMessage[];
  members: ChatMember[];
  isLoading: boolean;
  isSending: boolean;
  currentUserId: number | null;
  onSend: (body: string, orderId?: number) => Promise<void>;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function OrderRefChip({ order, mine }: { order: ChatOrderRef; mine: boolean }) {
  return (
    <a
      href={`/dashboard/pedidos/${order.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "mt-1 flex items-start gap-2 rounded-md border p-2 text-xs transition-colors hover:opacity-80",
        mine
          ? "border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground"
          : "border-border bg-background/60 text-foreground"
      )}
    >
      <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 opacity-60" />
      <div className="min-w-0">
        <p className="font-medium">Pedido #{order.id}</p>
        <p className="truncate opacity-70">{order.description}</p>
        {order.status ? <p className="opacity-60">{order.status.name}</p> : null}
      </div>
    </a>
  );
}

function OrderPicker({
  selected,
  onSelect,
}: {
  selected: Order | null;
  onSelect: (order: Order) => void;
}) {
  const { data: orders = [] } = useOrders();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const filtered = orders.filter((o) => {
    const q = filter.toLowerCase();
    return !q || String(o.id).includes(q) || o.description?.toLowerCase().includes(q);
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant={selected ? "default" : "ghost"}
          className="h-9 w-9 shrink-0"
          title="Adjuntar pedido como contexto"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" side="top" align="start" sideOffset={8}>
        <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">
          Adjuntar pedido como contexto
        </p>
        <Input
          placeholder="Buscar por número o descripción…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="mb-2 h-7 text-xs"
          autoFocus
        />
        <ul className="max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <li className="px-1 py-2 text-xs text-muted-foreground">Sin resultados</li>
          ) : (
            filtered.slice(0, 20).map((order) => (
              <li key={order.id}>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
                  onClick={() => {
                    onSelect(order);
                    setOpen(false);
                    setFilter("");
                  }}
                >
                  <span className="font-medium">#{order.id}</span>{" "}
                  <span className="text-muted-foreground">{order.description}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
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
  const [attachedOrder, setAttachedOrder] = useState<Order | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { reduced } = useMotionPreset();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setDraft("");
    setShowMembers(false);
    setAttachedOrder(null);
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
    const orderId = attachedOrder?.id;
    setDraft("");
    setAttachedOrder(null);
    await onSend(body, orderId);
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
        <Button size="sm" variant="ghost" onClick={() => setShowMembers((v) => !v)}>
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
                  <AvatarFallback className="text-[10px]">{chatInitials(member)}</AvatarFallback>
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
            Las cuentas de administración participan de todas las conversaciones para
            monitoreo interno y se muestran acá.
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
          <AnimatePresence initial={false}>
            {messages.map((message) => {
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
                <motion.div
                  key={message.id}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={
                    reduced
                      ? { duration: 0.15 }
                      : { type: "spring", bounce: 0.25, duration: 0.35 }
                  }
                >
                  {showDay ? (
                    <div className="flex items-center gap-2 py-3">
                      <Separator className="flex-1" />
                      <span className="text-xs capitalize text-muted-foreground">{day}</span>
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
                      <p className="whitespace-pre-wrap break-words">{message.body}</p>
                      {message.order ? (
                        <OrderRefChip order={message.order} mine={mine} />
                      ) : null}
                      <p
                        className={cn(
                          "pt-1 text-[10px]",
                          mine ? "text-primary-foreground/70" : "text-muted-foreground"
                        )}
                      >
                        {formatTime(message.createdAt)}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t p-3">
        {attachedOrder ? (
          <div className="mb-2 flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1.5 text-xs">
            <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">
              <span className="font-medium">Pedido #{attachedOrder.id}</span>{" "}
              <span className="text-muted-foreground">{attachedOrder.description}</span>
            </span>
            <button
              type="button"
              onClick={() => setAttachedOrder(null)}
              className="ml-1 text-muted-foreground hover:text-foreground"
              title="Quitar adjunto"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <OrderPicker selected={attachedOrder} onSelect={setAttachedOrder} />
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
          <Button onClick={() => void handleSend()} disabled={isSending || !draft.trim()}>
            <Send className="mr-1 h-4 w-4" />
            Enviar
          </Button>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  Eye,
  File as FileIcon,
  FileUp,
  Paperclip,
  Send,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { useVirtualizer } from "@tanstack/react-virtual";
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
import { MessageThreadSkeleton } from "@/components/feedback/states";
import { chatDisplayName, chatInitials } from "@/hooks/useChat";
import { useMotionPreset } from "@/lib/motion";
import { useOrders } from "@/hooks/useOrders";
import { isFinishedStatus } from "@/lib/orderStatus";
import { OrderDetailDialog } from "@/components/orders/OrderDetailDialog";
import type {
  ChatAttachmentInput,
  ChatConversation,
  ChatMember,
  ChatMessage,
  ChatOrderRef,
  Order,
} from "@/types";

// Mismo criterio que la hoja de autorización de pedidos
// (`CreateOrderDialog`), adaptado a un límite algo más generoso porque acá
// también se admiten audios y documentos, no sólo imágenes/PDF chicos.
const CHAT_ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024; // 15MB
const CHAT_ATTACHMENT_ACCEPT =
  "image/*,application/pdf,audio/*,.doc,.docx,.xls,.xlsx";

/** Lee un File a `{ data, filename, mimeType }` (base64 sin el prefijo data:...;base64,). */
function readFileAsChatAttachment(file: File): Promise<ChatAttachmentInput> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const base64 = result.split(",")[1] ?? "";
      resolve({ data: base64, filename: file.name, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  });
}

interface MessageThreadProps {
  conversation: ChatConversation | null;
  messages: ChatMessage[];
  members: ChatMember[];
  isLoading: boolean;
  isSending: boolean;
  currentUserId: number | null;
  onSend: (
    body: string,
    orderId?: number,
    attachment?: ChatAttachmentInput
  ) => Promise<void>;
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

function OrderRefChip({
  order,
  mine,
  onOpen,
}: {
  order: ChatOrderRef;
  mine: boolean;
  onOpen: (orderId: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(order.id)}
      className={cn(
        "mt-1 flex w-full items-start gap-2 rounded-xl border p-2.5 text-left text-xs transition-colors hover:opacity-80",
        mine
          ? "border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground"
          : "border-border bg-background/60 text-foreground"
      )}
    >
      <Eye className="mt-0.5 h-3 w-3 shrink-0 opacity-60" />
      <div className="min-w-0">
        <p className="font-medium">Pedido #{order.id}</p>
        <p className="truncate opacity-70">{order.description}</p>
        {order.status ? <p className="opacity-60">{order.status.name}</p> : null}
      </div>
    </button>
  );
}

/** Adjunto de un mensaje ya enviado: imagen (thumbnail), audio (player) o chip de descarga. */
function MessageAttachment({ message, mine }: { message: ChatMessage; mine: boolean }) {
  const url = message.attachment?.dataUrl;
  if (!url) return null;
  const mimeType = message.attachment?.mimeType ?? "";
  const filename = message.attachment?.filename ?? "Archivo adjunto";

  if (mimeType.startsWith("image/")) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="mt-1 block">
        <img
          src={url}
          alt={filename}
          className="max-h-48 w-auto rounded-xl border border-border/60 object-cover shadow-soft"
        />
      </a>
    );
  }

  if (mimeType.startsWith("audio/")) {
    return (
      <audio controls className="mt-1 h-9 max-w-full" preload="none">
        <source src={url} type={mimeType || undefined} />
      </audio>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download={filename}
      className={cn(
        "mt-1 flex items-center gap-2 rounded-xl border p-2.5 text-xs transition-colors hover:opacity-80",
        mine
          ? "border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground"
          : "border-border bg-background/60 text-foreground"
      )}
    >
      <FileIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
      <span className="min-w-0 flex-1 truncate">{filename}</span>
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

  // Un pedido ya terminado/entregado casi nunca hace falta referenciarlo en
  // un mensaje nuevo — se saca de la lista para no ensuciar el buscador con
  // pedidos cerrados (ver isFinishedStatus).
  const filtered = orders.filter((o) => {
    if (isFinishedStatus(o.statusId)) return false;
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
          className="h-10 w-10 shrink-0 rounded-full"
          title="Adjuntar pedido como contexto"
          aria-label="Adjuntar pedido como contexto"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 rounded-2xl p-2 shadow-soft-md" side="top" align="start" sideOffset={8}>
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
  const [attachedFile, setAttachedFile] = useState<ChatAttachmentInput | null>(null);
  const [attachedFilePreview, setAttachedFilePreview] = useState<string | null>(null);
  const [openOrderId, setOpenOrderId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { reduced } = useMotionPreset();

  // Threads largos (cientos/miles de mensajes) se virtualizan para mantener el
  // scroll fluido; los cortos se quedan con la animación de entrada existente.
  const VIRTUALIZE_THRESHOLD = 60;
  const shouldVirtualize = messages.length > VIRTUALIZE_THRESHOLD;

  // Precalcula el separador de día por mensaje una sola vez (antes se hacía
  // con una variable mutable `lastDay` durante el .map, lo cual no es
  // compatible con el acceso por índice del virtualizador).
  const messagesWithDay = useMemo(() => {
    let lastDay = "";
    return messages.map((message) => {
      const day = formatDay(message.createdAt);
      const showDay = day !== lastDay;
      lastDay = day;
      return { message, day, showDay };
    });
  }, [messages]);

  const virtualizer = useVirtualizer({
    count: messagesWithDay.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 72,
    overscan: 8,
    enabled: shouldVirtualize,
  });

  // Sólo se anima la entrada de mensajes que todavía no se renderizaron acá.
  // Se rastrea por id (no por índice) porque la virtualización sólo monta los
  // ítems visibles: un mensaje viejo que entra/sale del rango virtualizado al
  // hacer scroll no debe re-animarse, y uno recién llegado sí. El set vive en
  // un ref (no en estado) para no disparar renders extra y para sobrevivir a
  // que la virtualización desmonte y vuelva a montar el mismo mensaje.
  const seenMessageIdsRef = useRef<Set<number>>(new Set());

  // Al cambiar de conversación se reinicia: todo lo que cargue esa
  // conversación por primera vez cuenta como "ya visto" (no se anima el
  // historial inicial), sólo lo que llegue después entra animado.
  useEffect(() => {
    seenMessageIdsRef.current = new Set(messages.map((m) => m.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation?.id]);

  // Ids nuevos desde el último render (calculado antes de marcarlos como
  // vistos, para que el propio render que los pinta por primera vez pueda
  // saber que son nuevos y deba animarlos).
  const newMessageIds = useMemo(() => {
    const seen = seenMessageIdsRef.current;
    const fresh = new Set<number>();
    for (const message of messages) {
      if (!seen.has(message.id)) fresh.add(message.id);
    }
    return fresh;
  }, [messages]);

  // Una vez pintado el render que ya tuvo en cuenta `newMessageIds`, se
  // marcan como vistos para que no se vuelvan a animar en renders futuros
  // (por ejemplo al hacer scroll y que la virtualización los desmonte/monte).
  useEffect(() => {
    messages.forEach((message) => seenMessageIdsRef.current.add(message.id));
  }, [messages]);

  useEffect(() => {
    if (shouldVirtualize) {
      virtualizer.scrollToIndex(messagesWithDay.length - 1, { align: "end" });
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, shouldVirtualize, virtualizer, messagesWithDay.length]);

  useEffect(() => {
    setDraft("");
    setShowMembers(false);
    setAttachedOrder(null);
    setAttachedFile(null);
    setAttachedFilePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
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
    // El texto es opcional cuando hay un adjunto (igual que el backend), pero
    // no se puede mandar un mensaje totalmente vacío.
    if ((!body && !attachedFile) || isSending) return;
    const orderId = attachedOrder?.id;
    const attachment = attachedFile ?? undefined;
    setDraft("");
    setAttachedOrder(null);
    setAttachedFile(null);
    setAttachedFilePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    await onSend(body, orderId, attachment);
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > CHAT_ATTACHMENT_MAX_BYTES) {
      toast.error("El archivo no puede pesar más de 15MB.");
      e.target.value = "";
      return;
    }

    try {
      const parsed = await readFileAsChatAttachment(file);
      setAttachedFile(parsed);
      setAttachedFilePreview(
        file.type.startsWith("image/") ? URL.createObjectURL(file) : null
      );
    } catch {
      toast.error("No se pudo leer el archivo. Intentá de nuevo.");
    } finally {
      e.target.value = "";
    }
  };

  const removeAttachedFile = () => {
    setAttachedFilePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setAttachedFile(null);
  };

  const renderBubble = (message: ChatMessage, day: string, showDay: boolean) => {
    const mine = message.senderId === currentUserId;
    const author = message.sender ?? {
      id: message.senderId,
      username: message.senderUsername ?? "",
      firstName: message.senderName ?? "Usuario",
      lastName: null,
    };

    return (
      <>
        {showDay ? (
          <div className="flex items-center gap-2 py-3">
            <Separator className="flex-1" />
            <span className="text-xs capitalize text-muted-foreground">{day}</span>
            <Separator className="flex-1" />
          </div>
        ) : null}
        <div className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start")}>
          {!mine ? (
            <Avatar className="h-7 w-7 shrink-0 shadow-soft">
              <AvatarFallback className="text-[10px] font-semibold">{chatInitials(author)}</AvatarFallback>
            </Avatar>
          ) : null}
          <div
            className={cn(
              "max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm transition-shadow",
              mine
                ? "rounded-br-md bg-primary text-primary-foreground shadow-soft"
                : "rounded-bl-md border bg-card text-foreground shadow-soft"
            )}
          >
            {!mine ? (
              <p className="pb-0.5 text-xs font-bold text-primary">{chatDisplayName(author)}</p>
            ) : null}
            {/* message.body se renderiza como children de React (auto-escapado),
                nunca vía dangerouslySetInnerHTML: no hace falta sanitizar HTML acá. */}
            {message.body ? (
              <p className="whitespace-pre-wrap break-words">{message.body}</p>
            ) : null}
            <MessageAttachment message={message} mine={mine} />
            {message.order ? (
              <OrderRefChip order={message.order} mine={mine} onOpen={setOpenOrderId} />
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
      </>
    );
  };

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

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
        {isLoading && messages.length === 0 ? (
          <MessageThreadSkeleton />
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay mensajes en esta conversación.
          </p>
        ) : shouldVirtualize ? (
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const { message, day, showDay } = messagesWithDay[virtualRow.index];
              // La virtualización monta/desmonta ítems al hacer scroll, así
              // que no puede depender de AnimatePresence (que animaría cada
              // vez que un mensaje viejo vuelve a montarse). En su lugar se
              // anima "a mano" sólo si el id todavía no se vio.
              const isNew = newMessageIds.has(message.id);
              return (
                <motion.div
                  key={message.id}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  initial={
                    !isNew
                      ? false
                      : reduced
                        ? { opacity: 0 }
                        : { opacity: 0, y: 12, scale: 0.98 }
                  }
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={
                    reduced
                      ? { duration: 0.15 }
                      : { type: "spring", bounce: 0.25, duration: 0.35 }
                  }
                >
                  {renderBubble(message, day, showDay)}
                </motion.div>
              );
            })}
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messagesWithDay.map(({ message, day, showDay }) => (
              <motion.div
                key={message.id}
                initial={
                  !newMessageIds.has(message.id)
                    ? false
                    : reduced
                      ? { opacity: 0 }
                      : { opacity: 0, y: 12, scale: 0.98 }
                }
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={
                  reduced
                    ? { duration: 0.15 }
                    : { type: "spring", bounce: 0.25, duration: 0.35 }
                }
              >
                {renderBubble(message, day, showDay)}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t bg-card/60 p-3">
        {attachedOrder ? (
          <div className="mb-2 flex items-center gap-2 rounded-2xl border bg-muted/40 px-3 py-2 text-xs shadow-soft">
            <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">
              <span className="font-semibold">Pedido #{attachedOrder.id}</span>{" "}
              <span className="text-muted-foreground">{attachedOrder.description}</span>
            </span>
            <button
              type="button"
              onClick={() => setAttachedOrder(null)}
              className="ml-1 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Quitar adjunto"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : null}
        {attachedFile ? (
          <div className="mb-2 flex items-center gap-3 rounded-2xl border bg-muted/40 px-3 py-2 text-xs shadow-soft">
            {attachedFilePreview ? (
              <img
                src={attachedFilePreview}
                alt={attachedFile.filename}
                className="h-9 w-9 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className="min-w-0 flex-1 truncate font-semibold">{attachedFile.filename}</span>
            <button
              type="button"
              onClick={removeAttachedFile}
              className="ml-1 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Quitar archivo"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <OrderPicker selected={attachedOrder} onSelect={setAttachedOrder} />
          <input
            ref={fileInputRef}
            type="file"
            accept={CHAT_ATTACHMENT_ACCEPT}
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            type="button"
            size="icon"
            variant={attachedFile ? "default" : "ghost"}
            className="h-10 w-10 shrink-0 rounded-full"
            title="Adjuntar foto, documento o audio"
            aria-label="Adjuntar foto, documento o audio"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileUp className="h-4 w-4" />
          </Button>
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
            className="max-h-40 min-h-[44px] resize-none rounded-2xl"
            maxLength={2000}
          />
          <Button
            onClick={() => void handleSend()}
            disabled={isSending || (!draft.trim() && !attachedFile)}
            className="rounded-full shadow-soft"
          >
            <Send className="mr-1 h-4 w-4" />
            Enviar
          </Button>
        </div>
      </div>

      <OrderDetailDialog orderId={openOrderId} onClose={() => setOpenOrderId(null)} />
    </section>
  );
}

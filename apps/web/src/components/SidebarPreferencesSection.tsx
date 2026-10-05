"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type Modifier,
  type ScreenReaderInstructions,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect } from "react";
import { Eye, EyeOff, GripVertical, RotateCcw, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/navMenu";
import { orderGroupItems, resolveFavorites } from "@/lib/navPreferences";
import { useNavPreferences } from "@/hooks/useNavPreferences";
import { useVisibleNavGroups } from "@/hooks/useVisibleNavItems";

/** Arrastre sólo vertical (sin `@dnd-kit/modifiers` como dependencia). */
const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });

/** Textos de lector de pantalla de dnd-kit (por defecto vienen en inglés). */
const SCREEN_READER_INSTRUCTIONS: ScreenReaderInstructions = {
  draggable:
    "Para mover una opción, presiona espacio o Enter. Usa las flechas arriba y abajo para cambiarla de lugar, espacio o Enter para soltarla, o Escape para cancelar.",
};

function announcements(titleOf: (id: string) => string): Announcements {
  return {
    onDragStart: ({ active }) => `Tomaste ${titleOf(String(active.id))}.`,
    onDragOver: ({ active, over }) =>
      over ? `${titleOf(String(active.id))} sobre ${titleOf(String(over.id))}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over ? `${titleOf(String(active.id))} quedó en el lugar de ${titleOf(String(over.id))}.` : `Soltaste ${titleOf(String(active.id))}.`,
    onDragCancel: ({ active }) => `Se canceló el movimiento de ${titleOf(String(active.id))}.`,
  };
}

/** Lista arrastrable (vertical) de urls; avisa el nuevo orden completo. */
function SortableList({
  label,
  items,
  onReorder,
  children,
}: {
  label: string;
  items: NavItem[];
  onReorder: (urls: string[]) => void;
  children: React.ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const urls = items.map((item) => item.url);
  const titleOf = (id: string) => items.find((item) => item.url === id)?.title ?? id;

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = urls.indexOf(String(active.id));
    const to = urls.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    onReorder(arrayMove(urls, from, to));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
      accessibility={{
        announcements: announcements(titleOf),
        screenReaderInstructions: SCREEN_READER_INSTRUCTIONS,
      }}
    >
      <SortableContext items={urls} strategy={verticalListSortingStrategy}>
        <ul aria-label={label} className="flex flex-col gap-1">
          {children}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  item,
  favorite,
  hidden,
  showHide,
  onToggleFavorite,
  onToggleHidden,
}: {
  item: NavItem;
  favorite: boolean;
  hidden: boolean;
  showHide: boolean;
  onToggleFavorite: () => void;
  onToggleHidden?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.url,
  });
  const favoriteLabel = favorite ? "Quitar de favoritos" : "Agregar a favoritos";
  const hideLabel = hidden ? "Mostrar en la barra" : "Ocultar de la barra";

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-hidden={hidden ? "true" : undefined}
      className={cn(
        "relative flex h-11 items-center gap-1 rounded-xl border border-transparent bg-muted/50 pl-1 pr-1.5 transition-[background-color,box-shadow,border-color]",
        isDragging && "z-10 border-border/60 bg-card shadow-soft-md"
      )}
    >
      <button
        type="button"
        className="flex h-8 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 active:cursor-grabbing"
        aria-label={`Mover ${item.title}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <span
        aria-hidden
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-card text-foreground/80 shadow-soft transition-opacity",
          hidden && "opacity-50"
        )}
      >
        <item.icon className="h-3.5 w-3.5" />
      </span>
      <span
        className={cn(
          "ml-1.5 min-w-0 flex-1 truncate text-sm transition-colors",
          hidden && "text-muted-foreground line-through decoration-muted-foreground/40"
        )}
      >
        {item.title}
      </span>
      <SimpleTooltip label={favoriteLabel}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`${favoriteLabel}: ${item.title}`}
          aria-pressed={favorite}
          onClick={onToggleFavorite}
          className={cn(
            "h-8 w-8 rounded-full text-muted-foreground hover:text-foreground",
            favorite && "text-amber-500 hover:text-amber-500"
          )}
        >
          <Star className={cn("!size-4", favorite && "fill-current")} aria-hidden />
        </Button>
      </SimpleTooltip>
      {showHide && onToggleHidden && (
        <SimpleTooltip label={hideLabel}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`${hideLabel}: ${item.title}`}
            aria-pressed={hidden}
            onClick={onToggleHidden}
            className={cn(
              "h-8 w-8 rounded-full text-muted-foreground hover:text-foreground",
              hidden && "text-foreground"
            )}
          >
            {hidden ? <EyeOff className="!size-4" aria-hidden /> : <Eye className="!size-4" aria-hidden />}
          </Button>
        </SimpleTooltip>
      )}
    </li>
  );
}

function SubHeading({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h3
      id={id}
      className="flex items-center gap-1.5 px-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
    >
      {children}
    </h3>
  );
}

/**
 * Configuración › Barra lateral: favoritos (arrastrables), cada grupo con su
 * orden, estrella para fijar y ojo para ocultar; títulos visibles y
 * restablecer. Todo se guarda al momento (optimista, con debounce).
 */
export function SidebarPreferencesSection() {
  const groups = useVisibleNavGroups();
  const nav = useNavPreferences();
  const { prefs } = nav;
  const favorites = resolveFavorites(groups, prefs);
  const favoriteUrls = new Set(favorites.map((item) => item.url));
  const hiddenUrls = new Set(prefs.hidden);

  // Llegando desde "Personalizar barra" (menú del riel): traerla a la vista.
  useEffect(() => {
    if (window.location.hash !== "#barra-lateral") return;
    const timer = setTimeout(
      () => document.getElementById("barra-lateral")?.scrollIntoView({ block: "start", behavior: "smooth" }),
      250
    );
    return () => clearTimeout(timer);
  }, []);

  return (
    <Card id="barra-lateral" className="scroll-mt-24">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle>Barra lateral</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={nav.reset}
            disabled={!nav.isCustomized}
            className="shrink-0 gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Restablecer
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/60 px-4 py-3">
          <Label htmlFor="pref-nav-expanded">Mostrar títulos (barra expandida)</Label>
          <Switch
            id="pref-nav-expanded"
            checked={nav.expanded}
            onCheckedChange={(checked) => nav.setExpanded(checked)}
          />
        </div>

        <section aria-labelledby="nav-pref-favorites" className="space-y-2">
          <SubHeading id="nav-pref-favorites">
            <Star className="h-3 w-3 fill-current text-amber-500" aria-hidden />
            Favoritos
          </SubHeading>
          {favorites.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
              Marca con la estrella las opciones que más usas para tenerlas hasta arriba.
            </p>
          ) : (
            <SortableList label="Favoritos" items={favorites} onReorder={nav.reorderFavorites}>
              {favorites.map((item) => (
                <SortableRow
                  key={item.url}
                  item={item}
                  favorite
                  hidden={false}
                  showHide={false}
                  onToggleFavorite={() => nav.toggleFavorite(item.url)}
                />
              ))}
            </SortableList>
          )}
        </section>

        {groups.map((group) => {
          const items = orderGroupItems(group, prefs);
          const headingId = `nav-pref-${group.groupLabel.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}`;
          return (
            <section key={group.groupLabel} aria-labelledby={headingId} className="space-y-2">
              <SubHeading id={headingId}>{group.groupLabel}</SubHeading>
              <SortableList
                label={group.groupLabel}
                items={items}
                onReorder={(urls) => nav.reorderGroup(group.groupLabel, urls)}
              >
                {items.map((item) => (
                  <SortableRow
                    key={item.url}
                    item={item}
                    favorite={favoriteUrls.has(item.url)}
                    hidden={hiddenUrls.has(item.url)}
                    showHide
                    onToggleFavorite={() => nav.toggleFavorite(item.url)}
                    onToggleHidden={() => nav.setHidden(item.url, !hiddenUrls.has(item.url))}
                  />
                ))}
              </SortableList>
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}

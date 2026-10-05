/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

/**
 * Drag-and-drop primitives for the CV editor.
 *
 * Two independent sortable contexts share this file:
 *   - `Sortable`     reorders entries inside one section (Education, Skills…)
 *   - `SortableList` reorders the sections themselves
 *
 * Both wrap @dnd-kit. Keeping a single `SortableContext` per list and never
 * nesting a DndContext inside another is what makes "an entry cannot leave its
 * section" fall out of the structure rather than from a guard clause.
 */

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { cn } from "@/lib/utils";

const SortableItemContext = React.createContext<{
  listeners: Record<string, Function> | undefined;
  isDragging: boolean;
  disabled: boolean;
  /**
   * dnd-kit needs to know which node the drag was started from.
   *
   * `SortableItemHandle` spreads `listeners` onto its own element, so without
   * wiring this ref to that same element dnd-kit falls back to capturing the
   * pointer on the draggable wrapper. Every `pointerup`/`click` inside the item
   * is then retargeted to the wrapper `<div>`, and buttons within the item —
   * duplicate, delete — never receive their click. The item still reorders by
   * its grip, so the breakage is invisible until you try to click a button.
   */
  setActivatorNodeRef: (node: HTMLElement | null) => void;
}>({
  listeners: undefined,
  isDragging: false,
  disabled: false,
  setActivatorNodeRef: () => undefined,
});

/** Reorders items when a drag ends on a different slot. */
export interface SortableRootProps<T> {
  value: T[];
  onValueChange: (value: T[]) => void;
  getItemValue: (item: T) => string;
  children: React.ReactNode;
  className?: string;
  strategy?: "vertical" | "grid";
  onDragStart?: (event: DragStartEvent) => void;
}

function Sortable<T>({
  value,
  onValueChange,
  getItemValue,
  children,
  className,
  strategy = "vertical",
  onDragStart,
}: SortableRootProps<T>) {
  const [activeId, setActiveId] = React.useState<UniqueIdentifier | null>(null);

  const sensors = useSensors(
    // A distance threshold keeps a click on a button inside a row from being
    // read as the start of a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const itemIds = React.useMemo(() => value.map(getItemValue), [value, getItemValue]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id);
    onDragStart?.(event);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over) {
      return;
    }

    const activeIndex = value.findIndex((item) => getItemValue(item) === active.id);
    const overIndex = value.findIndex((item) => getItemValue(item) === over.id);

    if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) {
      return;
    }

    onValueChange(arrayMove(value, activeIndex, overIndex));
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <SortableContext items={itemIds} strategy={strategy === "grid" ? rectSortingStrategy : verticalListSortingStrategy}>
        <div data-slot="sortable" data-dragging={activeId !== null} className={cn(className)}>
          {children}
        </div>
      </SortableContext>
    </DndContext>
  );
}

export interface SortableItemProps {
  value: string;
  asChild?: boolean;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

function SortableItem({ value, asChild = false, disabled = false, className, children }: SortableItemProps) {
  const { setNodeRef, setActivatorNodeRef, transform, transition, attributes, listeners, isDragging } = useSortable({
    id: value,
    disabled,
  });

  const style: React.CSSProperties = {
    transition,
    transform: CSS.Translate.toString(transform),
  };

  const Comp = asChild ? Slot : "div";

  return (
    <SortableItemContext.Provider value={{ listeners, isDragging, disabled, setActivatorNodeRef }}>
      <Comp
        data-slot="sortable-item"
        data-value={value}
        data-dragging={isDragging}
        data-disabled={disabled}
        ref={setNodeRef}
        style={style}
        className={cn(isDragging && "z-50 opacity-50", disabled && "opacity-60", className)}
        {...attributes}
      >
        {children}
      </Comp>
    </SortableItemContext.Provider>
  );
}

export interface SortableItemHandleProps {
  asChild?: boolean;
  className?: string;
  children?: React.ReactNode;
  cursor?: boolean;
  /** Accessible name, since a grip icon alone is not self-describing. */
  label?: string;
}

function SortableItemHandle({
  asChild = false,
  className,
  children,
  cursor = true,
  label,
}: SortableItemHandleProps) {
  const { listeners, isDragging, disabled, setActivatorNodeRef } = React.useContext(SortableItemContext);
  const Comp = asChild ? Slot : "div";

  return (
    <Comp
      data-slot="sortable-item-handle"
      data-dragging={isDragging}
      data-disabled={disabled}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-disabled={disabled || undefined}
      ref={setActivatorNodeRef}
      {...listeners}
      className={cn(
        cursor && (isDragging ? "cursor-grabbing" : "cursor-grab"),
        "touch-none select-none",
        className,
      )}
    >
      {children}
    </Comp>
  );
}

export { Sortable, SortableItem, SortableItemHandle };

"use client";

import {
  HTMLContainer,
  Rectangle2d,
  ShapeUtil,
  T,
  resizeBox,
  stopEventPropagation,
  useEditor,
  useIsEditing,
  type RecordProps,
  type TLBaseBoxShape,
  type TLResizeInfo,
  type TLShape,
} from "tldraw";
import { KeyRound, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * An ERD table on the canvas: a header with the table's name, then one row per column. The height
 * follows the number of rows, so only the width is stored and resizable. Double-click to edit.
 */

export const ENTITY_TABLE_TYPE = "entity-table";

export const HEADER_HEIGHT = 40;
export const ROW_HEIGHT = 32;
const MIN_WIDTH = 180;

export type EntityColumn = {
  id: string;
  name: string;
  type: string;
  isPrimaryKey: boolean;
};

export type EntityTableProps = {
  w: number;
  name: string;
  columns: EntityColumn[];
};

declare module "tldraw" {
  export interface TLGlobalShapePropsMap {
    [ENTITY_TABLE_TYPE]: EntityTableProps;
  }
}

export type EntityTableShape = TLShape<typeof ENTITY_TABLE_TYPE>;

export function entityTableHeight(rowCount: number) {
  // An empty table still keeps one row's worth of space, so it never collapses to a header.
  return HEADER_HEIGHT + Math.max(rowCount, 1) * ROW_HEIGHT;
}

export function newColumnId() {
  return Math.random().toString(36).slice(2, 10);
}

export class EntityTableShapeUtil extends ShapeUtil<EntityTableShape> {
  static override type = ENTITY_TABLE_TYPE;

  static override props: RecordProps<EntityTableShape> = {
    w: T.number,
    name: T.string,
    columns: T.arrayOf(
      T.object({
        id: T.string,
        name: T.string,
        type: T.string,
        isPrimaryKey: T.boolean,
      }),
    ),
  };

  override getDefaultProps(): EntityTableProps {
    return {
      w: 240,
      name: "table",
      columns: [
        { id: newColumnId(), name: "id", type: "uuid", isPrimaryKey: true },
        { id: newColumnId(), name: "created_at", type: "timestamp", isPrimaryKey: false },
      ],
    };
  }

  override canEdit() {
    return true;
  }

  override canResize() {
    return true;
  }

  override getGeometry(shape: EntityTableShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: entityTableHeight(shape.props.columns.length),
      isFilled: true,
    });
  }

  // Width follows the drag; height stays derived from the rows whatever the vertical drag does.
  override onResize(shape: EntityTableShape, info: TLResizeInfo<EntityTableShape>) {
    const asBox = (s: EntityTableShape) =>
      ({
        ...s,
        props: { ...s.props, h: entityTableHeight(s.props.columns.length) },
      }) as unknown as TLBaseBoxShape;
    const resized = resizeBox(asBox(shape), {
      ...info,
      initialShape: asBox(info.initialShape),
    } as unknown as TLResizeInfo<TLBaseBoxShape>);
    return {
      x: resized.x,
      y: resized.y,
      props: { w: Math.max(MIN_WIDTH, resized.props.w) },
    };
  }

  override component(shape: EntityTableShape) {
    return <EntityTable shape={shape} />;
  }

  override getIndicatorPath(shape: EntityTableShape) {
    const path = new Path2D();
    path.roundRect(0, 0, shape.props.w, entityTableHeight(shape.props.columns.length), 8);
    return path;
  }
}

function EntityTable({ shape }: { shape: EntityTableShape }) {
  const editor = useEditor();
  const isEditing = useIsEditing(shape.id);
  const { w, name, columns } = shape.props;

  const update = (props: Partial<EntityTableProps>) =>
    editor.updateShape<EntityTableShape>({ id: shape.id, type: ENTITY_TABLE_TYPE, props });

  const updateColumn = (id: string, patch: Partial<EntityColumn>) =>
    update({ columns: columns.map((c) => (c.id === id ? { ...c, ...patch } : c)) });

  // Inputs must keep their pointer and key events, or the canvas would treat them as its own.
  const inputEvents = {
    onPointerDown: stopEventPropagation,
    onKeyDown: (event: React.KeyboardEvent) => {
      // Escape still leaves edit mode; everything else stays in the input.
      if (event.key !== "Escape") event.stopPropagation();
    },
  };
  const inputClass =
    "min-w-0 rounded-sm bg-white/5 px-1.5 outline-none focus:bg-white/10 focus:ring-1 focus:ring-primary/60";

  return (
    <HTMLContainer
      className={cn(
        "overflow-hidden rounded-lg border bg-card text-card-foreground shadow-lg shadow-black/30",
        isEditing ? "border-primary/70" : "border-white/15",
      )}
      style={{
        width: w,
        height: entityTableHeight(columns.length),
        pointerEvents: isEditing ? "all" : "none",
      }}
    >
      <div
        className="flex items-center gap-2 border-b border-white/10 bg-primary/15 px-3 font-mono text-sm font-semibold"
        style={{ height: HEADER_HEIGHT }}
      >
        {isEditing ? (
          <input
            value={name}
            onChange={(e) => update({ name: e.target.value })}
            aria-label="Table name"
            className={cn(inputClass, "h-7 flex-1")}
            {...inputEvents}
          />
        ) : (
          <span className="truncate">{name || "untitled"}</span>
        )}
      </div>

      {columns.length === 0 && !isEditing && (
        <div
          className="flex items-center px-3 text-xs text-muted-foreground"
          style={{ height: ROW_HEIGHT }}
        >
          No columns
        </div>
      )}

      {columns.map((column) => (
        <div
          key={column.id}
          className="flex items-center gap-2 border-b border-white/5 px-3 font-mono text-xs last:border-b-0"
          style={{ height: ROW_HEIGHT }}
        >
          {isEditing ? (
            <>
              <button
                type="button"
                onPointerDown={stopEventPropagation}
                onClick={() => updateColumn(column.id, { isPrimaryKey: !column.isPrimaryKey })}
                aria-label="Toggle primary key"
                aria-pressed={column.isPrimaryKey}
                className={cn(
                  "shrink-0",
                  column.isPrimaryKey ? "text-primary" : "text-muted-foreground/40",
                )}
              >
                <KeyRound className="size-3.5" />
              </button>
              <input
                value={column.name}
                onChange={(e) => updateColumn(column.id, { name: e.target.value })}
                aria-label="Column name"
                className={cn(inputClass, "h-6 flex-1")}
                {...inputEvents}
              />
              <input
                value={column.type}
                onChange={(e) => updateColumn(column.id, { type: e.target.value })}
                aria-label="Column type"
                className={cn(inputClass, "h-6 w-20 text-muted-foreground")}
                {...inputEvents}
              />
              <button
                type="button"
                onPointerDown={stopEventPropagation}
                onClick={() => update({ columns: columns.filter((c) => c.id !== column.id) })}
                aria-label={`Remove ${column.name || "column"}`}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <X className="size-3.5" />
              </button>
            </>
          ) : (
            <>
              <KeyRound
                aria-hidden
                className={cn(
                  "size-3.5 shrink-0",
                  column.isPrimaryKey ? "text-primary" : "invisible",
                )}
              />
              <span className="truncate">{column.name}</span>
              <span className="ml-auto shrink-0 text-muted-foreground">{column.type}</span>
            </>
          )}
        </div>
      ))}

      {isEditing && (
        <button
          type="button"
          onPointerDown={stopEventPropagation}
          onClick={() =>
            update({
              columns: [
                ...columns,
                { id: newColumnId(), name: "", type: "text", isPrimaryKey: false },
              ],
            })
          }
          className="absolute right-2 bottom-1 flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[0.65rem] text-primary hover:bg-primary/10"
        >
          <Plus className="size-3" />
          Column
        </button>
      )}
    </HTMLContainer>
  );
}

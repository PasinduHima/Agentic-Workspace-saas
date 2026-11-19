"use client";

import { useState, type FocusEvent, type KeyboardEvent } from "react";
import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
  createShapePropsMigrationIds,
  createShapePropsMigrationSequence,
  resizeBox,
  stopEventPropagation,
  useEditor,
  useIsEditing,
  type RecordProps,
  type TLResizeInfo,
} from "tldraw";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ENTITY_TABLE_TYPE,
  HEADER_HEIGHT,
  ROW_HEIGHT,
  TABLE_WIDTH,
  getTableHeight,
  newRow,
  rowIndexAtY,
  type EntityRow,
  type EntityTableProps,
  type EntityTableShape,
} from "./EntityTableShape";

/*
 * An ERD table on the canvas (https://tldraw.dev/docs/shapes): a header with the table's name,
 * then one line per column with its type and PK/FK badges. `h` is stored, as for any box shape,
 * but always follows the row count, so only the width can be resized.
 *
 * Editing: double-click the table to rename it and add rows; double-click a row to edit its name
 * and type, toggle PK/FK, or delete it.
 *
 * The types, sizes and row math live in ./EntityTableShape.
 */

const MIN_WIDTH = 200;

// Tables saved before rows existed had `name` and `columns` ({ id, name, type, isPrimaryKey }).
const versions = createShapePropsMigrationIds(ENTITY_TABLE_TYPE, { RowsModel: 1 });

const migrations = createShapePropsMigrationSequence({
  sequence: [
    {
      id: versions.RowsModel,
      up: ({ name, columns, ...props }) => {
        const rows = (columns ?? []).map(
          (c: { id: string; name: string; type: string; isPrimaryKey: boolean }) => ({
            id: c.id,
            name: c.name,
            dataType: c.type,
            isPK: c.isPrimaryKey,
            isFK: false,
          }),
        );
        return { ...props, tableName: name ?? "table", rows, h: getTableHeight(rows.length) };
      },
    },
  ],
});

/** The same shape with `h` matched to its rows; used for every create and update. */
function withRowHeight(shape: EntityTableShape): EntityTableShape {
  const h = getTableHeight(shape.props.rows.length);
  return shape.props.h === h ? shape : { ...shape, props: { ...shape.props, h } };
}

export class EntityTableShapeUtil extends BaseBoxShapeUtil<EntityTableShape> {
  static override type = ENTITY_TABLE_TYPE;
  static override migrations = migrations;

  static override props: RecordProps<EntityTableShape> = {
    w: T.number,
    h: T.number,
    tableName: T.string,
    rows: T.arrayOf(
      T.object({
        id: T.string,
        name: T.string,
        dataType: T.string,
        isPK: T.boolean,
        isFK: T.boolean,
      }),
    ),
  };

  override getDefaultProps(): EntityTableProps {
    const rows = [
      newRow({ name: "id", dataType: "uuid", isPK: true }),
      newRow({ name: "created_at", dataType: "timestamptz" }),
    ];
    return { w: TABLE_WIDTH, h: getTableHeight(rows.length), tableName: "new_table", rows };
  }

  override canEdit() {
    return true;
  }

  // Whoever writes the shape (this UI, the agent, a paste, a collaborator), h follows the rows.
  override onBeforeCreate(next: EntityTableShape) {
    return withRowHeight(next);
  }

  override onBeforeUpdate(_prev: EntityTableShape, next: EntityTableShape) {
    return withRowHeight(next);
  }

  // Width only: the vertical part of a resize drag is ignored, so the top edge stays put too.
  override onResize(shape: EntityTableShape, info: TLResizeInfo<EntityTableShape>) {
    const resized = resizeBox(shape, info);
    return {
      x: resized.x,
      y: info.initialShape.y,
      props: {
        w: Math.max(MIN_WIDTH, resized.props.w),
        h: getTableHeight(shape.props.rows.length),
      },
    };
  }

  override component(shape: EntityTableShape) {
    return <EntityTable shape={shape} />;
  }

  override getIndicatorPath(shape: EntityTableShape) {
    const path = new Path2D();
    path.roundRect(0, 0, shape.props.w, shape.props.h, 8);
    return path;
  }
}

// Keeps typing inside inputs: without this the canvas would treat keys as shortcuts.
// Escape still goes through, so it leaves edit mode as usual.
function keepKeys(event: KeyboardEvent) {
  if (event.key !== "Escape") event.stopPropagation();
}

const inputClass =
  "min-w-0 rounded-sm bg-white/5 px-1.5 outline-none focus:bg-white/10 focus:ring-1 focus:ring-primary/60";

function Badge({ kind, active = true }: { kind: "PK" | "FK"; active?: boolean }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-sm px-1 text-[0.6rem] leading-4 font-semibold tracking-wide",
        !active
          ? "bg-white/5 text-muted-foreground/50"
          : kind === "PK"
            ? "bg-primary/20 text-primary"
            : "bg-sky-500/20 text-sky-300",
      )}
    >
      {kind}
    </span>
  );
}

function EntityTable({ shape }: { shape: EntityTableShape }) {
  const editor = useEditor();
  const isEditing = useIsEditing(shape.id);
  const { w, h, tableName, rows } = shape.props;
  const [openRowId, setOpenRowId] = useState<string | null>(null);

  // Entering edit mode by double-clicking a row opens that row straight away; leaving edit mode
  // closes it. Done while rendering (React's pattern for state that follows a changing value).
  const [wasEditing, setWasEditing] = useState(isEditing);
  if (isEditing !== wasEditing) {
    setWasEditing(isEditing);
    if (!isEditing) {
      setOpenRowId(null);
    } else {
      const point = editor.getPointInShapeSpace(shape, editor.inputs.getCurrentPagePoint());
      setOpenRowId(rows[rowIndexAtY(point.y, rows.length)]?.id ?? null);
    }
  }

  const update = (props: Partial<EntityTableProps>) =>
    editor.updateShape<EntityTableShape>({ id: shape.id, type: ENTITY_TABLE_TYPE, props });

  const updateRow = (id: string, patch: Partial<EntityRow>) =>
    update({ rows: rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) });

  const addRow = () => {
    const row = newRow();
    update({ rows: [...rows, row] });
    setOpenRowId(row.id);
  };

  const deleteRow = (id: string) => {
    update({ rows: rows.filter((r) => r.id !== id) });
    setOpenRowId(null);
  };

  // Close a row once focus leaves it (moving between its own inputs keeps it open).
  const closeRowOnBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpenRowId(null);
  };

  return (
    <HTMLContainer
      className={cn(
        "overflow-hidden rounded-lg border bg-card font-mono text-card-foreground shadow-lg shadow-black/30",
        isEditing ? "border-primary/70" : "border-white/15",
      )}
      style={{ width: w, height: h, pointerEvents: isEditing ? "all" : "none" }}
    >
      <div
        className="flex items-center gap-2 border-b border-white/10 bg-primary/15 px-3 text-sm font-semibold"
        style={{ height: HEADER_HEIGHT }}
      >
        {isEditing ? (
          <>
            <input
              value={tableName}
              onChange={(e) => update({ tableName: e.target.value })}
              onPointerDown={stopEventPropagation}
              onKeyDown={keepKeys}
              aria-label="Table name"
              placeholder="table_name"
              className={cn(inputClass, "h-7 flex-1")}
            />
            <button
              type="button"
              onPointerDown={stopEventPropagation}
              onClick={addRow}
              className="flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 text-[0.65rem] font-medium text-primary hover:bg-primary/10"
            >
              <Plus className="size-3" />
              Row
            </button>
          </>
        ) : (
          <span className="truncate">{tableName || "untitled"}</span>
        )}
      </div>

      {rows.length === 0 && (
        <div
          className="flex items-center px-3 text-xs text-muted-foreground"
          style={{ height: ROW_HEIGHT }}
        >
          {isEditing ? "Add a row to start" : "No columns"}
        </div>
      )}

      {rows.map((row) =>
        isEditing && openRowId === row.id ? (
          <div
            key={row.id}
            onBlur={closeRowOnBlur}
            className="flex items-center gap-1.5 border-b border-white/5 bg-white/3 px-2 text-xs last:border-b-0"
            style={{ height: ROW_HEIGHT }}
          >
            <input
              value={row.name}
              onChange={(e) => updateRow(row.id, { name: e.target.value })}
              onPointerDown={stopEventPropagation}
              onKeyDown={(e) => {
                keepKeys(e);
                if (e.key === "Enter") setOpenRowId(null);
              }}
              aria-label="Column name"
              placeholder="column"
              autoFocus
              className={cn(inputClass, "h-6 flex-1")}
            />
            <input
              value={row.dataType}
              onChange={(e) => updateRow(row.id, { dataType: e.target.value })}
              onPointerDown={stopEventPropagation}
              onKeyDown={(e) => {
                keepKeys(e);
                if (e.key === "Enter") setOpenRowId(null);
              }}
              aria-label="Column type"
              placeholder="type"
              className={cn(inputClass, "h-6 w-20 text-muted-foreground")}
            />
            {(["PK", "FK"] as const).map((kind) => {
              const key = kind === "PK" ? "isPK" : "isFK";
              return (
                <button
                  key={kind}
                  type="button"
                  onPointerDown={stopEventPropagation}
                  onClick={() => updateRow(row.id, { [key]: !row[key] })}
                  aria-pressed={row[key]}
                  aria-label={kind === "PK" ? "Primary key" : "Foreign key"}
                >
                  <Badge kind={kind} active={row[key]} />
                </button>
              );
            })}
            <button
              type="button"
              onPointerDown={stopEventPropagation}
              onClick={() => deleteRow(row.id)}
              aria-label={`Delete ${row.name || "row"}`}
              className="shrink-0 text-muted-foreground hover:text-destructive"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <div
            key={row.id}
            onDoubleClick={(e) => {
              if (!isEditing) return;
              e.stopPropagation();
              setOpenRowId(row.id);
            }}
            className={cn(
              "flex items-center gap-1.5 border-b border-white/5 px-3 text-xs last:border-b-0",
              isEditing && "cursor-text hover:bg-white/3",
            )}
            style={{ height: ROW_HEIGHT }}
            title={isEditing ? "Double-click to edit" : undefined}
          >
            <span className={cn("truncate", !row.name && "text-muted-foreground italic")}>
              {row.name || "unnamed"}
            </span>
            {row.isPK && <Badge kind="PK" />}
            {row.isFK && <Badge kind="FK" />}
            <span className="ml-auto shrink-0 pl-2 text-muted-foreground">{row.dataType}</span>
          </div>
        ),
      )}
    </HTMLContainer>
  );
}

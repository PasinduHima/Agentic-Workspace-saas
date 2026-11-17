"use client";

import {
  Box,
  createShapeId,
  renderPlaintextFromRichText,
  toRichText,
  type Editor,
  type TLArrowBinding,
  type TLArrowShape,
  type TLGeoShape,
  type TLShapeId,
  type TLShapePartial,
} from "tldraw";
import type { BlockNoteEditor } from "@blocknote/core";
import {
  ENTITY_TABLE_TYPE,
  HEADER_HEIGHT,
  ROW_HEIGHT,
  entityTableHeight,
  newRowId,
  type EntityRow,
  type EntityTableShape,
} from "@/components/EntityTable/EntityTableShapeUtil";
import type {
  AgentContext,
  DrawDiagramInput,
  DrawTablesInput,
  EditCanvasInput,
  WriteDocInput,
} from "./tools";

// Pause between shapes, so the agent visibly draws the diagram rather than it appearing at once.
const DRAW_STEP_MS = 90;
const NODE_HEIGHT = 72;
const LAYER_GAP = 90;
const SIBLING_GAP = 50;
// Where new drawings go relative to what's already on the canvas.
const PLACEMENT_GAP = 160;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function nodeWidth(label: string) {
  return Math.min(260, Math.max(130, label.length * 9 + 48));
}

/** New drawings go to the right of existing content, or in the middle of the view on an empty page. */
function placementOrigin(editor: Editor) {
  const content = editor.getCurrentPageBounds();
  if (content) return { x: content.maxX + PLACEMENT_GAP, y: content.minY };
  const view = editor.getViewportPageBounds();
  return { x: view.minX + 80, y: view.minY + 80 };
}

function connect(
  editor: Editor,
  fromId: TLShapeId,
  toId: TLShapeId,
  label: string | undefined,
  anchors?: { from: { x: number; y: number }; to: { x: number; y: number } },
) {
  const arrowId = createShapeId();
  editor.createShape<TLArrowShape>({
    id: arrowId,
    type: "arrow",
    x: 0,
    y: 0,
    props: { richText: toRichText(label ?? "") },
  });
  // Bound arrows follow their shapes when either is moved.
  editor.createBindings<TLArrowBinding>(
    (["start", "end"] as const).map((terminal) => ({
      type: "arrow",
      fromId: arrowId,
      toId: terminal === "start" ? fromId : toId,
      props: {
        terminal,
        normalizedAnchor: anchors
          ? terminal === "start"
            ? anchors.from
            : anchors.to
          : { x: 0.5, y: 0.5 },
        isExact: false,
        isPrecise: !!anchors,
        snap: "none",
      },
    })),
  );
  return arrowId;
}

// Layers nodes by their longest distance from a root, so every edge points down (or right).
function layerNodes(keys: string[], edges: { from: string; to: string }[]) {
  const layer = new Map(keys.map((key) => [key, 0]));
  // Relaxing |nodes| times settles any acyclic graph; cycles just stop growing at that bound.
  for (let pass = 0; pass < keys.length; pass++) {
    let changed = false;
    for (const { from, to } of edges) {
      const next = (layer.get(from) ?? 0) + 1;
      if (layer.has(to) && from !== to && next > (layer.get(to) ?? 0) && next < keys.length) {
        layer.set(to, next);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const layers: string[][] = [];
  for (const key of keys) (layers[layer.get(key) ?? 0] ??= []).push(key);
  return layers.filter(Boolean);
}

export async function drawDiagram(editor: Editor, input: DrawDiagramInput) {
  const nodes = new Map(input.nodes.map((node) => [node.key, node]));
  const edges = input.edges.filter((e) => nodes.has(e.from) && nodes.has(e.to));
  const layers = layerNodes([...nodes.keys()], edges);
  const down = input.direction === "down";
  const origin = placementOrigin(editor);

  // Lay every node out first, so the camera can frame the whole diagram before drawing starts.
  const placed = new Map<string, { x: number; y: number; w: number; h: number }>();
  const breadths = layers.map((keys) =>
    keys.reduce(
      (sum, key, i) =>
        sum + (down ? nodeWidth(nodes.get(key)!.label) : NODE_HEIGHT) + (i ? SIBLING_GAP : 0),
      0,
    ),
  );
  const maxBreadth = Math.max(...breadths);
  let depth = 0;
  layers.forEach((keys, i) => {
    let offset = (maxBreadth - breadths[i]) / 2;
    const layerDepth = down ? NODE_HEIGHT : Math.max(...keys.map((k) => nodeWidth(nodes.get(k)!.label)));
    for (const key of keys) {
      const w = nodeWidth(nodes.get(key)!.label);
      placed.set(
        key,
        down
          ? { x: origin.x + offset, y: origin.y + depth, w, h: NODE_HEIGHT }
          : { x: origin.x + depth, y: origin.y + offset, w, h: NODE_HEIGHT },
      );
      offset += (down ? w : NODE_HEIGHT) + SIBLING_GAP;
    }
    depth += layerDepth + LAYER_GAP;
  });

  const all = [...placed.values()];
  const bounds = Box.Common(all.map((p) => new Box(p.x, p.y, p.w, p.h)));
  editor.zoomToBounds(bounds, { inset: 64, animation: { duration: 300 } });

  const ids = new Map<string, TLShapeId>();
  for (const node of input.nodes) {
    const p = placed.get(node.key)!;
    const id = createShapeId();
    editor.createShape<TLGeoShape>({
      id,
      type: "geo",
      x: p.x,
      y: p.y,
      props: { geo: node.shape, w: p.w, h: p.h, richText: toRichText(node.label), fill: "semi" },
    });
    ids.set(node.key, id);
    await sleep(DRAW_STEP_MS);
  }
  for (const edge of edges) {
    connect(editor, ids.get(edge.from)!, ids.get(edge.to)!, edge.label);
    await sleep(DRAW_STEP_MS / 2);
  }

  return {
    drawn: input.nodes.length,
    connected: edges.length,
    skippedEdges: input.edges.length - edges.length,
    shapeIds: Object.fromEntries(ids),
  };
}

function rowAnchor(table: EntityTableShape, column: string, side: 0 | 1) {
  const index = table.props.rows.findIndex((r) => r.name === column);
  // An unknown column points at the table header instead.
  const y = index === -1 ? HEADER_HEIGHT / 2 : HEADER_HEIGHT + (index + 0.5) * ROW_HEIGHT;
  return { x: side, y: y / table.props.h };
}

type ColumnInput = { name: string; type: string; primaryKey?: boolean; foreignKey?: boolean };

function toRows(columns: ColumnInput[], foreignKeys: Set<string> = new Set()): EntityRow[] {
  return columns.map((c) => ({
    id: newRowId(),
    name: c.name,
    dataType: c.type,
    isPK: !!c.primaryKey,
    isFK: !!c.foreignKey || foreignKeys.has(c.name),
  }));
}

export async function drawTables(editor: Editor, input: DrawTablesInput) {
  const origin = placementOrigin(editor);
  const perRow = Math.ceil(Math.sqrt(input.tables.length));
  const width = 260;
  const gap = 140;

  // Each grid row is as tall as its tallest table.
  const rowHeights: number[] = [];
  input.tables.forEach((t, i) => {
    const row = Math.floor(i / perRow);
    rowHeights[row] = Math.max(rowHeights[row] ?? 0, entityTableHeight(t.columns.length));
  });

  const placed = input.tables.map((t, i) => {
    const row = Math.floor(i / perRow);
    const y = rowHeights.slice(0, row).reduce((sum, h) => sum + h + gap, 0);
    return { x: origin.x + (i % perRow) * (width + gap), y: origin.y + y, table: t };
  });
  const bounds = Box.Common(
    placed.map((p) => new Box(p.x, p.y, width, entityTableHeight(p.table.columns.length))),
  );
  editor.zoomToBounds(bounds, { inset: 64, animation: { duration: 300 } });

  const ids = new Map<string, TLShapeId>();
  for (const { x, y, table } of placed) {
    // A column named as the source of a relation is a foreign key.
    const foreignKeys = new Set(
      input.relations.filter((r) => r.fromTable === table.name).map((r) => r.fromColumn),
    );
    const id = createShapeId();
    editor.createShape<EntityTableShape>({
      id,
      type: ENTITY_TABLE_TYPE,
      x,
      y,
      props: {
        w: width,
        h: entityTableHeight(table.columns.length),
        tableName: table.name,
        rows: toRows(table.columns, foreignKeys),
      },
    });
    ids.set(table.name, id);
    await sleep(DRAW_STEP_MS * 2);
  }

  let connected = 0;
  for (const rel of input.relations) {
    const fromId = ids.get(rel.fromTable);
    const toId = ids.get(rel.toTable);
    if (!fromId || !toId) continue;
    const from = editor.getShape<EntityTableShape>(fromId)!;
    const to = editor.getShape<EntityTableShape>(toId)!;
    // Leave from the side facing the other table.
    const fromSide = from.x <= to.x ? 1 : 0;
    connect(editor, fromId, toId, undefined, {
      from: rowAnchor(from, rel.fromColumn, fromSide),
      to: rowAnchor(to, rel.toColumn, fromSide === 1 ? 0 : 1),
    });
    connected++;
    await sleep(DRAW_STEP_MS / 2);
  }

  return { tables: input.tables.length, relations: connected, shapeIds: Object.fromEntries(ids) };
}

export function editCanvas(editor: Editor, input: EditCanvasInput) {
  const missing: string[] = [];
  editor.run(() => {
    for (const update of input.updates) {
      const shape = editor.getShape(update.id as TLShapeId);
      if (!shape) {
        missing.push(update.id);
        continue;
      }
      if (shape.type === ENTITY_TABLE_TYPE) {
        editor.updateShape<EntityTableShape>({
          id: shape.id,
          type: ENTITY_TABLE_TYPE,
          props: {
            ...(update.tableName !== undefined && { tableName: update.tableName }),
            ...(update.columns && { rows: toRows(update.columns) }),
          },
        });
      } else if (update.label !== undefined && "richText" in shape.props) {
        // Geo, arrow, text and note shapes all keep their label in `richText`.
        editor.updateShape({
          id: shape.id,
          type: shape.type,
          props: { richText: toRichText(update.label) },
        } as TLShapePartial);
      }
    }
    const toDelete = input.deleteIds.filter((id) => {
      const exists = !!editor.getShape(id as TLShapeId);
      if (!exists) missing.push(id);
      return exists;
    });
    editor.deleteShapes(toDelete as TLShapeId[]);
  });
  return { updated: input.updates.length, deleted: input.deleteIds.length, missingIds: missing };
}

export function writeDoc(editor: BlockNoteEditor, input: WriteDocInput) {
  const blocks = editor.tryParseMarkdownToBlocks(input.markdown);
  const current = editor.document;
  // A brand-new doc is one empty paragraph: replace it rather than append after it.
  const isEmpty =
    current.length === 1 &&
    current[0].type === "paragraph" &&
    (current[0].content as unknown[]).length === 0;

  if (input.mode === "replace" || isEmpty) {
    editor.replaceBlocks(current, blocks);
  } else {
    editor.insertBlocks(blocks, current[current.length - 1], "after");
  }
  return { blocks: blocks.length, mode: isEmpty ? "replace" : input.mode };
}

const MAX_CONTEXT_SHAPES = 300;
const MAX_DOC_CHARS = 12_000;

/** A compact, model-readable snapshot of the canvas and doc, sent with every request. */
export function buildAgentContext(
  canvas: Editor | null,
  doc: BlockNoteEditor | null,
): AgentContext {
  let shapes: unknown[] | null = null;
  if (canvas) {
    shapes = canvas
      .getCurrentPageShapes()
      .slice(0, MAX_CONTEXT_SHAPES)
      .map((shape) => {
        const base = { id: shape.id, type: shape.type, x: Math.round(shape.x), y: Math.round(shape.y) };
        if (shape.type === ENTITY_TABLE_TYPE) {
          const { tableName, rows } = (shape as EntityTableShape).props;
          return {
            ...base,
            tableName,
            columns: rows.map((r) => {
              const keys = [r.isPK && "pk", r.isFK && "fk"].filter(Boolean).join(", ");
              return `${r.name}: ${r.dataType}${keys ? ` (${keys})` : ""}`;
            }),
          };
        }
        if (shape.type === "arrow") {
          const bindings = canvas.getBindingsFromShape<TLArrowBinding>(shape, "arrow");
          return {
            ...base,
            label: renderPlaintextFromRichText(canvas, (shape as TLArrowShape).props.richText),
            from: bindings.find((b) => b.props.terminal === "start")?.toId ?? null,
            to: bindings.find((b) => b.props.terminal === "end")?.toId ?? null,
          };
        }
        if ("richText" in shape.props) {
          return {
            ...base,
            ...(shape.type === "geo" && { geo: (shape as TLGeoShape).props.geo }),
            label: renderPlaintextFromRichText(canvas, (shape as TLGeoShape).props.richText),
          };
        }
        return base;
      });
  }

  let markdown: string | null = null;
  if (doc) {
    markdown = doc.blocksToMarkdownLossy(doc.document);
    if (markdown.length > MAX_DOC_CHARS) {
      markdown = `${markdown.slice(0, MAX_DOC_CHARS)}\n\n[â€¦doc truncated]`;
    }
  }

  return { canvas: shapes, doc: markdown };
}

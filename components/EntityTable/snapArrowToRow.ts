import type { Editor, TLArrowBinding, TLBinding } from "tldraw";
import {
  ENTITY_TABLE_TYPE,
  HEADER_HEIGHT,
  ROW_HEIGHT,
  type EntityTableShape,
} from "./EntityTableShapeUtil";

/**
 * The anchor an arrow end should use on a table: the nearer side edge, at the middle of the row
 * under `anchor`. Returns null for the header (the arrow then points at the table as a whole) or
 * an empty table.
 */
export function rowAnchorFor(table: EntityTableShape, anchor: { x: number; y: number }) {
  const { rows, h } = table.props;
  const y = anchor.y * h;
  if (rows.length === 0 || y < HEADER_HEIGHT) return null;

  const row = Math.min(rows.length - 1, Math.floor((y - HEADER_HEIGHT) / ROW_HEIGHT));
  return {
    x: anchor.x < 0.5 ? 0 : 1,
    y: (HEADER_HEIGHT + (row + 0.5) * ROW_HEIGHT) / h,
  };
}

/**
 * Snaps arrow ends drawn onto a table to the nearest row, so relationships point at real
 * columns. Runs before a binding is stored, so the snapped anchor is what gets saved and synced
 * (no second write), and it also re-snaps while an arrow end is dragged to another row.
 * Bindings from collaborators arrive already snapped and pass through. Returns a cleanup.
 */
export function registerEntityTableArrowSnapping(editor: Editor) {
  const snap = <B extends TLBinding>(binding: B, source: "remote" | "user"): B => {
    if (source !== "user" || binding.type !== "arrow") return binding;

    const arrow = binding as TLArrowBinding;
    const target = editor.getShape(arrow.toId);
    if (target?.type !== ENTITY_TABLE_TYPE) return binding;

    const anchor = rowAnchorFor(target as EntityTableShape, arrow.props.normalizedAnchor);
    if (!anchor) return binding;

    return {
      ...arrow,
      props: { ...arrow.props, normalizedAnchor: anchor, isPrecise: true, isExact: false },
    } as B;
  };

  const stopCreate = editor.sideEffects.registerBeforeCreateHandler("binding", (binding, source) =>
    snap(binding, source),
  );
  const stopChange = editor.sideEffects.registerBeforeChangeHandler(
    "binding",
    (_prev, next, source) => snap(next, source),
  );

  return () => {
    stopCreate();
    stopChange();
  };
}

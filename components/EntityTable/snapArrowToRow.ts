import type { Editor, TLArrowBinding } from "tldraw";
import {
  ENTITY_TABLE_TYPE,
  HEADER_HEIGHT,
  ROW_HEIGHT,
  entityTableHeight,
  type EntityTableShape,
} from "./EntityTableShapeUtil";

/**
 * When an arrow is attached to an ERD table, moves its end to the left or right edge (whichever
 * is nearer) of the row it was dropped on, so relationships point at a column, not the middle of
 * the table. Arrows dropped on the header stay attached to the table as a whole.
 */
export function snapArrowBindingToRow(editor: Editor, binding: TLArrowBinding) {
  const target = editor.getShape(binding.toId);
  if (!target || target.type !== ENTITY_TABLE_TYPE) return;

  const { columns } = (target as EntityTableShape).props;
  if (columns.length === 0) return;

  const height = entityTableHeight(columns.length);
  const { normalizedAnchor } = binding.props;
  const y = normalizedAnchor.y * height;
  if (y < HEADER_HEIGHT) return;

  const row = Math.min(columns.length - 1, Math.floor((y - HEADER_HEIGHT) / ROW_HEIGHT));
  const rowCenter = HEADER_HEIGHT + (row + 0.5) * ROW_HEIGHT;

  editor.updateBinding<TLArrowBinding>({
    id: binding.id,
    type: "arrow",
    props: {
      ...binding.props,
      normalizedAnchor: { x: normalizedAnchor.x < 0.5 ? 0 : 1, y: rowCenter / height },
      isPrecise: true,
      isExact: false,
    },
  });
}

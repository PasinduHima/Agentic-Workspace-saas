import type { TLShape } from "tldraw";

/*
 * The ERD table shape's types and geometry, kept apart from the React shape util so anything
 * (the agent, arrow snapping, the toolbar button) can lay tables out or anchor arrows on a row
 * without importing the component. All of the table's height and row math lives here.
 */

export const ENTITY_TABLE_TYPE = "entity-table";

/** Height of the header that shows the table name. */
export const HEADER_HEIGHT = 40;
/** Height of each column's row. */
export const ROW_HEIGHT = 32;
/** Width of a new table. */
export const TABLE_WIDTH = 260;

export type EntityRow = {
  id: string;
  name: string;
  dataType: string;
  isPK: boolean;
  isFK: boolean;
};

export type EntityTableProps = {
  w: number;
  h: number;
  tableName: string;
  rows: EntityRow[];
};

declare module "tldraw" {
  export interface TLGlobalShapePropsMap {
    [ENTITY_TABLE_TYPE]: EntityTableProps;
  }
}

export type EntityTableShape = TLShape<typeof ENTITY_TABLE_TYPE>;

/** Header plus one line per row. An empty table keeps one row's worth of space. */
export function getTableHeight(rowCount: number) {
  return HEADER_HEIGHT + Math.max(rowCount, 1) * ROW_HEIGHT;
}

/** A complete row with a fresh id: defaults, overridden by whatever is passed in. */
export function newRow(row?: Partial<EntityRow>): EntityRow {
  return {
    name: "",
    dataType: "text",
    isPK: false,
    isFK: false,
    ...row,
    // Always new, even when `row` carries one: two rows must never share an id.
    id: crypto.randomUUID(),
  };
}

/**
 * The vertical centre of a row, as a 0–1 fraction of the table's height: the `y` of an arrow's
 * `normalizedAnchor` when it should point at that row.
 */
export function rowAnchorY(rowIndex: number, rowCount: number) {
  return (HEADER_HEIGHT + (rowIndex + 0.5) * ROW_HEIGHT) / getTableHeight(rowCount);
}

/**
 * Which row is at `y` (in the table's own space, 0 = top), or -1 for the header or an empty table.
 * Points below the last row count as the last row.
 */
export function rowIndexAtY(y: number, rowCount: number) {
  if (rowCount === 0 || y < HEADER_HEIGHT) return -1;
  return Math.min(rowCount - 1, Math.floor((y - HEADER_HEIGHT) / ROW_HEIGHT));
}

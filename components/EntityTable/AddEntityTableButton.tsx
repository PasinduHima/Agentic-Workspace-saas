"use client";

import { TldrawUiMenuItem, createShapeId, useEditor } from "tldraw";
import { Table2 } from "lucide-react";
import {
  ENTITY_TABLE_TYPE,
  entityTableHeight,
  type EntityTableShape,
} from "./EntityTableShapeUtil";

// Toolbar button that drops a new ERD table in the middle of the view and selects it.
export function AddEntityTableButton() {
  const editor = useEditor();

  const addTable = () => {
    const id = createShapeId();
    const center = editor.getViewportPageBounds().center;
    const util = editor.getShapeUtil<EntityTableShape>(ENTITY_TABLE_TYPE);
    const props = util.getDefaultProps();

    editor.markHistoryStoppingPoint("add entity table");
    editor.createShape<EntityTableShape>({
      id,
      type: ENTITY_TABLE_TYPE,
      x: center.x - props.w / 2,
      y: center.y - entityTableHeight(props.columns.length) / 2,
      props,
    });
    editor.select(id);
    editor.setCurrentTool("select");
  };

  return (
    <TldrawUiMenuItem
      id="add-entity-table"
      label="Add table"
      icon={<Table2 className="size-4.5" />}
      onSelect={addTable}
    />
  );
}

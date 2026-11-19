"use client";

import { Tldraw, type Editor, type TLComponents, type TLEditorSnapshot } from "tldraw";
import "tldraw/tldraw.css";
import { EntityTableShapeUtil } from "@/components/EntityTable/EntityTableShapeUtil";

const shapeUtils = [EntityTableShapeUtil];

// Only what a reader needs: pan/zoom and the read-only toolbar.
const components: TLComponents = {
  StylePanel: null,
  PageMenu: null,
  MainMenu: null,
};

/**
 * A read-only canvas for the public share page: the saved snapshot, with no sync room, so
 * visitors see what was last saved and can't change anything.
 */
export function CanvasViewer({ snapshot }: { snapshot: TLEditorSnapshot | null }) {
  const handleMount = (editor: Editor) => {
    editor.updateInstanceState({ isReadonly: true });
    editor.zoomToFit();
  };

  return (
    // isolate keeps tldraw's high z-index layers inside the panel.
    <div className="isolate h-full">
      <Tldraw
        snapshot={snapshot ?? undefined}
        shapeUtils={shapeUtils}
        components={components}
        onMount={handleMount}
        colorScheme="dark"
        licenseKey={process.env.NEXT_PUBLIC_TLDRAW_LICENSE_KEY}
      />
    </div>
  );
}

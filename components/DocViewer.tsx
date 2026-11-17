"use client";

import type { Block } from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { outpostDarkTheme } from "@/lib/blocknote-theme";

/**
 * A read-only doc, for the public share page: the saved blocks rendered with the same editor and
 * theme as the workspace, but not editable and with no live collaboration.
 */
export function DocViewer({ content }: { content: Block[] | null }) {
  const editor = useCreateBlockNote({
    initialContent: content?.length ? content : undefined,
  });

  if (!content?.length) {
    return <p className="p-8 text-sm text-muted-foreground">This doc is empty.</p>;
  }

  return (
    <div className="h-full overflow-y-auto pt-6">
      <BlockNoteView
        editor={editor}
        editable={false}
        theme={outpostDarkTheme}
        // Menus and toolbars are for editing; a reader doesn't need them.
        formattingToolbar={false}
        linkToolbar={false}
        sideMenu={false}
        slashMenu={false}
        tableHandles={false}
      />
    </div>
  );
}

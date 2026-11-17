"use client";

import { Block } from "@blocknote/core";
import React, { useEffect } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { useWorkspaceEditors } from "@/components/WorkspaceEditorsContext";
import { BlockNoteView } from "@blocknote/mantine";
import { outpostDarkTheme } from "@/lib/blocknote-theme";


type DocEditorProps = {
    workspaceId: string;
    initialContent: Block[] | null;
}

const SAVE_DEBOUNCE_MS = 1000;

const DocEditor = ({ workspaceId, initialContent}: DocEditorProps) => {

    const editor = useCreateBlockNote({
        initialContent: initialContent?.length ? initialContent : undefined,
    });

    const { setDocEditor } = useWorkspaceEditors();

        useEffect(() => {
            setDocEditor(editor);
            return ()=> setDocEditor(null);
        }, [editor, setDocEditor]);

    return <div className="h-full overflow-y-auto pt-6">
        {/* Renders the editor UI in our dark colors. */}
        <BlockNoteView editor={editor} theme={outpostDarkTheme} />
    </div>;
};

export default DocEditor;
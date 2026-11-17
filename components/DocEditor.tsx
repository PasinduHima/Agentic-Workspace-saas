"use client";

import { useEffect, useMemo, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import * as Y from "yjs";
import type { Block } from "@blocknote/core";
import { withCollaboration } from "@blocknote/core/yjs";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { saveDocContent } from "@/actions/doc";
import { useWorkspaceEditors } from "@/components/WorkspaceEditorsContext";
import { getSupabaseClient } from "@/lib/supabase-client";
import { SupabaseYjsProvider, fromBase64, toBase64 } from "@/lib/yjs-supabase-provider";
import { colorForUser } from "@/lib/utils";

const SAVE_DEBOUNCE_MS = 1000;

type DocEditorProps = {
  workspaceId: string;
  /** BlockNote JSON, used to seed a doc that has no Yjs state yet. */
  initialContent: Block[] | null;
  /** The saved Yjs document, base64-encoded. */
  initialState: string | null;
};

// Waits for Clerk so the editor is created once, with the real name on this user's cursor.
export function DocEditor(props: DocEditorProps) {
  const { user, isLoaded } = useUser();
  if (!isLoaded) return null;

  const name = user?.fullName || user?.username || "Anonymous";
  const color = colorForUser(user?.id ?? "anonymous");
  return <CollaborativeDocEditor {...props} userName={name} userColor={color} />;
}

function CollaborativeDocEditor({
  workspaceId,
  initialContent,
  initialState,
  userName,
  userColor,
}: DocEditorProps & { userName: string; userColor: string }) {
  const { setDocEditor } = useWorkspaceEditors();

  // The Y.Doc starts from the saved state, so the editor opens with the content already there.
  const doc = useMemo(() => {
    const ydoc = new Y.Doc();
    if (initialState) Y.applyUpdate(ydoc, fromBase64(initialState));
    return ydoc;
  }, [initialState]);

  // Live collaboration over Supabase Realtime; without Supabase the doc still works, single-user.
  const provider = useMemo(() => {
    const supabase = getSupabaseClient();
    return supabase ? new SupabaseYjsProvider(supabase, doc, `doc-${workspaceId}`) : null;
  }, [doc, workspaceId]);
  useEffect(() => () => provider?.destroy(), [provider]);

  const editor = useCreateBlockNote(
    withCollaboration({
      collaboration: {
        fragment: doc.getXmlFragment("document-store"),
        user: { name: userName, color: userColor },
        provider: provider ?? undefined,
        showCursorLabels: "activity",
      },
    }),
    [doc, provider],
  );

  // A doc saved before collaboration existed has blocks but no Yjs state: copy them in once.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || initialState || !initialContent?.length) return;
    seeded.current = true;
    editor.replaceBlocks(editor.document, initialContent);
  }, [editor, initialContent, initialState]);

  // Lets the agent panel and the Share dialog reach this editor.
  useEffect(() => {
    setDocEditor(editor);
    return () => setDocEditor(null);
  }, [editor, setDocEditor]);

  // Save local edits to Postgres. Changes from the room are saved by the person who made them.
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const onUpdate = (_update: Uint8Array, origin: unknown) => {
      if (provider && origin === provider) return;
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        saveDocContent(
          workspaceId,
          // JSON round-trip: blocks can hold undefined fields, which Prisma's Json type rejects.
          JSON.parse(JSON.stringify(editor.document)),
          toBase64(Y.encodeStateAsUpdate(doc)),
        ).catch(() => {
          // A failed autosave is retried by the next edit; the room still has the change.
        });
      }, SAVE_DEBOUNCE_MS);
    };
    doc.on("update", onUpdate);
    return () => {
      clearTimeout(timeout);
      doc.off("update", onUpdate);
    };
  }, [doc, editor, provider, workspaceId]);

  return (
    <div className="h-full overflow-y-auto py-6">
      <BlockNoteView editor={editor} theme="dark" />
    </div>
  );
}

"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { updateWorkspace } from "@/actions/workspace";
import { cn } from "@/lib/utils";

const MAX_NAME_LENGTH = 80;

/**
 * The workspace name in the header, renamed in place: click it to edit, Enter or clicking away
 * saves, Escape cancels. The new name shows straight away and rolls back if the save fails.
 */
export function EditableWorkspaceName({
  workspaceId,
  initialName,
  className,
}: {
  workspaceId: string;
  initialName: string;
  className?: string;
}) {
  const [name, setName] = useState(initialName);
  const [draft, setDraft] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  // Escape then blur would otherwise save the draft it just discarded.
  const cancelledRef = useRef(false);

  // Pick up a rename made elsewhere (e.g. the board's edit dialog) when the server re-renders.
  const [prevInitialName, setPrevInitialName] = useState(initialName);
  if (initialName !== prevInitialName) {
    setPrevInitialName(initialName);
    setName(initialName);
    if (!editing) setDraft(initialName);
  }

  const startEditing = () => {
    cancelledRef.current = false;
    setDraft(name);
    setEditing(true);
  };

  const save = async () => {
    setEditing(false);
    if (cancelledRef.current) return;

    const next = draft.trim();
    // An empty name isn't allowed, so treat it like a cancel rather than an error.
    if (!next || next === name) return;

    const previous = name;
    setName(next);
    setSaving(true);
    try {
      // No description argument: the action keeps the existing one.
      await updateWorkspace(workspaceId, next);
    } catch {
      setName(previous);
      toast.error("Couldn't rename the workspace. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelledRef.current = true;
      event.currentTarget.blur();
    }
  };

  if (editing) {
    return (
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={save}
        onKeyDown={onKeyDown}
        onFocus={(event) => event.currentTarget.select()}
        maxLength={MAX_NAME_LENGTH}
        aria-label="Workspace name"
        autoFocus
        className={cn(
          "h-8 w-full max-w-xs min-w-0 rounded-md border border-input bg-input/30 px-2 text-sm font-medium outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          className,
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      disabled={saving}
      title="Rename workspace"
      className={cn(
        "group flex h-8 max-w-xs min-w-0 items-center gap-2 rounded-md px-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-70",
        className,
      )}
    >
      <span className="truncate">{name}</span>
      <Pencil
        aria-hidden
        className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      />
    </button>
  );
}

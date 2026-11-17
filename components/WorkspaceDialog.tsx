"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { updateWorkspace } from "@/actions/workspace";
import { useFetch } from "@/hooks/use-fetch";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateWorkspace } from "@/lib/use-create-workspace";

type WorkspaceDialogProps =
  // Create: opens from its own trigger.
  | { trigger: ReactNode; workspace?: never; open?: never; onOpenChange?: never }
  // Edit: opened by the parent (e.g. a card's menu), prefilled from `workspace`.
  | {
      workspace: { id: string; name: string; description: string | null };
      open: boolean;
      onOpenChange: (open: boolean) => void;
      trigger?: never;
    };

// New-workspace and edit-workspace form in one dialog; passing `workspace` switches it to edit.
export function WorkspaceDialog(props: WorkspaceDialogProps) {
  const { workspace } = props;
  const isEdit = !!workspace;

  const [ownOpen, setOwnOpen] = useState(false);
  const open = isEdit ? props.open : ownOpen;
  const setOpen = isEdit ? props.onOpenChange : setOwnOpen;

  const { create, isPending: isCreating } = useCreateWorkspace();
  const { fn: updateWorkspaceFn, loading: isUpdating } = useFetch(updateWorkspace);
  const busy = isCreating || !!isUpdating;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "");
    const description = String(form.get("description") ?? "");

    if (!isEdit) {
      create({ name, description }, () => setOpen(false));
      return;
    }

    if (!name.trim()) {
      toast.error("Give the workspace a name.");
      return;
    }
    if (await updateWorkspaceFn(workspace.id, name, description)) {
      toast.success("Workspace updated");
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isEdit && <DialogTrigger asChild>{props.trigger}</DialogTrigger>}
      <DialogContent>
        {/* Keyed by workspace so the uncontrolled fields re-fill when a different one is edited. */}
        <form key={workspace?.id ?? "new"} onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit workspace" : "New workspace"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Rename it or change what it's for."
                : "A workspace pairs one doc with one canvas."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="workspace-name">Name</Label>
            <Input
              id="workspace-name"
              name="name"
              defaultValue={workspace?.name}
              placeholder="Checkout flow"
              maxLength={80}
              required
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="workspace-description">Description (optional)</Label>
            <Textarea
              id="workspace-description"
              name="description"
              defaultValue={workspace?.description ?? ""}
              placeholder="What is this workspace for?"
              maxLength={2000}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {isEdit
                ? isUpdating
                  ? "Saving…"
                  : "Save changes"
                : isCreating
                  ? "Creating…"
                  : "Create workspace"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

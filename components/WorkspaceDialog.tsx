"use client";

import { useState, type FormEvent, type ReactNode } from "react";
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

// "New workspace" form in a dialog. `trigger` is the element that opens it.
export function WorkspaceDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { create, isPending } = useCreateWorkspace();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    create(
      {
        name: String(form.get("name") ?? ""),
        description: String(form.get("description") ?? ""),
      },
      () => setOpen(false),
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>New workspace</DialogTitle>
            <DialogDescription>
              A workspace pairs one doc with one canvas.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="workspace-name">Name</Label>
            <Input
              id="workspace-name"
              name="name"
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
              placeholder="What is this workspace for?"
              maxLength={2000}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating…" : "Create workspace"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

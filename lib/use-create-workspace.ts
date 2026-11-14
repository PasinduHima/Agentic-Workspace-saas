"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { createWorkspace } from "@/actions/workspace";
import { useUpgradeDialog } from "@/components/UpgradeDialog";
import { UPGRADE_REASONS } from "@/lib/plan-limits";

// Shared by the "New workspace" dialog and the dashboard prompt: creates the workspace, and turns
// a plan-limit failure into the upgrade dialog and any other failure into a toast.
export function useCreateWorkspace() {
  const [isPending, startTransition] = useTransition();
  const openUpgrade = useUpgradeDialog();

  const create = (
    input: { name: string; description?: string },
    onCreated?: () => void,
  ) => {
    // The action throws for an empty name, so catch it here where the message can be shown.
    if (!input.name.trim()) {
      toast.error("Give the workspace a name.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await createWorkspace(input.name, input.description);
        if ("limit" in result) {
          openUpgrade(UPGRADE_REASONS[result.limit]);
          return;
        }
        toast.success("Workspace created");
        onCreated?.();
      } catch {
        // Next hides thrown server action messages in production, so show a generic one.
        toast.error("Couldn't create the workspace. Try again.");
      }
    });
  };

  return { create, isPending };
}

import { z } from "zod";

// Same limits as the inputs in WorkspaceDialog and EditableWorkspaceName; enforced again on the
// server because server actions can be called directly.
export const MAX_WORKSPACE_NAME = 80;
export const MAX_WORKSPACE_DESCRIPTION = 2000;

const name = z
  .string()
  .trim()
  .min(1, "Workspace name is required")
  .max(MAX_WORKSPACE_NAME, `Workspace name must be ${MAX_WORKSPACE_NAME} characters or fewer`);

// Blank means "no description" (stored as null); undefined means "leave it unchanged".
const description = z
  .string()
  .trim()
  .max(MAX_WORKSPACE_DESCRIPTION, `Description must be ${MAX_WORKSPACE_DESCRIPTION} characters or fewer`)
  .transform((value) => value || null)
  .optional();

const workspaceInput = z.object({ name, description });

/** Validates and normalizes a workspace's name and description, throwing a readable error. */
export function parseWorkspaceInput(input: { name: unknown; description?: unknown }) {
  const result = workspaceInput.safeParse(input);
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? "Invalid workspace");
  return result.data;
}

"use server";

import { auth } from "@clerk/nextjs/server";
import { getPromptUsage } from "@/lib/billing";

// This month's agent prompts for the active context: the selected org, or the user's own plan.
export async function getMyPromptUsage() {
  const { userId, orgId } = await auth();
  if (!userId) return null;
  return getPromptUsage(orgId ?? userId);
}

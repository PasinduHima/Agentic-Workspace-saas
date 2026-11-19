import { z } from "zod";
import { lastAssistantMessageIsCompleteWithToolCalls, safeValidateUIMessages, type UIMessage } from "ai";

// Generous caps: far above what the UI sends, low enough that one request can't run up a huge
// Gemini bill. The contexts go straight into the system prompt.
export const MAX_MESSAGES = 200;
export const MAX_CONTEXT_CHARS = 200_000;

const envelope = z.object({
  messages: z.array(z.unknown()).min(1).max(MAX_MESSAGES),
  workspaceId: z.string().min(1).max(64),
  canvasContext: z.string().max(MAX_CONTEXT_CHARS).nullable(),
  docContext: z.string().max(MAX_CONTEXT_CHARS).nullable(),
});

export type AgentRequest = {
  messages: UIMessage[];
  workspaceId: string;
  canvasContext: string | null;
  docContext: string | null;
};

/** Validates the agent route's JSON body. Returns null for anything malformed. */
export async function parseAgentRequest(body: unknown): Promise<AgentRequest | null> {
  const parsed = envelope.safeParse(body);
  if (!parsed.success) return null;
  const messages = await safeValidateUIMessages({ messages: parsed.data.messages });
  if (!messages.success) return null;
  return { ...parsed.data, messages: messages.data };
}

/**
 * Whether this request is the chat's automatic resubmit after client-side tool calls (the same
 * test the client uses to send it). Those continue a prompt that was already counted; any other
 * request counts as a new prompt, whatever role its last message claims.
 */
export function isAutomaticFollowUp(messages: UIMessage[]) {
  return lastAssistantMessageIsCompleteWithToolCalls({ messages });
}

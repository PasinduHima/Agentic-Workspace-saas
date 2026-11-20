// Hands the dashboard's prompt to the new workspace's agent without putting the prompt in the URL
// (long prompts break URL limits, and URLs end up in history and server logs). Session storage is
// per tab, so the prompt is only ever sent by the tab that typed it, and it's read once.

const key = (workspaceId: string) => `outpost:pending-prompt:${workspaceId}`;

/** Stores the prompt; returns false if storage isn't available (e.g. blocked by the browser). */
export function savePendingPrompt(workspaceId: string, prompt: string) {
  try {
    sessionStorage.setItem(key(workspaceId), prompt);
    return true;
  } catch {
    return false;
  }
}

/** Returns the stored prompt and removes it, or null if there isn't one. */
export function takePendingPrompt(workspaceId: string) {
  try {
    const prompt = sessionStorage.getItem(key(workspaceId));
    sessionStorage.removeItem(key(workspaceId));
    return prompt;
  } catch {
    return null;
  }
}

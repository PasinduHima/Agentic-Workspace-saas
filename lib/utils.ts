import type { KeyboardEvent } from "react";

export { cn } from "cn";

// Distinct, readable-on-dark colors for collaborator cursors and avatars.
const USER_COLORS = [
  "#f59e0b", // amber
  "#3b82f6", // blue
  "#10b981", // emerald
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
  "#84cc16", // lime
  "#06b6d4", // cyan
];

/** A stable color for a user id: the same person gets the same cursor color on every device. */
export function colorForUser(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

/**
 * onKeyDown handler for a textarea: Enter submits, Shift+Enter adds a new line. Ignores Enter
 * while an IME is composing (e.g. picking Japanese or Chinese characters), which would otherwise
 * submit half-typed text.
 */
export function submitOnEnter(onSubmit: () => void) {
  return (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    onSubmit();
  };
}

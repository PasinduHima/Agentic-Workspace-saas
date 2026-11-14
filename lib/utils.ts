import type { KeyboardEvent } from "react";

export { cn } from "cn";

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

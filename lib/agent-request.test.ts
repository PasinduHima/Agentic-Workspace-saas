import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";
import { MAX_CONTEXT_CHARS, MAX_MESSAGES, isAutomaticFollowUp, parseAgentRequest } from "./agent-request";

const userMessage: UIMessage = { id: "u1", role: "user", parts: [{ type: "text", text: "Draw a flow" }] };

const valid = { messages: [userMessage], workspaceId: "ws_1", canvasContext: "", docContext: null };

describe("parseAgentRequest", () => {
  it("accepts the body the chat transport sends", async () => {
    const parsed = await parseAgentRequest(valid);
    expect(parsed?.workspaceId).toBe("ws_1");
    expect(parsed?.messages).toHaveLength(1);
  });

  it.each([
    ["a null body", null],
    ["messages that aren't an array", { ...valid, messages: "hi" }],
    ["no messages", { ...valid, messages: [] }],
    ["too many messages", { ...valid, messages: Array(MAX_MESSAGES + 1).fill(userMessage) }],
    ["a malformed message", { ...valid, messages: [{ role: "user" }] }],
    ["a missing workspace id", { ...valid, workspaceId: undefined }],
    ["a non-string workspace id", { ...valid, workspaceId: 42 }],
    ["an oversized canvas context", { ...valid, canvasContext: "x".repeat(MAX_CONTEXT_CHARS + 1) }],
    ["an oversized doc context", { ...valid, docContext: "x".repeat(MAX_CONTEXT_CHARS + 1) }],
  ])("rejects %s", async (_label, body) => {
    expect(await parseAgentRequest(body)).toBeNull();
  });
});

describe("isAutomaticFollowUp", () => {
  const toolCall = (state: "input-available" | "output-available"): UIMessage => ({
    id: "a1",
    role: "assistant",
    parts: [
      { type: "step-start" },
      state === "output-available"
        ? {
            type: "tool-createRectangle",
            toolCallId: "t1",
            state,
            input: {},
            output: { success: true },
          }
        : { type: "tool-createRectangle", toolCallId: "t1", state, input: {} },
    ],
  });

  it("is false for a typed user prompt", () => {
    expect(isAutomaticFollowUp([userMessage])).toBe(false);
  });

  it("is true once every tool call in the last step has its output", () => {
    expect(isAutomaticFollowUp([userMessage, toolCall("output-available")])).toBe(true);
  });

  it("is false for an assistant message without completed tool calls", () => {
    // The old check skipped metering for any history ending in an assistant message.
    const textOnly: UIMessage = { id: "a2", role: "assistant", parts: [{ type: "text", text: "hi" }] };
    expect(isAutomaticFollowUp([userMessage, textOnly])).toBe(false);
    expect(isAutomaticFollowUp([userMessage, toolCall("input-available")])).toBe(false);
  });
});

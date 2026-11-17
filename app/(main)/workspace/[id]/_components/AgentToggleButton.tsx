"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { ArrowUp, Bot, Square, X } from "lucide-react";
import { toast } from "sonner";
import { MicButton } from "@/components/MicButton";
import { PROMPT_USED_EVENT } from "@/components/PlanButton";
import { useUpgradeDialog } from "@/components/UpgradeDialog";
import { useWorkspaceEditors } from "@/components/WorkspaceEditorsContext";
import { Button } from "@/components/ui/button";
import {
  buildAgentContext,
  drawDiagram,
  drawTables,
  editCanvas,
  writeDoc,
} from "@/lib/agent/client-tools";
import type { AgentUIMessage } from "@/lib/agent/tools";
import { PROMPT_LIMIT_ERROR, UPGRADE_REASONS } from "@/lib/plan-limits";
import { cn, submitOnEnter } from "@/lib/utils";

const NO_CANVAS = "The canvas isn't open in this view. Switch to Canvas or Both and ask again.";
const NO_DOC = "The doc isn't open in this view. Switch to Document or Both and ask again.";

const TOOL_LABELS: Record<string, { running: string; done: string }> = {
  "tool-drawDiagram": { running: "Drawing the diagram…", done: "Drew the diagram" },
  "tool-drawTables": { running: "Drawing the tables…", done: "Drew the tables" },
  "tool-editCanvas": { running: "Editing the canvas…", done: "Updated the canvas" },
  "tool-writeDoc": { running: "Writing the doc…", done: "Updated the doc" },
};

/**
 * The header's "Agent" button and the chat panel it opens. The model runs on the server
 * (/api/agent); its tools run here, against the live canvas and doc editors. `initialPrompt` (from
 * the dashboard) is sent once as soon as an editor is ready, then removed from the URL so a
 * refresh doesn't send it again.
 */
export function AgentToggleButton({
  workspaceId,
  initialPrompt,
}: {
  workspaceId: string;
  initialPrompt?: string;
}) {
  const [open, setOpen] = useState(!!initialPrompt);
  const [input, setInput] = useState("");
  const { canvasEditor, docEditor } = useWorkspaceEditors();
  const openUpgrade = useUpgradeDialog();

  // Tool calls and request bodies run outside render, so they read the editors through a ref.
  const editorsRef = useRef({ canvasEditor, docEditor });
  useEffect(() => {
    editorsRef.current = { canvasEditor, docEditor };
  }, [canvasEditor, docEditor]);

  const [transport] = useState(
    // body() reads the ref only when a request is sent, never during render; the lint rule
    // can't tell, since it sees the ref passed into a function at creation.
    // eslint-disable-next-line react-hooks/refs
    () =>
      new DefaultChatTransport<AgentUIMessage>({
        api: "/api/agent",
        body: () => ({
          workspaceId,
          context: buildAgentContext(editorsRef.current.canvasEditor, editorsRef.current.docEditor),
        }),
      }),
  );

  const { messages, sendMessage, status, stop, addToolOutput } = useChat<AgentUIMessage>({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,

    async onToolCall({ toolCall }) {
      if (toolCall.dynamic) return;
      const { canvasEditor: canvas, docEditor: doc } = editorsRef.current;
      const { toolCallId } = toolCall;

      try {
        switch (toolCall.toolName) {
          case "drawDiagram":
            if (!canvas) throw new Error(NO_CANVAS);
            addToolOutput({ tool: "drawDiagram", toolCallId, output: await drawDiagram(canvas, toolCall.input) });
            break;
          case "drawTables":
            if (!canvas) throw new Error(NO_CANVAS);
            addToolOutput({ tool: "drawTables", toolCallId, output: await drawTables(canvas, toolCall.input) });
            break;
          case "editCanvas":
            if (!canvas) throw new Error(NO_CANVAS);
            addToolOutput({ tool: "editCanvas", toolCallId, output: editCanvas(canvas, toolCall.input) });
            break;
          case "writeDoc":
            if (!doc) throw new Error(NO_DOC);
            addToolOutput({ tool: "writeDoc", toolCallId, output: writeDoc(doc, toolCall.input) });
            break;
        }
      } catch (error) {
        addToolOutput({
          tool: toolCall.toolName,
          toolCallId,
          state: "output-error",
          errorText: error instanceof Error ? error.message : "The tool failed.",
        });
      }
    },

    onError(error) {
      if (error.message.includes(PROMPT_LIMIT_ERROR)) {
        openUpgrade(UPGRADE_REASONS.prompts);
      } else {
        toast.error("The agent couldn't respond. Try again.");
      }
      window.dispatchEvent(new Event(PROMPT_USED_EVENT));
    },

    onFinish() {
      window.dispatchEvent(new Event(PROMPT_USED_EVENT));
    },
  });

  const busy = status === "submitted" || status === "streaming";

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    void sendMessage({ text: trimmed });
    setInput("");
  };

  // The dashboard's prompt: send it once, after an editor exists for the tools to work on.
  const sentInitial = useRef(false);
  useEffect(() => {
    if (!initialPrompt || sentInitial.current || (!canvasEditor && !docEditor)) return;
    sentInitial.current = true;
    void sendMessage({ text: initialPrompt });
    const url = new URL(window.location.href);
    url.searchParams.delete("prompt");
    window.history.replaceState(null, "", url);
  }, [initialPrompt, canvasEditor, docEditor, sendMessage]);

  // Keep the newest message in view.
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, open]);

  return (
    <>
      <Button
        size="sm"
        variant={open ? "secondary" : "default"}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="gap-1.5"
      >
        <Bot className="size-4" />
        Agent
      </Button>

      {open && (
        <aside
          aria-label="Agent"
          className="fixed top-14 right-0 bottom-0 z-40 flex w-full flex-col border-l border-white/6 bg-background shadow-2xl shadow-black/50 sm:w-[24rem]"
        >
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/6 px-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Bot className="size-4 text-primary" />
              Agent
            </p>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setOpen(false)}
              aria-label="Close agent"
            >
              <X />
            </Button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm">
            {messages.length === 0 && (
              <p className="text-muted-foreground">
                Ask for a flowchart, an ERD or an architecture diagram, or have the agent turn the
                canvas into a written spec.
              </p>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "space-y-2",
                  message.role === "user" && "ml-8 rounded-lg bg-secondary px-3 py-2",
                )}
              >
                {message.parts.map((part, i) => {
                  if (part.type === "text") {
                    return (
                      <p key={i} className="leading-relaxed whitespace-pre-wrap">
                        {part.text}
                      </p>
                    );
                  }
                  const labels = TOOL_LABELS[part.type];
                  if (!labels || !("state" in part)) return null;
                  if (part.state === "output-error") {
                    return (
                      <p key={i} className="text-xs text-destructive">
                        {part.errorText}
                      </p>
                    );
                  }
                  const done = part.state === "output-available";
                  return (
                    <p
                      key={i}
                      className="flex items-center gap-2 font-mono text-xs text-muted-foreground"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "size-1.5 rotate-45 bg-primary",
                          !done && "animate-pulse",
                        )}
                      />
                      {done ? labels.done : labels.running}
                    </p>
                  );
                })}
              </div>
            ))}

            {status === "submitted" && (
              <p className="animate-pulse text-xs text-muted-foreground">Thinking…</p>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="shrink-0 border-t border-white/6 p-3"
          >
            <div className="rounded-xl border border-white/10 bg-card p-2 focus-within:border-primary/50">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={submitOnEnter(() => send(input))}
                placeholder="Ask the agent…"
                aria-label="Message the agent"
                rows={2}
                className="field-sizing-content max-h-40 min-h-12 w-full resize-none bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground/70"
              />
              <div className="flex items-center justify-end gap-1.5">
                <MicButton value={input} onChange={setInput} disabled={busy} className="rounded-full" />
                {busy ? (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="secondary"
                    onClick={() => void stop()}
                    aria-label="Stop"
                    className="rounded-full"
                  >
                    <Square className="size-3 fill-current" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    size="icon-sm"
                    disabled={!input.trim()}
                    aria-label="Send"
                    className="rounded-full"
                  >
                    <ArrowUp />
                  </Button>
                )}
              </div>
            </div>
          </form>
        </aside>
      )}
    </>
  );
}

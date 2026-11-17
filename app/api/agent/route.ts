import { google } from "@ai-sdk/google";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
} from "ai";
import { checkUser } from "@/actions/check-user";
import { agentTools, type AgentContext, type AgentUIMessage } from "@/lib/agent/tools";
import { getPromptUsage, getWorkspaceOwnerId, recordPrompt } from "@/lib/billing";
import { PROMPT_LIMIT_ERROR } from "@/lib/plan-limits";
import { canAccessWorkspace } from "@/lib/workspace-access";

export const maxDuration = 60;

const MODEL = process.env.AGENT_MODEL ?? "gemini-2.5-flash";

// The browser runs the tools and sends their results back, which starts another round. This caps
// the rounds per user prompt, so a model that keeps calling tools can't loop forever.
const MAX_TOOL_ROUNDS = 8;

const SYSTEM_PROMPT = `You are the agent inside Outpost, a workspace where each workspace has one doc and one canvas.
You help the user plan what they are building by drawing on the canvas and writing in the doc.

Tools:
- drawDiagram: flowcharts, architecture diagrams, org charts. Layout is automatic; give nodes and edges only.
- drawTables: database schemas (ERDs) with relations between columns.
- editCanvas: change or delete what is already on the canvas, using shape ids from the canvas context.
- writeDoc: write Markdown to the doc. Use "replace" to rewrite it, "append" to add a section.

Guidelines:
- Act, don't describe: when the user asks for a diagram or a doc, call the tool.
- To change an existing diagram, prefer editCanvas over drawing a new one.
- When asked to turn a diagram into a spec, read it from the canvas context and write the doc.
- Keep replies short: one or two sentences on what you did. Never paste the doc's contents into chat.`;

function contextBlock(context: AgentContext | undefined) {
  const canvas = context?.canvas;
  const doc = context?.doc;
  return [
    "## Current canvas",
    canvas === null || canvas === undefined
      ? "(The canvas isn't open in the current view, so canvas tools will fail. Ask the user to switch to a view with the canvas.)"
      : canvas.length === 0
        ? "(empty)"
        : JSON.stringify(canvas),
    "## Current doc (Markdown)",
    doc === null || doc === undefined
      ? "(The doc isn't open in the current view, so writeDoc will fail. Ask the user to switch to a view with the doc.)"
      : doc.trim() || "(empty)",
  ].join("\n\n");
}

export async function POST(req: Request) {
  const user = await checkUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { messages, workspaceId, context } = (await req.json()) as {
    messages: AgentUIMessage[];
    workspaceId: string;
    context?: AgentContext;
  };
  if (typeof workspaceId !== "string" || !Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  // 404 rather than 403, as on the workspace page: don't reveal whether the workspace exists.
  if (!(await canAccessWorkspace(workspaceId))) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  // Only a new user message counts as a prompt; tool results sent back by the browser don't.
  const last = messages[messages.length - 1];
  const isNewPrompt = last.role === "user";
  if (isNewPrompt) {
    const ownerId = await getWorkspaceOwnerId(workspaceId);
    const { used, limit } = await getPromptUsage(ownerId);
    if (used >= limit) {
      return Response.json({ error: PROMPT_LIMIT_ERROR }, { status: 402 });
    }
    await recordPrompt(ownerId, user.id, workspaceId);
  }

  const toolRounds = isNewPrompt ? 0 : last.parts.filter((p) => p.type === "step-start").length;

  const result = streamText({
    model: google(MODEL),
    system: `${SYSTEM_PROMPT}\n\n${contextBlock(context)}`,
    messages: await convertToModelMessages(messages),
    tools: agentTools,
    // Past the cap, the model must answer in text instead of calling another tool.
    toolChoice: toolRounds >= MAX_TOOL_ROUNDS ? "none" : "auto",
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      onError: (error) => {
        console.error("[agent]", error);
        return "The agent ran into a problem. Try again.";
      },
    }),
  });
}

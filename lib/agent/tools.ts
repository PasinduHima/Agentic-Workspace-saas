import { tool, type InferUITools, type UIDataTypes, type UIMessage } from "ai";
import { z } from "zod";

/*
 * The agent's tools. None has an `execute`: they run in the browser (lib/agent/client-tools.ts),
 * where the live canvas and doc editors are, and their results are sent back to the model.
 * Shared by the API route (as the model's tool list) and the client (for typed tool parts).
 */

const nodeShape = z
  .enum(["rectangle", "ellipse", "diamond", "cloud", "hexagon"])
  .describe(
    "rectangle: step, service or person; ellipse: start/end; diamond: decision; cloud: external system; hexagon: data store",
  );

const column = z.object({
  name: z.string(),
  type: z.string().describe("e.g. uuid, text, integer, timestamp, boolean"),
  primaryKey: z.boolean().optional(),
  foreignKey: z
    .boolean()
    .optional()
    .describe("Mark foreign keys; drawTables also marks every relation's fromColumn"),
});

export const drawDiagramInput = z.object({
  direction: z
    .enum(["down", "right"])
    .describe("down for flowcharts and org charts, right for architecture and pipelines"),
  nodes: z
    .array(
      z.object({
        key: z.string().describe("Short unique key, used only to connect edges, e.g. 'auth'"),
        label: z.string().describe("Text shown in the node"),
        shape: nodeShape,
      }),
    )
    .min(1)
    .max(40),
  edges: z
    .array(
      z.object({
        from: z.string().describe("Key of the source node"),
        to: z.string().describe("Key of the target node"),
        label: z.string().optional().describe("Optional short label, e.g. 'yes' or 'HTTP'"),
      }),
    )
    .max(80),
});

export const drawTablesInput = z.object({
  tables: z
    .array(
      z.object({
        name: z.string().describe("Table name, e.g. 'users'"),
        columns: z.array(column).min(1).max(30),
      }),
    )
    .min(1)
    .max(20),
  relations: z
    .array(
      z.object({
        fromTable: z.string(),
        fromColumn: z.string().describe("The foreign key column, e.g. 'author_id'"),
        toTable: z.string(),
        toColumn: z.string().describe("The referenced column, usually 'id'"),
      }),
    )
    .max(40),
});

export const editCanvasInput = z.object({
  updates: z
    .array(
      z.object({
        id: z.string().describe("Shape id from the canvas context, e.g. 'shape:abc123'"),
        label: z.string().optional().describe("New text for a node or arrow"),
        tableName: z.string().optional().describe("New name for a table"),
        columns: z.array(column).optional().describe("Replaces all of a table's columns"),
      }),
    )
    .max(60),
  deleteIds: z.array(z.string()).max(200).describe("Ids of shapes to delete"),
});

export const writeDocInput = z.object({
  markdown: z.string(),
  mode: z
    .enum(["replace", "append"])
    .describe("replace rewrites the whole doc; append adds to the end"),
});

// What a tool reports back to the model after running in the browser (counts, new shape ids).
const toolOutput = z.record(z.string(), z.unknown());

export const agentTools = {
  drawDiagram: tool({
    description:
      "Draw a new diagram on the canvas: flowchart, architecture diagram or org chart. Nodes are laid out automatically and drawn one by one, then connected with arrows.",
    inputSchema: drawDiagramInput,
    outputSchema: toolOutput,
  }),
  drawTables: tool({
    description:
      "Draw database tables (an ERD) on the canvas, with arrows for relationships between columns.",
    inputSchema: drawTablesInput,
    outputSchema: toolOutput,
  }),
  editCanvas: tool({
    description:
      "Change what is already on the canvas: relabel shapes, rename or change the columns of tables, or delete shapes. Use the shape ids from the canvas context.",
    inputSchema: editCanvasInput,
    outputSchema: toolOutput,
  }),
  writeDoc: tool({
    description:
      "Write to the workspace doc in Markdown (headings, lists, tables, code blocks): a spec, a summary, or a rewritten section.",
    inputSchema: writeDocInput,
    outputSchema: toolOutput,
  }),
};

export type DrawDiagramInput = z.infer<typeof drawDiagramInput>;
export type DrawTablesInput = z.infer<typeof drawTablesInput>;
export type EditCanvasInput = z.infer<typeof editCanvasInput>;
export type WriteDocInput = z.infer<typeof writeDocInput>;

export type AgentToolName = keyof typeof agentTools;
export type AgentUIMessage = UIMessage<never, UIDataTypes, InferUITools<typeof agentTools>>;

/** What the browser sends with each request: the current state of the canvas and the doc. */
export type AgentContext = {
  canvas: unknown[] | null;
  doc: string | null;
};

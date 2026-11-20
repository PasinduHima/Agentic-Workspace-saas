import { describe, expect, it } from "vitest";
import { MAX_WORKSPACE_DESCRIPTION, MAX_WORKSPACE_NAME, parseWorkspaceInput } from "./workspace-input";

describe("parseWorkspaceInput", () => {
  it("trims the name and turns a blank description into null", () => {
    expect(parseWorkspaceInput({ name: "  Launch plan ", description: "   " })).toEqual({
      name: "Launch plan",
      description: null,
    });
  });

  it("leaves an omitted description undefined, so updates keep the existing one", () => {
    expect(parseWorkspaceInput({ name: "A" }).description).toBeUndefined();
  });

  it("accepts values at the limits", () => {
    const input = {
      name: "n".repeat(MAX_WORKSPACE_NAME),
      description: "d".repeat(MAX_WORKSPACE_DESCRIPTION),
    };
    expect(parseWorkspaceInput(input)).toEqual(input);
  });

  it.each([
    ["an empty name", { name: "   " }, "Workspace name is required"],
    ["a name over the limit", { name: "n".repeat(MAX_WORKSPACE_NAME + 1) }, "80 characters"],
    ["a non-string name", { name: 42 }, "expected string"],
    [
      "a description over the limit",
      { name: "A", description: "d".repeat(MAX_WORKSPACE_DESCRIPTION + 1) },
      "2000 characters",
    ],
    ["a non-string description", { name: "A", description: { x: 1 } }, "expected string"],
  ])("rejects %s", (_label, input, message) => {
    expect(() => parseWorkspaceInput(input)).toThrow(message);
  });
});

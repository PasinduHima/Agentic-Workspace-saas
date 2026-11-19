const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Whether a value has the shape of tldraw's `editor.getSnapshot()`: a `document` with a record
 * `store` and a `schema`. The workspace page loads the saved value as a snapshot, so anything else
 * would break the canvas for everyone. (Size is already capped by Next's Server Action body limit.)
 */
export function isCanvasSnapshot(value: unknown): boolean {
  if (!isPlainObject(value) || !isPlainObject(value.document)) return false;
  const { store, schema } = value.document;
  return isPlainObject(store) && isPlainObject(schema);
}

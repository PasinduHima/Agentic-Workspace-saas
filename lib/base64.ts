// Yjs updates are binary (Uint8Array), but Realtime broadcast payloads and server action arguments
// must be JSON, so they travel as base64 strings. Browser-only (btoa/atob); on the server use
// Buffer.from(value, "base64").

export function toBase64(bytes: Uint8Array) {
  // Built up in chunks: spreading a large array into String.fromCharCode overflows the stack.
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function fromBase64(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

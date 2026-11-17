"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
// The publishable key belongs in NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; .env currently has it under
// NEXT_PUBLIC_SUPABASE_PUBLISHABLE_URL, so that name is read as a fallback.
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_URL;

let client: SupabaseClient | null | undefined;

/**
 * The browser Supabase client, used only for Realtime (live doc collaboration). Returns null when
 * Supabase isn't configured, and callers fall back to single-user editing.
 */
export function getSupabaseClient() {
  if (client === undefined) {
    client = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  }
  return client;
}

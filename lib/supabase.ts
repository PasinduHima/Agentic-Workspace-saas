import { createClient } from "@supabase/supabase-js";

// .env currently stores the publishable key under NEXT_PUBLIC_SUPABASE_PUBLISHABLE_URL (the value
// is a key, not a URL). Read the correct name first and fall back to that one, since createClient
// throws at import time without a key and would take the workspace page down with it.
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_URL;

// Realtime authorizes private channels with the signed-in user's Clerk session token (Clerk is a
// Supabase third-party auth provider). The getter is set by the component that opens a channel,
// since Clerk's token API lives in React (useAuth).
let getClerkToken: () => Promise<string | null> = async () => null;

export function setSupabaseTokenGetter(getter: () => Promise<string | null>) {
  getClerkToken = getter;
}

export const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, supabaseKey!, {
  // Called by Realtime whenever it joins a channel or refreshes auth, so tokens stay fresh.
  accessToken: () => getClerkToken(),
});

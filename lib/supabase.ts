import { createClient } from "@supabase/supabase-js";

// .env currently stores the publishable key under NEXT_PUBLIC_SUPABASE_PUBLISHABLE_URL (the value
// is a key, not a URL). Read the correct name first and fall back to that one, since createClient
// throws at import time without a key and would take the workspace page down with it.
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_URL;

export const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, supabaseKey!);

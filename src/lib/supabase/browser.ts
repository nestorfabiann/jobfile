import { createClient } from '@supabase/supabase-js';

/** Browser client for direct uploads with a signed token. It carries no login of its own. */
export function supabaseBrowser() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
}

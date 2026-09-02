import { createClient } from "@supabase/supabase-js";

/**
 * A Supabase client for use ONLY on the server (server actions, admin page).
 * It uses the service role key, which must never be exposed to the browser.
 */
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to your .env.local file.",
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

export type SubmissionType = "feedback" | "prayer";

export interface Submission {
  id: string;
  created_at: string;
  type: SubmissionType;
  name: string | null;
  email: string | null;
  message: string;
}

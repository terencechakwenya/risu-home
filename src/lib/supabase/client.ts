import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client (Client Components, sync worker, auth UI).
//
// Memoised as a module singleton: the sync worker calls this on every save
// (via runPush), and a fresh createBrowserClient each time spins up a new
// GoTrueClient with its own timers and storage listeners that pile up over a
// session — a slow memory leak that matters on a low-RAM phone. One client per
// tab is also what Supabase expects.
let client: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (client) return client;
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return client;
}

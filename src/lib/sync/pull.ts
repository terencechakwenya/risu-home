import { createClient } from "@/lib/supabase/client";
import { db } from "@/lib/db/dexie";

// Background pull: refresh the local Dexie cache from Supabase so reads (and the
// Add screen's envelope chips + household id) work offline. Server is the source
// of truth on pull; pending local writes live in the outbox and are untouched.
export async function runPull(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const [member, household, envelopes, fixed] = await Promise.all([
    supabase.from("members").select("*").eq("id", user.id).single(),
    supabase.from("households").select("*").single(),
    supabase.from("envelopes").select("*").order("sort"),
    supabase.from("fixed_items").select("*").order("sort"),
  ]);

  await db.transaction("rw", db.members, db.households, db.envelopes, db.fixed_items, async () => {
    if (member.data) await db.members.put(member.data);
    if (household.data) await db.households.put(household.data);
    if (envelopes.data) {
      await db.envelopes.clear();
      await db.envelopes.bulkPut(envelopes.data);
    }
    if (fixed.data) {
      await db.fixed_items.clear();
      await db.fixed_items.bulkPut(fixed.data);
    }
  });
}

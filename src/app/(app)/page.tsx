import { HomeScreen } from "@/components/home/HomeScreen";
import {
  getMember,
  getHousehold,
  getEnvelopes,
  getFixedItems,
  getPearlReceiptDates,
  getWeekSpendByEnvelope,
} from "@/lib/data/household";

// Home — pulls the real seeded household data from Supabase and renders the
// Pearl or Terence view based on the signed-in member's role.
export default async function HomePage() {
  const [member, household, envelopes, fixed] = await Promise.all([
    getMember(),
    getHousehold(),
    getEnvelopes(),
    getFixedItems(),
  ]);

  if (!household) {
    return (
      <div className="bg-white rounded-xl p-4 border border-slate-100 text-[13px] text-slate-500">
        No household found. Run the Supabase seed, or check that your member row
        is linked.
      </div>
    );
  }

  const role = member?.role ?? "pearl";
  // Streak is a Pearl reward — only fetch it for her.
  const [streakDates, weekSpend] = await Promise.all([
    role === "pearl" ? getPearlReceiptDates() : Promise.resolve([]),
    getWeekSpendByEnvelope(),
  ]);

  return (
    <HomeScreen
      role={role}
      name={member?.display_name}
      household={household}
      envelopes={envelopes}
      fixed={fixed}
      streakDates={streakDates}
      weekSpend={weekSpend}
    />
  );
}

import { ShoppingBag, Wallet } from "lucide-react";
import type { Envelope, FixedItem, Household, Role } from "@/lib/domain/types";
import { fixedTotal, totalBudget, totalSpent } from "@/lib/domain/budget";
import { fmt } from "@/lib/domain/format";
import { pacingMessage } from "@/lib/domain/cheer";
import { StreakPill } from "@/components/gamify/StreakPill";
import { AccountGroups } from "./AccountGroups";
import { FixedLayer } from "./FixedLayer";

// Home. Pearl sees her budget hero + account groups. Terence sees two oversight
// cards (Pearl's running budget vs his fixed layer), the fixed detail, then
// Pearl's budget for oversight.
export function HomeScreen({
  role,
  name,
  household,
  envelopes,
  fixed,
  streakDates = [],
  weekSpend,
}: {
  role: Role;
  name?: string | null;
  household: Household;
  envelopes: Envelope[];
  fixed: FixedItem[];
  streakDates?: string[];
  weekSpend?: Record<string, number>;
}) {
  const tb = totalBudget(envelopes);
  const ts = totalSpent(envelopes);
  const left = tb - ts;
  const firstName = (name ?? "").trim().split(" ")[0];

  if (role === "pearl") {
    return (
      <div>
        <div className="text-[15px] font-semibold text-slate-800 mb-2">
          Hi {firstName || "there"} 👋
        </div>
        <div className="flex items-center justify-between mb-2 gap-2">
          <div className="text-[13px] text-slate-500">{pacingMessage(ts, tb)}</div>
          <StreakPill dates={streakDates} />
        </div>
        <div data-tour="budget-card" className="bg-navy rounded-2xl p-4 text-white mb-4">
          <div className="text-[12px]" style={{ color: "#9FB4CE" }}>
            Your household budget · FNB account
          </div>
          <div className="text-3xl font-semibold mt-1">{fmt(left)}</div>
          <div className="text-[12px]" style={{ color: "#9FB4CE" }}>
            left of {fmt(tb)} · {fmt(ts)} spent
          </div>
        </div>
        <AccountGroups envelopes={envelopes} playful weekSpend={weekSpend} />
      </div>
    );
  }

  // Terence (admin) oversight view.
  const fixedSum = fixedTotal(fixed);

  return (
    <div>
      <div data-tour="budget-card" className="bg-navy rounded-2xl p-4 text-white mb-3">
        <div className="flex items-center gap-1.5 text-[12px]" style={{ color: "#9FB4CE" }}>
          <ShoppingBag size={13} /> Pearl&apos;s running budget
        </div>
        <div className="text-3xl font-semibold mt-1">{fmt(left)}</div>
        <div className="text-[12px]" style={{ color: "#9FB4CE" }}>
          left of {fmt(tb)} · {fmt(ts)} spent
        </div>
      </div>

      <div data-tour="fixed-card" className="bg-white rounded-2xl p-4 border border-slate-100 mb-4">
        <div className="flex items-center gap-1.5 text-[12px] text-slate-500">
          <Wallet size={13} /> Your fixed layer
        </div>
        <div className="text-2xl font-semibold mt-1 text-slate-800">{fmt(fixedSum)}</div>
        <div className="text-[12px] text-slate-400">
          scheduled · plus school buffer {fmt(household.buffer)}
        </div>
      </div>

      <FixedLayer fixed={fixed} buffer={household.buffer} />

      <div className="mt-5">
        <div className="text-[12px] text-slate-500 mb-2 flex items-center gap-1.5">
          <ShoppingBag size={14} /> Pearl&apos;s household budget
        </div>
        <AccountGroups envelopes={envelopes} weekSpend={weekSpend} />
      </div>
    </div>
  );
}

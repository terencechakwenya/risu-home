import type { Account, Envelope } from "@/lib/domain/types";
import { fmt } from "@/lib/domain/format";
import { EnvelopeList } from "./EnvelopeList";

const GROUPS: { id: Account; label: string }[] = [
  { id: "FNB", label: "FNB · household" },
  { id: "Stanbic", label: "Stanbic · personal" },
];

// Envelopes grouped by account with subtotals — the adoption feature. The first
// envelope in the first non-empty group gets the "envelope-first" tour hook.
// `playful` (Pearl) enables the alive bars + sparkles in EnvelopeList.
export function AccountGroups({
  envelopes,
  playful = false,
  weekSpend,
}: {
  envelopes: Envelope[];
  playful?: boolean;
  weekSpend?: Record<string, number>;
}) {
  const firstGroupWithItems = GROUPS.find(
    (g) => envelopes.some((e) => (e.account || "FNB") === g.id),
  );
  const markId = firstGroupWithItems
    ? envelopes.find((e) => (e.account || "FNB") === firstGroupWithItems.id)?.id
    : undefined;

  return (
    <div data-tour="accounts" className="space-y-4">
      {GROUPS.map((grp) => {
        const es = envelopes.filter((e) => (e.account || "FNB") === grp.id);
        const subtotal = es.reduce((a, e) => a + e.budget, 0);

        if (grp.id === "Stanbic" && es.length === 0) {
          return (
            <div key={grp.id}>
              <div className="text-[11px] text-slate-400 mb-1.5">{grp.label}</div>
              <div className="text-[12px] text-slate-400 bg-white rounded-xl border border-slate-100 px-3 py-2">
                Your personal account — kept separate from the household budget.
              </div>
            </div>
          );
        }
        if (es.length === 0) return null;

        return (
          <div key={grp.id}>
            <div className="flex justify-between text-[11px] text-slate-400 mb-1.5">
              <span>{grp.label}</span>
              <span>{fmt(subtotal)}</span>
            </div>
            <EnvelopeList envelopes={es} markId={markId} playful={playful} weekSpend={weekSpend} />
          </div>
        );
      })}
    </div>
  );
}

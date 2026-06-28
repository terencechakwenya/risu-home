import { Sparkles } from "lucide-react";
import type { Envelope } from "@/lib/domain/types";
import { barColor, fmt, guidanceText } from "@/lib/domain/format";

// A stack of envelope cards: name, spent/budget, per-week guidance line, and the
// green→amber→red progress bar. `markId` tags one card with data-tour for the
// training wizard ("envelope-first"). When `playful` (Pearl), comfortably-under
// lines get a soft glow + sparkle and the bar fills smoothly — a pleasant
// progress meter. Rewards only attach to staying under budget.
export function EnvelopeList({
  envelopes,
  markId,
  playful = false,
  weekSpend,
}: {
  envelopes: Envelope[];
  markId?: string;
  playful?: boolean;
  weekSpend?: Record<string, number>;
}) {
  return (
    <div className="space-y-3">
      {envelopes.map((e) => {
        const ratio = e.budget ? e.spent / e.budget : 0;
        const over = e.spent > e.budget;
        const healthy = playful && !over && ratio < 0.7;
        const g = guidanceText(e);

        // "This week" framing for weekly/hybrid lines — a small, manageable number.
        const weekly = (e.is_weekly || e.is_hybrid) && e.weekly_rate > 0;
        const spentWeek = weekSpend?.[e.id] ?? 0;
        const leftWeek = Math.max(0, e.weekly_rate - spentWeek);
        const weekRatio = e.weekly_rate ? spentWeek / e.weekly_rate : 0;
        const showWeek = weekly && !!weekSpend;

        return (
          <div
            key={e.id}
            data-tour={e.id === markId ? "envelope-first" : undefined}
            className="bg-white rounded-xl p-3 border border-slate-100"
          >
            <div className="flex justify-between items-baseline text-[13px]">
              <span className="text-slate-700 flex items-center gap-1">
                {e.name}
                {healthy && <Sparkles size={12} className="text-[#639922] risu-sparkle" />}
              </span>
              <span style={{ color: over ? "#E24B4A" : "#64748b" }}>
                {fmt(e.spent)} / {fmt(e.budget)}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mb-1.5">{g || " "}</div>
            {showWeek && (
              <div className="mb-2 rounded-lg bg-slate-50 px-2 py-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">This week</span>
                  <span
                    className="font-semibold"
                    style={{ color: leftWeek > 0 ? "#3B6D11" : "#E24B4A" }}
                  >
                    {fmt(leftWeek)} left
                  </span>
                </div>
                <div className="h-1 rounded-full bg-slate-200 overflow-hidden mt-1">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: Math.min(100, weekRatio * 100) + "%",
                      background: barColor(weekRatio),
                      transition: playful ? "width .8s cubic-bezier(.2,.8,.2,1)" : "width .3s ease",
                    }}
                  />
                </div>
              </div>
            )}
            <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
              <span>{showWeek ? "This month" : " "}</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${healthy ? "risu-glow" : ""}`}
                style={{
                  width: Math.min(100, ratio * 100) + "%",
                  background: barColor(ratio),
                  transition: playful
                    ? "width .8s cubic-bezier(.2,.8,.2,1)"
                    : "width .3s ease",
                }}
              />
            </div>
            {over && (
              <div className="text-[11px] mt-1" style={{ color: "#E24B4A" }}>
                Over by {fmt(e.spent - e.budget)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

import { Award } from "lucide-react";
import type { Badge } from "@/lib/domain/types";

// Pearl's badge shelf — earned monthly "On Budget" badges. Always shown (with an
// encouraging empty state) so there's a goal to aim at.
export function BadgeShelf({ badges }: { badges: Badge[] }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-3">
      <div className="text-[12px] text-slate-500 mb-2">Your badges</div>
      {badges.length === 0 ? (
        <div className="text-[12px] text-slate-400">
          Finish a month under budget to earn your first badge ✨
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {badges.map((b) => (
            <div
              key={b.id}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium"
              style={{ background: "#EAF3DE", color: "#3B6D11" }}
            >
              <Award size={13} /> {b.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

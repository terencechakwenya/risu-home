import { School } from "lucide-react";
import type { FixedItem } from "@/lib/domain/types";
import { fmt } from "@/lib/domain/format";

// Terence's scheduled fixed items + the school buffer row.
export function FixedLayer({ fixed, buffer }: { fixed: FixedItem[]; buffer: number }) {
  return (
    <div className="mt-1">
      <div className="text-[12px] text-slate-400 mb-2 flex items-center gap-1.5">
        Scheduled items
      </div>
      <div className="bg-white rounded-xl border border-slate-100 divide-y divide-slate-50">
        {fixed.map((f) => (
          <div key={f.id} className="flex justify-between px-3 py-2 text-[13px]">
            <span className="text-slate-600">{f.name}</span>
            <span className="text-slate-800">{fmt(f.amount)}</span>
          </div>
        ))}
        <div
          className="flex justify-between px-3 py-2 text-[13px]"
          style={{ background: "#EAF0F7" }}
        >
          <span className="flex items-center gap-1.5 text-slate-700">
            <School size={14} /> School buffer
          </span>
          <span style={{ color: "#185FA5" }}>{fmt(buffer)}</span>
        </div>
      </div>
    </div>
  );
}

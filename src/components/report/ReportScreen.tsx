"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Download, School, Sparkles } from "lucide-react";
import { db } from "@/lib/db/dexie";
import type { Badge, Envelope, Receipt, Role } from "@/lib/domain/types";
import type { ReceiptView } from "@/lib/data/household";
import { fmt } from "@/lib/domain/format";
import { totalBudget, totalSpent } from "@/lib/domain/budget";
import { reportCheer } from "@/lib/domain/cheer";
import { BadgeShelf } from "@/components/gamify/BadgeShelf";

interface ReceiptRow extends ReceiptView {
  pending?: boolean;
}

// Report: month totals, per-envelope spend, the school buffer, and the receipt
// log with photo thumbnails. Locally-queued (unsynced) receipts are overlaid
// from Dexie so a just-captured offline receipt appears right away. Export is a
// print-to-PDF of the report body.
export function ReportScreen({
  role,
  month,
  buffer,
  envelopes,
  receipts,
  badges = [],
}: {
  role: Role;
  month: string;
  buffer: number;
  envelopes: Envelope[];
  receipts: ReceiptView[];
  badges?: Badge[];
}) {
  const playful = role === "pearl";
  // Unsynced receipts still in the outbox, with a local blob thumbnail.
  const pending = useLiveQuery(
    async (): Promise<ReceiptRow[]> => {
      const items = await db.outbox.where("table").equals("receipts").toArray();
      const rows: ReceiptRow[] = [];
      for (const it of items) {
        const r = it.payload as unknown as Receipt;
        const photo = await db.photos.get(r.id);
        rows.push({
          ...r,
          thumbUrl: photo ? URL.createObjectURL(photo.blob) : null,
          pending: true,
        });
      }
      return rows;
    },
    [],
    [],
  );

  const nameById = new Map(envelopes.map((e) => [e.id, e.name]));
  const all: ReceiptRow[] = [...(pending ?? []), ...receipts];

  const tb = totalBudget(envelopes);
  const ts = totalSpent(envelopes);
  const under = tb - ts;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-slate-700 font-medium">{month} report</div>
        <button
          data-tour="export"
          onClick={() => window.print()}
          className="no-print text-[12px] text-slate-500 flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 py-1.5"
        >
          <Download size={14} /> Export for Hope
        </button>
      </div>

      <div
        data-tour="summary"
        className="rounded-xl p-4 mb-4"
        style={{ background: under >= 0 ? "#EAF3DE" : "#FCEBEB" }}
      >
        <div className="text-[12px]" style={{ color: under >= 0 ? "#3B6D11" : "#A32D2D" }}>
          Household spent this month
        </div>
        <div
          className="text-2xl font-semibold"
          style={{ color: under >= 0 ? "#27500A" : "#791F1F" }}
        >
          {fmt(ts)} <span className="text-[12px] font-normal">/ {fmt(tb)}</span>
        </div>
        <div className="text-[12px]" style={{ color: under >= 0 ? "#3B6D11" : "#A32D2D" }}>
          {under >= 0 ? `Under budget · ${fmt(under)} saved` : `Over budget by ${fmt(-under)}`}
        </div>
        {playful && (
          <div className="text-[12px] font-medium mt-1" style={{ color: "#3B6D11" }}>
            {reportCheer(under)}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-100 divide-y divide-slate-50 mb-4">
        {envelopes.map((e) => {
          const stayedUnder = playful && e.budget > 0 && e.spent <= e.budget;
          return (
            <div key={e.id} className="flex justify-between px-3 py-2 text-[13px]">
              <span className="text-slate-600 flex items-center gap-1">
                {e.name}
                {stayedUnder && (
                  <Sparkles size={12} className="text-[#639922] risu-sparkle" />
                )}
              </span>
              <span className="text-slate-800">{fmt(e.spent)}</span>
            </div>
          );
        })}
        {role === "terence" && (
          <div
            className="flex justify-between px-3 py-2 text-[13px]"
            style={{ background: "#EAF0F7" }}
          >
            <span className="flex items-center gap-1.5 text-slate-700">
              <School size={14} /> School buffer
            </span>
            <span style={{ color: "#185FA5" }}>{fmt(buffer)}</span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-100 p-3">
        <div className="text-[12px] text-slate-500 mb-1">Receipts logged</div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-semibold text-slate-800">{all.length}</span>
          <span className="text-[12px] text-slate-400">
            {pending && pending.length ? `${pending.length} waiting to sync` : "all categorised"}
          </span>
        </div>

        <div className="mt-2 space-y-1 max-h-80 overflow-auto">
          {all.slice(0, 50).map((r) => (
            <div
              key={r.id}
              className="flex justify-between items-center gap-2 text-[12px] text-slate-500"
            >
              <span className="flex items-center gap-1.5 min-w-0">
                {r.thumbUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.thumbUrl}
                    alt=""
                    className="h-7 w-7 rounded object-cover border border-slate-200 shrink-0"
                  />
                )}
                <span className="truncate">
                  {nameById.get(r.envelope_id) ?? r.envelope_id}
                  {r.note ? ` · ${r.note}` : ""}{" "}
                  <span className="text-slate-300">({r.logged_by})</span>
                  {r.pending && <span className="text-amber-600"> · syncing</span>}
                </span>
              </span>
              <span className="shrink-0">{fmt(r.amount)}</span>
            </div>
          ))}
          {all.length === 0 && (
            <div className="text-[12px] text-slate-400 py-2">
              No receipts yet — tap Add to log your first 🎉
            </div>
          )}
        </div>
      </div>

      {playful && (
        <div className="mt-4">
          <BadgeShelf badges={badges} />
        </div>
      )}
    </div>
  );
}

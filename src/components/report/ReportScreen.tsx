"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Download, School, Sparkles } from "lucide-react";
import { db } from "@/lib/db/dexie";
import type { Badge, Envelope, Receipt, Role } from "@/lib/domain/types";
import type { ReceiptView } from "@/lib/data/household";
import { fmt } from "@/lib/domain/format";
import { totalBudget, totalSpent } from "@/lib/domain/budget";
import { reportCheer } from "@/lib/domain/cheer";
import { BadgeShelf } from "@/components/gamify/BadgeShelf";
import { EditReceipt } from "@/components/report/EditReceipt";

interface ReceiptRow extends ReceiptView {
  pending?: boolean;
}

// Report: month totals, per-envelope spend, the school buffer, and the receipt
// log with photo thumbnails. Locally-queued (unsynced) receipts are overlaid
// from Dexie so a just-captured offline receipt appears right away, and
// unsynced edits are overlaid onto synced rows so an edit shows immediately.
// Export is a print-to-PDF of the report body. Terence (admin) can tap a receipt
// to edit it; Pearl's list is read-only (receipts_update is admin-only in RLS).
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
  const canEdit = role === "terence";
  const [editing, setEditing] = useState<ReceiptRow | null>(null);

  // Unsynced captures still in the outbox, with a local blob thumbnail. Inserts
  // only — edits are overlaid onto their existing rows below, not shown as new
  // entries.
  const pending = useLiveQuery(
    async (): Promise<ReceiptRow[]> => {
      const items = await db.outbox.where("table").equals("receipts").toArray();
      const rows: ReceiptRow[] = [];
      for (const it of items) {
        if (it.op !== "insert") continue;
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

  // Local (optimistic) receipt state, keyed by id — reflects unsynced edits.
  const localById = useLiveQuery(
    async () => new Map((await db.receipts.toArray()).map((r) => [r.id, r])),
    [],
    new Map<string, Receipt>(),
  );

  // Ids of receipts with a still-queued edit, so we can flag them "syncing".
  const updatingIds = useLiveQuery(
    async () => {
      const items = await db.outbox.where("table").equals("receipts").toArray();
      return new Set(
        items
          .filter((i) => i.op === "update")
          .map((i) => String((i.payload as { id: string }).id)),
      );
    },
    [],
    new Set<string>(),
  );

  const nameById = new Map(envelopes.map((e) => [e.id, e.name]));

  // Overlay any unsynced local edit onto the server-rendered row.
  const synced: ReceiptRow[] = receipts.map((r) => {
    const local = localById.get(r.id);
    if (!local) return r;
    return {
      ...r,
      envelope_id: local.envelope_id,
      amount: local.amount,
      note: local.note,
      // A removed photo drops the thumbnail immediately; otherwise keep the
      // server's signed URL (a replaced photo shows after it syncs + refresh).
      thumbUrl: local.photo_path === null ? null : r.thumbUrl,
      pending: updatingIds.has(r.id),
    };
  });

  const all: ReceiptRow[] = [...(pending ?? []), ...synced];
  const waitingCount = (pending?.length ?? 0) + updatingIds.size;

  const tb = totalBudget(envelopes);
  const ts = totalSpent(envelopes);
  const under = tb - ts;

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="text-slate-700 font-medium min-w-0 truncate">{month} report</div>
        <button
          data-tour="export"
          onClick={() => window.print()}
          className="no-print shrink-0 whitespace-nowrap text-[12px] text-slate-500 flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 py-1.5"
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
            <div key={e.id} className="flex justify-between items-center gap-2 px-3 py-2 text-[13px]">
              <span className="text-slate-600 flex items-center gap-1 min-w-0">
                <span className="truncate">{e.name}</span>
                {stayedUnder && (
                  <Sparkles size={12} className="text-[#639922] risu-sparkle shrink-0" />
                )}
              </span>
              <span className="text-slate-800 shrink-0">{fmt(e.spent)}</span>
            </div>
          );
        })}
        {role === "terence" && (
          <div
            className="flex justify-between items-center gap-2 px-3 py-2 text-[13px]"
            style={{ background: "#EAF0F7" }}
          >
            <span className="flex items-center gap-1.5 text-slate-700 min-w-0">
              <School size={14} className="shrink-0" />
              <span className="truncate">School buffer</span>
            </span>
            <span className="shrink-0" style={{ color: "#185FA5" }}>{fmt(buffer)}</span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-100 p-3">
        <div className="text-[12px] text-slate-500 mb-1">Receipts logged</div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-semibold text-slate-800">{all.length}</span>
          <span className="text-[12px] text-slate-400">
            {waitingCount ? `${waitingCount} waiting to sync` : "all categorised"}
          </span>
        </div>

        <div className="mt-2 space-y-1 max-h-80 overflow-auto">
          {all.slice(0, 50).map((r) => {
            const inner = (
              <>
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
              </>
            );
            return canEdit ? (
              <button
                key={r.id}
                type="button"
                onClick={() => setEditing(r)}
                data-testid={`receipt-${r.id}`}
                className="w-full flex justify-between items-center gap-2 text-[12px] text-slate-500 text-left py-0.5 -mx-1 px-1 rounded hover:bg-slate-50 active:bg-slate-100"
              >
                {inner}
              </button>
            ) : (
              <div
                key={r.id}
                className="flex justify-between items-center gap-2 text-[12px] text-slate-500"
              >
                {inner}
              </div>
            );
          })}
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

      {editing && canEdit && (
        <EditReceipt
          receipt={editing}
          envelopes={envelopes}
          currentPhotoUrl={editing.thumbUrl}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, RefreshCw, School, Settings, Trash2 } from "lucide-react";
import { db } from "@/lib/db/dexie";
import {
  addEnvelope,
  recordTermFee,
  removeEnvelope,
  startNewMonth,
  updateEnvelope,
} from "@/lib/db/manage";
import { runPush } from "@/lib/sync";
import { guidanceText, fmt } from "@/lib/domain/format";
import { nextMonth } from "@/lib/domain/budget";
import type { Account, Envelope, Household } from "@/lib/domain/types";

// Manage (Terence only). Reads the envelopes/household from the offline cache,
// writes optimistically to Dexie + the outbox, then kicks a flush. Works offline.
export function ManageScreen({
  household: initialHousehold,
  initialEnvelopes,
}: {
  household: Household;
  initialEnvelopes: Envelope[];
}) {
  const cachedEnvelopes = useLiveQuery(() => db.envelopes.orderBy("sort").toArray(), []);
  const cachedHouseholds = useLiveQuery(() => db.households.toArray(), []);

  const envelopes = cachedEnvelopes && cachedEnvelopes.length ? cachedEnvelopes : initialEnvelopes;
  const household =
    cachedHouseholds?.find((h) => h.id === initialHousehold.id) ?? initialHousehold;

  const [newName, setNewName] = useState("");
  const [newAmt, setNewAmt] = useState("");
  const [newAcct, setNewAcct] = useState<Account>("FNB");

  const flush = () => void runPush();

  function commit(id: string, fields: Partial<Envelope>) {
    updateEnvelope(id, fields).then(flush);
  }

  function toggleAccount(e: Envelope) {
    commit(e.id, { account: e.account === "FNB" ? "Stanbic" : "FNB" });
  }

  function onAdd() {
    if (!newName.trim()) return;
    const env: Envelope = {
      id: `env_${crypto.randomUUID().slice(0, 8)}`,
      household_id: household.id,
      name: newName.trim(),
      account: newAcct,
      budget: parseFloat(newAmt) || 0,
      spent: 0,
      is_weekly: false,
      is_hybrid: false,
      base: 0,
      weekly_rate: 0,
      weeks: 0,
      sort: envelopes.length,
      updated_at: new Date().toISOString(),
    };
    addEnvelope(env).then(flush);
    setNewName("");
    setNewAmt("");
    setNewAcct("FNB");
  }

  function onTermFee() {
    recordTermFee(household.id).then(flush);
  }

  function onNewMonth() {
    startNewMonth(household.id, nextMonth(household.month)).then(flush);
  }

  return (
    <div className="space-y-4">
      <div className="text-slate-700 font-medium flex items-center gap-2">
        <Settings size={18} /> Manage
      </div>

      <div data-tour="budgets" className="bg-white rounded-xl border border-slate-100 p-3">
        <div className="text-[12px] text-slate-500 mb-2">Envelope budgets</div>
        <div className="space-y-3">
          {envelopes.map((e) => (
            <EnvelopeRow
              key={e.id}
              env={e}
              onCommit={commit}
              onToggleAccount={() => toggleAccount(e)}
              onRemove={() => removeEnvelope(e.id).then(flush)}
            />
          ))}
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="text-[12px] text-slate-500 mb-2">Add a budget line</div>
          <div className="flex items-center gap-2">
            <input
              value={newName}
              onChange={(ev) => setNewName(ev.target.value)}
              placeholder="Name"
              className="flex-1 min-w-0 text-[13px] text-slate-700 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-slate-400"
            />
            <input
              type="number"
              value={newAmt}
              onChange={(ev) => setNewAmt(ev.target.value)}
              placeholder="P"
              className="w-16 text-[13px] text-right text-slate-700 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-slate-400"
            />
            <button
              onClick={() => setNewAcct(newAcct === "FNB" ? "Stanbic" : "FNB")}
              className="text-[10px] px-1.5 py-1 rounded border border-slate-200 text-slate-500 shrink-0"
            >
              {newAcct}
            </button>
            <button
              onClick={onAdd}
              disabled={!newName.trim()}
              className="rounded-lg p-1.5 text-white shrink-0 disabled:opacity-40 bg-navy"
              aria-label="Add line"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 mt-3">
          Weekly lines show a per-week amount · tap an account chip to move a line · trash to remove.
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 p-3 space-y-2">
        <div className="text-[12px] text-slate-500">School buffer · {fmt(household.buffer)}</div>
        <button
          onClick={onTermFee}
          className="w-full py-2 rounded-lg text-[13px] border border-slate-200 text-slate-600 flex items-center justify-center gap-1.5"
        >
          <School size={14} /> Record term fees paid (−{fmt(household.term_fee)})
        </button>
      </div>

      <button
        data-tour="new-month"
        onClick={onNewMonth}
        className="w-full py-3 rounded-xl text-white font-medium flex items-center justify-center gap-2 bg-navy"
      >
        <RefreshCw size={16} /> Start new month (+{fmt(household.buffer_accrual)} buffer)
      </button>
      <div className="text-[11px] text-slate-400 text-center">
        Resets spending to zero, accrues the school buffer, archives receipts.
      </div>
    </div>
  );
}

// One editable envelope row. Local input state seeded from the envelope; commits
// on blur. Hybrid lines edit base + weeks, weekly lines edit weeks, flat lines
// edit the budget directly — weeks/base recompute budget = base + rate × weeks.
function EnvelopeRow({
  env,
  onCommit,
  onToggleAccount,
  onRemove,
}: {
  env: Envelope;
  onCommit: (id: string, fields: Partial<Envelope>) => void;
  onToggleAccount: () => void;
  onRemove: () => void;
}) {
  const [budget, setBudget] = useState(String(env.budget));
  const [weeks, setWeeks] = useState(String(env.weeks));
  const [base, setBase] = useState(String(env.base));

  const commitBudget = () => onCommit(env.id, { budget: parseFloat(budget) || 0 });
  const commitWeeks = () => {
    const w = Math.max(0, parseInt(weeks, 10) || 0);
    onCommit(env.id, { weeks: w, budget: (env.base || 0) + env.weekly_rate * w });
  };
  const commitBase = () => {
    const b = parseFloat(base) || 0;
    onCommit(env.id, { base: b, budget: b + env.weekly_rate * env.weeks });
  };

  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="text-[13px] text-slate-600">{env.name}</div>
        <div className="text-[11px] text-slate-400">{guidanceText(env) || fmt(env.budget)}</div>
        <button
          onClick={onToggleAccount}
          className="mt-1 text-[10px] px-1.5 py-0.5 rounded border border-slate-200 text-slate-500"
        >
          {env.account === "FNB" ? "FNB · household" : "Stanbic · personal"}
        </button>
      </div>
      <div className="flex items-center gap-1 shrink-0 pt-0.5">
        {env.is_hybrid ? (
          <>
            <input
              type="number"
              value={base}
              onChange={(e) => setBase(e.target.value)}
              onBlur={commitBase}
              title="Month-end base"
              data-testid={`base-${env.id}`}
              className="w-16 text-[13px] text-right text-slate-800 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-slate-400"
            />
            <span className="text-[11px] text-slate-400">+wks</span>
            <input
              type="number"
              min="0"
              max="6"
              value={weeks}
              onChange={(e) => setWeeks(e.target.value)}
              onBlur={commitWeeks}
              title="Weeks"
              data-testid={`weeks-${env.id}`}
              className="w-12 text-[13px] text-right text-slate-800 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-slate-400"
            />
          </>
        ) : env.is_weekly ? (
          <input
            type="number"
            min="0"
            max="6"
            value={weeks}
            onChange={(e) => setWeeks(e.target.value)}
            onBlur={commitWeeks}
            title="Weeks commuting"
            data-testid={`weeks-${env.id}`}
            className="w-16 text-[13px] text-right text-slate-800 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-slate-400"
          />
        ) : (
          <input
            type="number"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            onBlur={commitBudget}
            data-testid={`budget-${env.id}`}
            className="w-24 text-[13px] text-right text-slate-800 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-slate-400"
          />
        )}
        <button
          onClick={onRemove}
          className="ml-1 text-slate-300"
          aria-label={`Remove ${env.name}`}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

import { db } from "./dexie";
import { enqueue } from "./outbox";
import type { Envelope } from "@/lib/domain/types";

// Optimistic admin writes: apply to the local cache and queue an outbox item.
// Callers trigger runPush() afterwards (kept out of here to avoid a sync↔db
// import cycle). All of these are gated to Terence in the UI + by RLS/RPC.

export async function updateEnvelope(id: string, fields: Partial<Envelope>): Promise<void> {
  await db.transaction("rw", db.envelopes, db.outbox, async () => {
    await db.envelopes.update(id, fields);
    await enqueue({
      client_id: crypto.randomUUID(),
      table: "envelopes",
      op: "update",
      payload: { id, ...fields },
    });
  });
}

export async function addEnvelope(env: Envelope): Promise<void> {
  await db.transaction("rw", db.envelopes, db.outbox, async () => {
    await db.envelopes.add(env);
    await enqueue({
      client_id: crypto.randomUUID(),
      table: "envelopes",
      op: "insert",
      payload: env as unknown as Record<string, unknown>,
    });
  });
}

export async function removeEnvelope(id: string): Promise<void> {
  await db.transaction("rw", db.envelopes, db.outbox, async () => {
    await db.envelopes.delete(id);
    await enqueue({
      client_id: crypto.randomUUID(),
      table: "envelopes",
      op: "delete",
      payload: { id },
    });
  });
}

// Term fee + new month go through RPCs so the buffer math / multi-row reset are
// atomic server-side; we mirror the effect locally for an instant UI.
export async function recordTermFee(householdId: string): Promise<void> {
  await db.transaction("rw", db.households, db.outbox, async () => {
    const h = await db.households.get(householdId);
    if (h) await db.households.update(householdId, { buffer: Math.max(0, h.buffer - h.term_fee) });
    await enqueue({
      client_id: crypto.randomUUID(),
      table: "rpc",
      op: "rpc",
      payload: { fn: "record_term_fee", args: { p_household: householdId } },
    });
  });
}

export async function startNewMonth(householdId: string, newMonth: string): Promise<void> {
  await db.transaction("rw", db.households, db.envelopes, db.receipts, db.outbox, async () => {
    const h = await db.households.get(householdId);
    const oldMonth = h?.month ?? null;
    if (h) {
      await db.households.update(householdId, {
        month: newMonth,
        buffer: h.buffer + h.buffer_accrual,
      });
    }
    const envs = await db.envelopes.where("household_id").equals(householdId).toArray();
    for (const e of envs) await db.envelopes.update(e.id, { spent: 0 });
    // Archive the closing month's receipts locally (kept, not deleted) to mirror
    // the start_new_month RPC.
    const recs = await db.receipts.where("household_id").equals(householdId).toArray();
    for (const r of recs) {
      if (!r.archived) await db.receipts.update(r.id, { archived: true, period: oldMonth });
    }
    await enqueue({
      client_id: crypto.randomUUID(),
      table: "rpc",
      op: "rpc",
      payload: { fn: "start_new_month", args: { p_household: householdId, p_new_month: newMonth } },
    });
  });
}

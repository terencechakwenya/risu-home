import { db } from "./dexie";
import { enqueue } from "./outbox";
import { createClient } from "@/lib/supabase/client";
import type { Receipt, Role } from "@/lib/domain/types";

export interface CaptureInput {
  household_id: string;
  envelope_id: string;
  amount: number;
  note: string;
  logged_by: Role;
  photoBlob?: Blob | null;
}

// Persist a receipt capture entirely locally (no network): the receipt row in
// Dexie, the compressed photo blob keyed by receipt id, and an outbox item for
// the sync worker to flush. The id is generated client-side so the same id is
// used for the Storage path and the server row.
export async function saveCapture(input: CaptureInput): Promise<Receipt> {
  const id = crypto.randomUUID();
  const client_id = crypto.randomUUID();
  const created_at = new Date().toISOString();

  const receipt: Receipt = {
    id,
    household_id: input.household_id,
    envelope_id: input.envelope_id,
    amount: input.amount,
    note: input.note.trim() || null,
    photo_path: null,
    logged_by: input.logged_by,
    created_at,
    client_id,
    archived: false,
    period: null,
  };

  await db.transaction("rw", db.receipts, db.photos, db.outbox, async () => {
    await db.receipts.add(receipt);
    if (input.photoBlob) {
      await db.photos.add({ receipt_id: id, blob: input.photoBlob, created_at: Date.now() });
    }
    await enqueue({
      client_id,
      table: "receipts",
      op: "insert",
      payload: receipt as unknown as Record<string, unknown>,
    });
  });

  return receipt;
}

// Undo a just-saved capture. Removes the local row/photo and any still-queued
// outbox item; if it already reached the server, the undo_receipt RPC reverses
// the envelope spend and deletes the row. Safe whether or not it synced yet.
export async function undoCapture(receipt: Receipt): Promise<void> {
  await db.transaction("rw", db.receipts, db.photos, db.outbox, async () => {
    await db.receipts.delete(receipt.id);
    await db.photos.delete(receipt.id);
    const queued = await db.outbox.where("client_id").equals(receipt.client_id).toArray();
    for (const it of queued) if (it.id != null) await db.outbox.delete(it.id);
  });

  if (typeof navigator === "undefined" || navigator.onLine) {
    try {
      const supabase = createClient();
      await supabase.rpc("undo_receipt", { p_client_id: receipt.client_id });
    } catch {
      // Offline or transient — the row never synced, so local removal suffices.
    }
  }
}

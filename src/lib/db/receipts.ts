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

// What to do with the receipt photo on an edit: leave it as-is, swap in a new
// one, or drop it entirely.
export type PhotoAction = "keep" | "replace" | "remove";

export interface UpdateInput {
  original: Receipt; // the row being edited (from the report list / server props)
  envelope_id: string;
  amount: number;
  note: string;
  photoAction: PhotoAction;
  photoBlob?: Blob | null; // required when photoAction === "replace"
}

// Edit an existing receipt entirely locally, then queue the change for sync.
// Like saveCapture this never blocks on the network: the local cache + outbox
// are updated in one transaction and the flush happens separately.
//
// Two sync shapes are possible:
//   • The original capture is still sitting unsynced in the outbox → we edit that
//     queued insert in place, so a single insert eventually lands with the final
//     values (and, for a replaced photo, uploads the new blob). No second op.
//   • The receipt already synced → we enqueue an "update" the push worker applies
//     with .update(), handling the photo (upload replacement / null out on remove).
export async function updateCapture(input: UpdateInput): Promise<void> {
  const { original } = input;
  const note = input.note.trim() || null;

  // The locally-visible version of the row after the edit. Stored via put() so a
  // server-origin receipt (the pull doesn't cache receipts) also gets a local
  // row the report can read the fresh values back from immediately.
  const updated: Receipt = {
    ...original,
    envelope_id: input.envelope_id,
    amount: input.amount,
    note,
    // The Storage path is deterministic (household/id.jpg), so a replacement
    // reuses the same path; only a removal clears it.
    photo_path: input.photoAction === "remove" ? null : original.photo_path,
  };

  await db.transaction("rw", db.receipts, db.photos, db.outbox, async () => {
    await db.receipts.put(updated);

    if (input.photoAction === "replace" && input.photoBlob) {
      await db.photos.put({
        receipt_id: original.id,
        blob: input.photoBlob,
        created_at: Date.now(),
      });
    } else if (input.photoAction === "remove") {
      await db.photos.delete(original.id);
    }

    // Is the original capture still queued (never synced)? Edit it in place.
    const queued = await db.outbox.where("client_id").equals(original.client_id).toArray();
    const insertItem = queued.find((it) => it.table === "receipts" && it.op === "insert");

    if (insertItem && insertItem.id != null) {
      const payload = {
        ...insertItem.payload,
        envelope_id: input.envelope_id,
        amount: input.amount,
        note,
      } as Record<string, unknown>;
      // A removed photo means the insert must land without one; a replacement is
      // picked up automatically because pushReceipt re-reads db.photos when
      // photo_path is still null (which it is for an unsynced capture).
      if (input.photoAction === "remove") payload.photo_path = null;
      await db.outbox.update(insertItem.id, { payload });
      return;
    }

    await enqueue({
      client_id: crypto.randomUUID(),
      table: "receipts",
      op: "update",
      payload: {
        id: original.id,
        household_id: original.household_id,
        envelope_id: input.envelope_id,
        amount: input.amount,
        note,
        _photo: input.photoAction,
      },
    });
  });
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

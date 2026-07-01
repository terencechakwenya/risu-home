import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { db, type OutboxItem } from "@/lib/db/dexie";
import { ack, fail, pending } from "@/lib/db/outbox";

const STORAGE_BUCKET = "receipts";

let running = false;

// Flush the outbox to Supabase. Safe to call repeatedly: it no-ops while already
// running or offline, and processes items oldest-first to preserve order.
export async function runPush(): Promise<void> {
  if (running) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  running = true;
  try {
    const supabase = createClient();
    const items = await pending();

    for (const item of items) {
      if (typeof navigator !== "undefined" && !navigator.onLine) break;
      try {
        if (item.op === "rpc") {
          await pushRpc(supabase, item);
        } else if (item.table === "receipts" && item.op === "insert") {
          await pushReceipt(supabase, item);
        } else if (item.table === "receipts" && item.op === "update") {
          await pushReceiptUpdate(supabase, item);
        } else {
          await pushRow(supabase, item);
        }
        await ack(item.id!);
      } catch (e) {
        await fail(item.id!, e instanceof Error ? e.message : String(e));
        // If we dropped offline mid-flush, stop and let the next reconnect retry.
        if (typeof navigator !== "undefined" && !navigator.onLine) break;
      }
    }
  } finally {
    running = false;
  }
}

async function pushReceipt(supabase: SupabaseClient, item: OutboxItem): Promise<void> {
  const payload = { ...item.payload } as Record<string, unknown> & {
    id: string;
    household_id: string;
    photo_path: string | null;
  };
  const receiptId = payload.id;

  // 1. Upload the photo blob (if any) to Storage and stamp the path.
  if (!payload.photo_path) {
    const photo = await db.photos.get(receiptId);
    if (photo) {
      const path = `${payload.household_id}/${receiptId}.jpg`;
      const { error: upErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, photo.blob, { contentType: "image/jpeg", upsert: true });
      if (upErr) throw upErr;
      payload.photo_path = path;
    }
  }

  // 2. Insert the receipt. A duplicate client_id (23505) means a previous
  //    attempt already landed it — treat as success.
  const { error } = await supabase.from("receipts").insert(payload);
  if (error && error.code !== "23505") throw error;

  // 3. Persist the path locally and drop the now-uploaded blob.
  await db.receipts.update(receiptId, { photo_path: payload.photo_path ?? null });
  await db.photos.delete(receiptId);
}

// Flush an edit to an already-synced receipt. Mirrors pushReceipt's photo
// handling: on "replace" the new blob (kept in db.photos) is uploaded to the
// same deterministic path and photo_path is set; on "remove" photo_path is
// nulled; on "keep" the photo columns are left untouched. The envelope-spend
// adjustment happens server-side in the receipts_bump_spent_update trigger.
async function pushReceiptUpdate(supabase: SupabaseClient, item: OutboxItem): Promise<void> {
  const payload = item.payload as {
    id: string;
    household_id: string;
    envelope_id: string;
    amount: number;
    note: string | null;
    _photo: "keep" | "replace" | "remove";
  };
  const { id, household_id, envelope_id, amount, note, _photo } = payload;

  const fields: Record<string, unknown> = { envelope_id, amount, note };

  if (_photo === "remove") {
    fields.photo_path = null;
  } else if (_photo === "replace") {
    const photo = await db.photos.get(id);
    if (photo) {
      const path = `${household_id}/${id}.jpg`;
      const { error: upErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, photo.blob, { contentType: "image/jpeg", upsert: true });
      if (upErr) throw upErr;
      fields.photo_path = path;
    }
  }

  const { error } = await supabase.from("receipts").update(fields).eq("id", id);
  if (error) throw error;

  // Reconcile the local mirror and drop the now-uploaded blob.
  if (_photo === "replace") await db.photos.delete(id);
  if (_photo !== "keep") {
    await db.receipts.update(id, { photo_path: (fields.photo_path ?? null) as string | null });
  }
}

// Generic insert/update/delete for envelopes / fixed_items / households.
// Updates carry { id, ...changedFields } so we only touch the edited columns
// (e.g. a budget edit never clobbers server-maintained `spent`).
async function pushRow(supabase: SupabaseClient, item: OutboxItem): Promise<void> {
  const table = item.table;
  if (item.op === "insert") {
    const { error } = await supabase.from(table).insert(item.payload);
    if (error && error.code !== "23505") throw error;
  } else if (item.op === "update") {
    const { id, ...fields } = item.payload as { id: string } & Record<string, unknown>;
    const { error } = await supabase.from(table).update(fields).eq("id", id);
    if (error) throw error;
  } else if (item.op === "delete") {
    const { id } = item.payload as { id: string };
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) throw error;
  }
}

// Call a Postgres function (record_term_fee / start_new_month).
async function pushRpc(supabase: SupabaseClient, item: OutboxItem): Promise<void> {
  const { fn, args } = item.payload as { fn: string; args: Record<string, unknown> };
  const { error } = await supabase.rpc(fn, args);
  if (error) throw error;
}

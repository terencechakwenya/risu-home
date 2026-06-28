import { db, type OutboxItem } from "./dexie";

// Outbox helpers. The actual flush-to-Supabase logic lives in src/lib/sync;
// this module only manages the local queue so UI writes stay synchronous and
// never block on the network.

/** Enqueue a write. Caller has already applied it optimistically to the local cache. */
export async function enqueue(item: Omit<OutboxItem, "id" | "created_at" | "tries">): Promise<void> {
  await db.outbox.add({
    ...item,
    created_at: Date.now(),
    tries: 0,
  });
}

/** Pending writes, oldest first — the order the sync worker should flush them. */
export function pending(): Promise<OutboxItem[]> {
  return db.outbox.orderBy("created_at").toArray();
}

/** Count of unsynced writes, for the sync-status pill. */
export function pendingCount(): Promise<number> {
  return db.outbox.count();
}

/** Remove a flushed item from the queue. */
export async function ack(id: number): Promise<void> {
  await db.outbox.delete(id);
}

/** Record a failed attempt so the worker can back off / surface the error. */
export async function fail(id: number, error: string): Promise<void> {
  const item = await db.outbox.get(id);
  if (!item) return;
  await db.outbox.update(id, { tries: item.tries + 1, last_error: error });
}

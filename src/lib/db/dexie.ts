import Dexie, { type EntityTable } from "dexie";
import type { Envelope, FixedItem, Household, Member, Receipt } from "@/lib/domain/types";

// A queued local write waiting to flush to Supabase. The sync worker drains
// this table when navigator.onLine and the Supabase client reach the server.
// `client_id` de-dupes against the receipts table on the server.
export interface OutboxItem {
  id?: number; // auto-increment local key
  client_id: string; // stable de-dupe key, also stamped on the row
  table: "receipts" | "envelopes" | "fixed_items" | "households" | "rpc";
  // insert/update/delete operate on `table`; "rpc" calls a Postgres function
  // (payload = { fn, args }) for atomic/server-computed admin actions.
  op: "insert" | "update" | "delete" | "rpc";
  payload: Record<string, unknown>;
  created_at: number; // Date.now() at enqueue
  tries: number;
  last_error?: string;
}

// A receipt photo blob held locally until the sync worker uploads it to
// Supabase Storage, after which photo_path is set and the blob is dropped.
export interface PhotoBlob {
  receipt_id: string;
  blob: Blob;
  created_at: number;
}

// Local mirror of the household. Reads come from here; a background pull
// refreshes from Supabase (last-write-wins on updated_at).
export class RisuDB extends Dexie {
  households!: EntityTable<Household, "id">;
  members!: EntityTable<Member, "id">;
  envelopes!: EntityTable<Envelope, "id">;
  fixed_items!: EntityTable<FixedItem, "id">;
  receipts!: EntityTable<Receipt, "id">;
  outbox!: EntityTable<OutboxItem, "id">;
  photos!: EntityTable<PhotoBlob, "receipt_id">;

  constructor() {
    super("risu-home");
    this.version(1).stores({
      households: "id",
      members: "id, household_id, role",
      envelopes: "id, household_id, sort",
      fixed_items: "id, household_id, sort",
      receipts: "id, household_id, envelope_id, created_at, client_id",
      outbox: "++id, client_id, table, created_at",
      photos: "receipt_id, created_at",
    });
  }
}

export const db = new RisuDB();

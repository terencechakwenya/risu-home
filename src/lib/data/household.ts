import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Badge, Envelope, FixedItem, Household, Member, Receipt } from "@/lib/domain/types";

// A receipt plus a short-lived signed thumbnail URL (the receipts bucket is
// private, so photos can't be linked directly).
export interface ReceiptView extends Receipt {
  thumbUrl: string | null;
}

// Server-side reads from Supabase. Wrapped in React `cache()` so the layout and
// page in the same request share one round-trip each. RLS scopes every query to
// the signed-in member's household.
//
// NOTE: this is a direct server read. The offline-first Dexie cache + background
// pull (spec §2) is layered on in the sync step; Home reads from Supabase for now.

export const getMember = cache(async (): Promise<Member | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("members").select("*").eq("id", user.id).single();
  return (data as Member) ?? null;
});

export const getHousehold = cache(async (): Promise<Household | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("households").select("*").single();
  return (data as Household) ?? null;
});

export const getEnvelopes = cache(async (): Promise<Envelope[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("envelopes").select("*").order("sort");
  return (data as Envelope[]) ?? [];
});

export const getFixedItems = cache(async (): Promise<FixedItem[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("fixed_items").select("*").order("sort");
  return (data as FixedItem[]) ?? [];
});

export const getReceipts = cache(async (): Promise<ReceiptView[]> => {
  const supabase = await createClient();
  // Current month only — archived receipts belong to closed months (kept for
  // history, retrievable separately).
  const { data } = await supabase
    .from("receipts")
    .select("*")
    .eq("archived", false)
    .order("created_at", { ascending: false });
  const receipts = (data as Receipt[]) ?? [];

  // Batch-sign thumbnails for the receipts that have an uploaded photo.
  const paths = receipts.map((r) => r.photo_path).filter((p): p is string => !!p);
  const urlByPath = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await supabase.storage
      .from("receipts")
      .createSignedUrls(paths, 3600);
    for (const s of signed ?? []) {
      if (s.signedUrl && s.path) urlByPath.set(s.path, s.signedUrl);
    }
  }

  return receipts.map((r) => ({
    ...r,
    thumbUrl: r.photo_path ? urlByPath.get(r.photo_path) ?? null : null,
  }));
});

// ── Gamification reads (Pearl) ──────────────────────────────────────────────

export const getBadges = cache(async (): Promise<Badge[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("badges")
    .select("*")
    .order("earned_at", { ascending: false });
  return (data as Badge[]) ?? [];
});

// Timestamps of Pearl's logged receipts (incl. archived), for the logging streak.
// Streak day-bucketing is done client-side so it uses Pearl's local timezone.
export const getPearlReceiptDates = cache(async (): Promise<string[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("receipts")
    .select("created_at")
    .eq("logged_by", "pearl")
    .order("created_at", { ascending: false })
    .limit(120);
  return ((data as { created_at: string }[]) ?? []).map((r) => r.created_at);
});

export const pearlHasReceipts = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  const { count } = await supabase
    .from("receipts")
    .select("id", { count: "exact", head: true })
    .eq("logged_by", "pearl");
  return (count ?? 0) > 0;
});

// Botswana is UTC+02:00 year-round (no DST), so the offset is constant.
const BOTSWANA_OFFSET_MS = 2 * 60 * 60 * 1000;

// Start of the current week (Monday 00:00 Botswana time), returned as the real
// UTC instant. Works regardless of the server's own timezone: shift into
// Botswana wall-clock, snap to Monday via UTC fields, then shift back.
function startOfWeekBotswana(now = new Date()): Date {
  const bw = new Date(now.getTime() + BOTSWANA_OFFSET_MS);
  const mondayOffset = (bw.getUTCDay() + 6) % 7; // Monday = 0
  bw.setUTCHours(0, 0, 0, 0);
  bw.setUTCDate(bw.getUTCDate() - mondayOffset);
  return new Date(bw.getTime() - BOTSWANA_OFFSET_MS);
}

// Spend per envelope since the start of this week (Monday, Botswana time), for
// the "this week" framing on weekly envelopes.
export const getWeekSpendByEnvelope = cache(async (): Promise<Record<string, number>> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("receipts")
    .select("envelope_id, amount")
    .eq("archived", false)
    .gte("created_at", startOfWeekBotswana().toISOString());

  const map: Record<string, number> = {};
  for (const r of (data as { envelope_id: string; amount: number }[]) ?? []) {
    map[r.envelope_id] = (map[r.envelope_id] ?? 0) + Number(r.amount);
  }
  return map;
});

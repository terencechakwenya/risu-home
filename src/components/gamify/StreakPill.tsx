"use client";

import { Flame } from "lucide-react";
import { computeStreak } from "@/lib/domain/streak";

// Logging streak — consecutive days Pearl logged at least one receipt. Computed
// client-side (local timezone). Gentle: shows nothing when there's no streak,
// so a missed day never nags.
export function StreakPill({ dates }: { dates: string[] }) {
  const streak = computeStreak(dates);
  if (streak < 1) return null;

  return (
    <div
      className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2.5 py-1 text-[12px] font-medium"
      title={`${streak}-day logging streak — keep it going!`}
    >
      <Flame size={13} className="text-amber-500 risu-sparkle" />
      {streak} day{streak > 1 ? "s" : ""}
    </div>
  );
}

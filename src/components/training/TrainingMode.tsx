"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { createClient } from "@/lib/supabase/client";
import { db } from "@/lib/db/dexie";
import { TRAINING_STEPS } from "@/lib/training-steps";
import type { Member, Role } from "@/lib/domain/types";

// Pick the tour for the current screen + role. Per-screen, so each one only
// highlights elements that exist on that route. Every screen a role can reach
// has a tour, so the "?" is always available.
function tourIdFor(pathname: string, role: Role): string | null {
  if (pathname === "/") return role === "pearl" ? "pearl_home" : "terence_home";
  if (pathname.startsWith("/add")) return role === "pearl" ? "add_receipt" : "terence_add";
  if (pathname.startsWith("/report")) return role === "pearl" ? "pearl_report" : "terence_report";
  if (pathname.startsWith("/manage")) return role === "terence" ? "terence_manage" : null;
  return null;
}

// driver.js Training Mode. Auto-runs each screen's tour once (tracked per-user
// on members.tours_seen, gated by members.training_mode), offers an always-
// visible floating "?" to replay, and shows a one-line "all set" note when a
// tour finishes. Completion is saved to the member row so it follows the user
// across phones.
export function TrainingMode({ member }: { member: Member | null }) {
  const pathname = usePathname();
  const [seen, setSeen] = useState<string[]>(member?.tours_seen ?? []);
  const [done, setDone] = useState(false);
  const autoRan = useRef<Set<string>>(new Set());

  const role: Role = member?.role ?? "pearl";
  const tourId = member ? tourIdFor(pathname, role) : null;

  async function markSeen(id: string) {
    setSeen((prev) => (prev.includes(id) ? prev : [...prev, id]));
    if (!member) return;
    const next = seen.includes(id) ? seen : [...seen, id];
    try {
      const supabase = createClient();
      await supabase.from("members").update({ tours_seen: next }).eq("id", member.id);
      await db.members.update(member.id, { tours_seen: next });
    } catch {
      // Offline — local state still prevents a re-run this session.
    }
  }

  function runTour(id: string) {
    const steps = TRAINING_STEPS[id];
    if (!steps?.length) return;
    const d = driver({
      showProgress: steps.length > 1,
      popoverClass: "risu-driver",
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Got it",
      steps: steps.map((s) => ({
        ...(s.element ? { element: s.element } : {}),
        popover: { title: s.title, description: s.body },
      })),
      onDestroyed: () => {
        void markSeen(id);
        setDone(true);
      },
    });
    d.drive();
  }

  // Auto-run once per screen.
  useEffect(() => {
    if (!member || !tourId || !member.training_mode) return;
    if (seen.includes(tourId) || autoRan.current.has(tourId)) return;
    autoRan.current.add(tourId);
    const t = setTimeout(() => runTour(tourId), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourId, member?.id]);

  // Auto-hide the "all set" note.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 4000);
    return () => clearTimeout(t);
  }, [done]);

  if (!tourId) return null;

  return (
    <>
      {done && (
        <div className="no-print fixed inset-x-0 bottom-24 z-40 flex justify-center px-4">
          <div className="bg-navy text-white text-[12px] rounded-full px-4 py-2 shadow-lg">
            You&apos;re all set — tap ? anytime to see this again.
          </div>
        </div>
      )}
      <button
        onClick={() => runTour(tourId)}
        className="no-print fixed right-4 bottom-20 z-40 w-10 h-10 rounded-full bg-navy text-white shadow-lg flex items-center justify-center text-lg font-semibold ring-2 ring-white"
        aria-label="Show help for this screen"
        title="Help"
      >
        ?
      </button>
    </>
  );
}

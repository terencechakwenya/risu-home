"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, RefreshCw, WifiOff } from "lucide-react";
import { db } from "@/lib/db/dexie";

// Small status pill so Pearl trusts the sync. Reads the live outbox count from
// Dexie and the browser's online state. The actual flushing is wired up later
// in src/lib/sync; this only reflects queue depth + connectivity.
export function SyncPill() {
  const pending = useLiveQuery(() => db.outbox.count(), [], 0);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  let icon = <Check size={12} />;
  let label = "All synced";
  let cls = "bg-[#EAF3DE] text-[#3B6D11]";

  if (!online) {
    icon = <WifiOff size={12} />;
    label = pending ? `${pending} waiting · offline` : "Offline";
    cls = "bg-slate-100 text-slate-500";
  } else if (pending) {
    icon = <RefreshCw size={12} />;
    label = `${pending} waiting to sync`;
    cls = "bg-[#FDF4E3] text-[#BA7517]";
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${cls}`}
    >
      {icon}
      {label}
    </div>
  );
}

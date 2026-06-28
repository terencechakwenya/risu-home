"use client";

import { useEffect } from "react";
import { runPull, runPush, runSync } from "@/lib/sync";

// App-wide sync driver. Pulls + flushes on mount, flushes again whenever the
// device comes back online. Renders nothing. Mounted once in the app shell.
export function SyncManager() {
  useEffect(() => {
    runSync().catch(() => {});

    const onOnline = () => {
      runPull()
        .then(runPush)
        .catch(() => {});
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  return null;
}

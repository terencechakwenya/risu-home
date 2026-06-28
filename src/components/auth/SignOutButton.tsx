"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Signs out via Supabase, then sends the user back to /login. Handy for
// switching between the Pearl and Terence logins while testing.
export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] text-white/90 disabled:opacity-50"
      style={{ background: "rgba(255,255,255,0.12)" }}
      aria-label="Sign out"
    >
      <LogOut size={13} />
      {loading ? "…" : "Sign out"}
    </button>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LogIn, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Email + password sign-in for Pearl / Terence. The browser Supabase client
// writes the session to cookies, so the proxy + server components see it.
export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Land on Home; refresh so server components pick up the new session.
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="w-full space-y-4">
      <div>
        <label htmlFor="email" className="block text-[13px] text-slate-500 mb-1.5">
          Email
        </label>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full text-[16px] text-slate-800 outline-none border border-slate-200 rounded-xl px-3.5 py-3 focus:border-navy"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-[13px] text-slate-500 mb-1.5">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full text-[16px] text-slate-800 outline-none border border-slate-200 rounded-xl px-3.5 py-3 focus:border-navy"
        />
      </div>

      {error && (
        <div className="text-[13px] text-red rounded-lg bg-[#FCEBEB] px-3 py-2">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !email || !password}
        className="w-full py-3.5 rounded-xl text-white font-medium flex items-center justify-center gap-2 bg-navy transition disabled:opacity-40"
      >
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin" /> Signing in…
          </>
        ) : (
          <>
            Sign in <LogIn size={18} />
          </>
        )}
      </button>
    </form>
  );
}

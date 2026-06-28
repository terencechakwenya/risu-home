import { LoginForm } from "@/components/auth/LoginForm";

// Login — Supabase email auth for Pearl / Terence. The proxy redirects
// unauthenticated users here and signed-in users away to Home.
export default function LoginPage() {
  return (
    <main className="mx-auto max-w-md min-h-screen flex flex-col justify-center px-6 py-10">
      <div className="text-center mb-8">
        <div className="text-3xl font-semibold text-navy">RISU Home</div>
        <div className="text-[13px] text-slate-400 mt-1">Chakwenya household budget</div>
      </div>

      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
        <LoginForm />
      </div>

      <div className="text-center text-[11px] text-slate-400 mt-6">
        Pearl &amp; Terence only · sign in to log receipts and see the budget.
      </div>
    </main>
  );
}

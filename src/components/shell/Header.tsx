import type { Role } from "@/lib/domain/types";
import { SignOutButton } from "@/components/auth/SignOutButton";

// Top bar: navy band with the role context line and the current month.
// In the prototype this also had a Pearl/Terence toggle; in production the
// role comes from the signed-in member, so there's no switcher.
export function Header({ role, month }: { role: Role; month: string }) {
  return (
    <header className="no-print bg-navy px-4 pt-5 pb-4 text-white">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] tracking-wide text-[#9FB4CE]">
            {role === "pearl" ? "Pearl's budget" : "Admin view · you + Pearl"}
          </div>
          <div className="text-lg font-medium">{month}</div>
        </div>
        <SignOutButton />
      </div>
    </header>
  );
}

import { Header } from "@/components/shell/Header";
import { TabBar } from "@/components/shell/TabBar";
import { SyncPill } from "@/components/shell/SyncPill";
import { SyncManager } from "@/components/sync/SyncManager";
import { TrainingMode } from "@/components/training/TrainingMode";
import { getMember, getHousehold } from "@/lib/data/household";
import type { Role } from "@/lib/domain/types";

// Shared chrome for the signed-in screens (Home / Add / Report / Manage).
// Role + month come from the signed-in member and household. The proxy
// guarantees an authenticated user before this renders; if a member row is
// somehow missing we fall back to the least-privileged view (pearl).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [member, household] = await Promise.all([getMember(), getHousehold()]);
  const role: Role = member?.role ?? "pearl";
  const month = household?.month ?? "";

  return (
    <div
      className="mx-auto max-w-md min-h-screen flex flex-col"
      style={{ background: "#F4F6F9" }}
    >
      <SyncManager />
      <Header role={role} month={month} />
      <div className="no-print px-4 pt-3 flex justify-end">
        <SyncPill />
      </div>
      <main className="flex-1 px-4 pb-28 pt-2">{children}</main>
      <TabBar role={role} />
      <TrainingMode member={member} />
    </div>
  );
}

import { ManageScreen } from "@/components/manage/ManageScreen";
import { getEnvelopes, getHousehold, getMember } from "@/lib/data/household";

// Manage (Terence only) — add/remove budget lines, edit budget/weeks/base,
// account toggle, record term fees, start new month. All offline-capable.
export default async function ManagePage() {
  const [member, household, envelopes] = await Promise.all([
    getMember(),
    getHousehold(),
    getEnvelopes(),
  ]);

  if (member?.role !== "terence") {
    return (
      <div className="bg-white rounded-xl p-4 border border-slate-100 text-[13px] text-slate-500">
        Manage is for the household admin only.
      </div>
    );
  }

  if (!household) {
    return (
      <div className="bg-white rounded-xl p-4 border border-slate-100 text-[13px] text-slate-500">
        No household found.
      </div>
    );
  }

  return <ManageScreen household={household} initialEnvelopes={envelopes} />;
}

import { AddReceipt } from "@/components/add/AddReceipt";
import { getEnvelopes, getMember, pearlHasReceipts } from "@/lib/data/household";

// Add receipt — offline-first capture (Dexie outbox + queued photo upload).
// Server provides initial envelopes/member; the client component prefers the
// offline Dexie cache so capture works with no connection.
export default async function AddPage() {
  const [member, envelopes] = await Promise.all([getMember(), getEnvelopes()]);
  // For Pearl's first-receipt celebration: has she logged any receipt before?
  const hadReceipts = member?.role === "pearl" ? await pearlHasReceipts() : true;

  return (
    <AddReceipt
      initialEnvelopes={envelopes}
      initialMember={member}
      pearlHadReceipts={hadReceipts}
    />
  );
}

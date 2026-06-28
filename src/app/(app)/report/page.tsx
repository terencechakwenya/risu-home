import { ReportScreen } from "@/components/report/ReportScreen";
import {
  getBadges,
  getEnvelopes,
  getHousehold,
  getMember,
  getReceipts,
} from "@/lib/data/household";

// Report — month totals, per-envelope spend, the receipt log with photo
// thumbnails, and export. The school buffer is part of Terence's admin layer,
// so it's only shown to him. Pearl additionally sees her earned badges.
export default async function ReportPage() {
  const [member, household, envelopes, receipts] = await Promise.all([
    getMember(),
    getHousehold(),
    getEnvelopes(),
    getReceipts(),
  ]);

  const role = member?.role ?? "pearl";
  const badges = role === "pearl" ? await getBadges() : [];

  return (
    <ReportScreen
      role={role}
      month={household?.month ?? ""}
      buffer={household?.buffer ?? 0}
      envelopes={envelopes}
      receipts={receipts}
      badges={badges}
    />
  );
}

import { JournalView } from "@/components/journal/JournalView";
import type { TimelineFilter } from "@/lib/journal";
import { loadTimeline } from "@/server/entry-actions";

export const metadata = { title: "记录" };

type Props = {
  searchParams: Promise<{ filter?: string; month?: string }>;
};

function parseFilter(raw?: string): TimelineFilter {
  if (raw === "mine" || raw === "yours" || raw === "month") return raw;
  return "all";
}

export default async function JournalPage({ searchParams }: Props) {
  const sp = await searchParams;
  const filter = parseFilter(sp.filter);
  const month = sp.month;
  const data = await loadTimeline({ filter, month });

  return (
    <JournalView
      key={`${filter}-${month ?? data.currentMonth}`}
      initialItems={data.items}
      stats={data.stats}
      partnerNickname={data.partnerNickname}
      initialFilter={filter}
      initialMonth={month || data.currentMonth}
      currentMonth={data.currentMonth}
    />
  );
}

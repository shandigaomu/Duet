import { DaysView } from "@/components/journal/DaysView";
import { loadDaysPage } from "@/server/daymark-actions";

export const metadata = { title: "日子" };

type Props = {
  searchParams: Promise<{ month?: string; day?: string }>;
};

export default async function JournalDaysPage({ searchParams }: Props) {
  const sp = await searchParams;
  const data = await loadDaysPage({
    month: sp.month,
    selectedDay: sp.day,
  });

  return (
    <DaysView
      key={`${data.month}-${data.selectedDay}-${data.upcoming.length}-${data.past.length}`}
      month={data.month}
      selectedDay={data.selectedDay}
      today={data.today}
      markedDays={data.markedDays}
      dayMarks={data.dayMarks}
      upcoming={data.upcoming}
      past={data.past}
    />
  );
}

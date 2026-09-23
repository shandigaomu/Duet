import { TodayView } from "@/components/today/TodayView";
import { loadUpcomingHint } from "@/server/daymark-actions";
import { loadTodayCheckIns } from "@/server/checkin-actions";
import { countEntriesForDay } from "@/server/entry-actions";

export const metadata = { title: "今日" };

export default async function TodayPage() {
  const [data, diary, dayHint] = await Promise.all([
    loadTodayCheckIns(),
    countEntriesForDay(),
    loadUpcomingHint(),
  ]);

  return (
    <TodayView
      key={`${data.day}-${data.mine?.updatedAt ?? "m"}-${data.yours?.updatedAt ?? "y"}`}
      initialMine={data.mine}
      initialYours={data.yours}
      partnerWasUnread={data.partnerWasUnread}
      partnerNickname={data.partnerNickname}
      todayEntryCount={diary.count}
      dayHint={dayHint}
    />
  );
}

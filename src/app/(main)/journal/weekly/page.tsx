import { WeeklyView } from "@/components/journal/WeeklyView";
import { JournalSectionTabs } from "@/components/journal/JournalSectionTabs";
import {
  Workbench,
  WorkbenchToolbar,
} from "@/components/shell/Workbench";
import { loadWeeklyMood } from "@/server/weekly-actions";

export const metadata = { title: "周报" };

export default async function WeeklyPage() {
  const data = await loadWeeklyMood();

  return (
    <Workbench
      eyebrow="Journal · Weekly"
      title="周报"
      description="近 8 周两个人的心情与记录节奏。"
      toolbar={
        <WorkbenchToolbar>
          <JournalSectionTabs />
        </WorkbenchToolbar>
      }
    >
      <WeeklyView
        weeks={data.weeks}
        togetherDaysThisWeek={data.togetherDaysThisWeek}
        togetherWeeksStreak={data.togetherWeeksStreak}
        partnerNickname={data.partnerNickname}
      />
    </Workbench>
  );
}

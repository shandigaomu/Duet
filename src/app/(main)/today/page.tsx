import { TodayView } from "@/components/today/TodayView";
import { loadUpcomingHint } from "@/server/daymark-actions";
import { loadTodayCheckIns } from "@/server/checkin-actions";
import {
  countEntriesForDay,
  loadTodayOnThisDay,
  loadTodayOnThisDayList,
} from "@/server/entry-actions";
import { loadCollabCards } from "@/server/collab-view";
import { loadTodayLetterHint } from "@/server/letter-hint";
import { requirePaired } from "@/lib/guards";

export const metadata = { title: "今日" };

export default async function TodayPage() {
  const [data, diary, dayHint, onThisDay, onThisDayList, letterHint] =
    await Promise.all([
      loadTodayCheckIns(),
      countEntriesForDay(),
      loadUpcomingHint(),
      loadTodayOnThisDay(),
      loadTodayOnThisDayList(),
      loadTodayLetterHint(),
    ]);

  const { user, membership } = await requirePaired();
  // P2-N4：对方时区（对方成员的 timeZone；null = 上海）
  const partnerMember = membership.space.members.find(
    (m) => m.userId !== membership.userId,
  );
  // P2-N8：合写邀请卡数据
  const collab = await loadCollabCards(user.id, membership.spaceId);

  return (
    <TodayView
      key={`${data.day}-${data.mine?.updatedAt ?? "m"}-${data.yours?.updatedAt ?? "y"}`}
      initialMine={data.mine}
      initialYours={data.yours}
      partnerWasUnread={data.partnerWasUnread}
      partnerNickname={data.partnerNickname}
      todayEntryCount={diary.count}
      dayHint={dayHint}
      anniversaryDay={membership.space.anniversaryDay ?? null}
      onThisDay={onThisDay}
      hugFromPartner={data.hugFromPartner}
      hugGivenByMe={data.hugGivenByMe}
      partnerTimeZone={partnerMember?.timeZone ?? null}
      collabInvite={collab.incoming}
      myPendingInvite={collab.mine}
      streakBadge={data.streakBadge}
      onThisDayList={onThisDayList}
      letterHint={letterHint}
    />
  );
}

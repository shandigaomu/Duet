import { dayBeforeNotifyTarget, letterState } from "@/lib/letter";
import {
  pushLetterDayBefore,
  pushLetterUnlocked,
  pushToPartner,
} from "@/server/push";

/**
 * P5-O4 时光信两条「访问触发」提醒的单一封装（原 letter-actions 内手写两遍的模式归一）：
 * - 解锁当天：任意一方（写信方/收信方）看到信时，推给对方；
 * - 前夜（P4-W2）：仅写信方在访时推收信方，不泄露标题与正文。
 * 去重语义不变：进程内 Set，每进程每信最多一次；漏推不补（无 cron，设计如此，
 * 打开信页/今日页的倒计时是保底展示）。
 */
const unlockNotified = new Set<string>();
const dayBeforeNotified = new Set<string>();

export type LetterTouchRow = {
  id: string;
  title: string | null;
  unlockDay: string;
  authorId: string;
};

export function notifyLettersTouch(opts: {
  rows: LetterTouchRow[];
  today: string;
  viewerId: string;
  partnerId: string | null;
}): void {
  for (const row of opts.rows) {
    // 解锁当天：首见触发（谁看到都算，推给对方）
    if (
      letterState(row.unlockDay, opts.today) === "unlocking" &&
      !unlockNotified.has(row.id)
    ) {
      unlockNotified.add(row.id);
      pushToPartner(
        opts.partnerId,
        opts.viewerId,
        pushLetterUnlocked(row.title),
      );
    }

    // 前夜：仅写信方访视时触发（收信方自己打开时人在场，不需要推）
    if (dayBeforeNotified.has(row.id)) continue;
    const target = dayBeforeNotifyTarget({
      unlockDay: row.unlockDay,
      today: opts.today,
      authorId: row.authorId,
      viewerId: opts.viewerId,
      partnerId: opts.partnerId,
    });
    if (!target) continue;
    dayBeforeNotified.add(row.id);
    pushToPartner(target, opts.viewerId, pushLetterDayBefore());
  }
}



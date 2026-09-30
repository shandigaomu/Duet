import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";

/**
 * V3-N2 邮件通知：SMTP 即时信（可关）+ 每周一摘要。
 * 复用 Web Push 的四类事件：主请求里 fire-and-forget，绝不阻塞、绝不抛错。
 */

export function emailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT);
}

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function mailer() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
    });
  }
  return transporter;
}

function fromAddress() {
  return process.env.SMTP_FROM || `Duet <${process.env.SMTP_USER || "duet@example.com"}>`;
}

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";

function shell(title: string, inner: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f3ef;padding:32px 16px;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;color:#22312e;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:36px 32px;">
    <p style="margin:0 0 4px;font-size:13px;letter-spacing:0.12em;color:#8aa39c;">DUET</p>
    <h1 style="margin:0 0 20px;font-size:20px;font-weight:600;">${title}</h1>
    ${inner}
    <p style="margin:28px 0 0;font-size:12px;color:#9aa8a3;">
      <a href="${APP_URL}/me" style="color:#8aa39c;">通知偏好设置</a> · 这封信来自只属于两个人的小空间
    </p>
  </div></body></html>`;
}

type MailKind = "checkin" | "entry" | "list";

const KIND_TEXT: Record<MailKind, string> = {
  checkin: "更新了今日",
  entry: "写了一篇新日记",
  list: "完成了清单里的一个小愿望",
};

/** 即时事件邮件：默认关闭（NotifyPref.emailEnabled），偏好缺失不发送 */
export function sendEventEmail(
  toUserId: string | null | undefined,
  actorId: string,
  actorNickname: string,
  kind: MailKind,
) {
  void (async () => {
    try {
      if (!emailConfigured() || !toUserId) return;
      if (toUserId === actorId) return;
      const [pref, user] = await Promise.all([
        prisma.notifyPref.findUnique({ where: { userId: toUserId } }),
        prisma.user.findUnique({
          where: { id: toUserId },
          select: { email: true },
        }),
      ]);
      if (!pref?.emailEnabled || !user?.email) return;
      await mailer().sendMail({
        from: fromAddress(),
        to: user.email,
        subject: `Duet · ${actorNickname} ${KIND_TEXT[kind]}`,
        html: shell(
          `${actorNickname} ${KIND_TEXT[kind]}`,
          `<p style="margin:0;font-size:14px;line-height:1.8;">打开 Duet 看看吧。</p>
           <p style="margin:20px 0 0;"><a href="${APP_URL}/today" style="display:inline-block;background:#1f4a45;color:#f5f6f4;text-decoration:none;font-size:14px;padding:10px 22px;border-radius:10px;">去今日</a></p>`,
        ),
      });
    } catch {
      // 邮件失败静默
    }
  })();
}

export type WeeklySummaryData = {
  nickname: string;
  checkInDays: number;
  entryCount: number;
  nearDaymarks: Array<{ title: string; day: string }>;
};

/** 每周一 9:00 摘要邮件（emailWeekly 开启者） */
export async function sendWeeklySummaryEmail(
  toUserId: string,
  data: WeeklySummaryData,
) {
  if (!emailConfigured()) return;
  const user = await prisma.user.findUnique({
    where: { id: toUserId },
    select: { email: true },
  });
  if (!user?.email) return;

  const near =
    data.nearDaymarks.length > 0
      ? `<ul style="margin:8px 0 0;padding-left:18px;font-size:14px;line-height:1.9;">${data.nearDaymarks
          .map(
            (d) =>
              `<li>${escapeHtml(d.title)} · ${escapeHtml(d.day)}</li>`,
          )
          .join("")}</ul>`
      : `<p style="margin:8px 0 0;font-size:14px;color:#7d8c88;">最近 14 天没有临近的日子</p>`;

  await mailer().sendMail({
    from: fromAddress(),
    to: user.email,
    subject: "Duet · 上周的小结",
    html: shell(
      "上周的小结",
      `<p style="margin:0;font-size:14px;line-height:1.9;">${escapeHtml(
        data.nickname,
      )}，上周你们一起记下了——</p>
       <p style="margin:12px 0 0;font-size:14px;line-height:1.9;">📝 日记 <b>${data.entryCount}</b> 篇 · 🌤 同步 <b>${data.checkInDays}</b> 天</p>
       <p style="margin:18px 0 0;font-size:13px;color:#7d8c88;">临近的日子</p>
       ${near}`,
    ),
  });
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 汇总一周数据（上周一到上周日，上海时区） */
export async function collectWeeklySummary(
  spaceId: string,
  viewerId: string,
): Promise<WeeklySummaryData> {
  const membership = await prisma.spaceMember.findFirst({
    where: { spaceId, userId: viewerId },
    include: { space: { include: { members: true } } },
  });
  const nickname = membership?.nickname ?? "你";

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [y, m, d] = today.split("-").map(Number);
  const utc = Date.UTC(y!, m! - 1, d!);
  const wd = new Date(utc).getUTCDay();
  const thisMonday = utc + (wd === 0 ? -6 : 1 - wd) * 86_400_000;
  const lastMonday = thisMonday - 7 * 86_400_000;
  const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const start = fmt(lastMonday);
  const end = fmt(thisMonday - 86_400_000);

  const [checkIns, entries, dayMarks] = await Promise.all([
    prisma.checkIn.findMany({
      where: { spaceId, day: { gte: start, lte: end } },
      select: { authorId: true, day: true },
    }),
    prisma.entry.count({
      where: { spaceId, day: { gte: start, lte: end }, deletedAt: null },
    }),
    prisma.dayMark.findMany({ where: { spaceId }, orderBy: { day: "asc" } }),
  ]);

  const days = new Set<string>();
  for (const row of checkIns) {
    const both = checkIns.some(
      (r) => r.day === row.day && r.authorId !== row.authorId,
    );
    if (both) days.add(row.day);
  }

  const horizon = new Date(utc + 14 * 86_400_000).toISOString().slice(0, 10);
  const md = today.slice(5);
  const nearDaymarks = dayMarks
    .filter((mark) => {
      if (mark.day >= today && mark.day <= horizon) return true;
      if (mark.yearly) {
        const next = `2000-${mark.day.slice(5)}`;
        const cur = `2000-${md}`;
        return next >= cur && mark.day.slice(5) <= horizon.slice(5);
      }
      return false;
    })
    .slice(0, 5)
    .map((mark) => ({ title: mark.title, day: mark.day }));

  return { nickname, checkInDays: days.size, entryCount: entries, nearDaymarks };
}

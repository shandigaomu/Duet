import { createHash } from "crypto";
import webpush from "web-push";
import { prisma } from "@/lib/db";

/**
 * V3-N1 Web Push：订阅存取 + 投递。
 * 写库成功后 fire-and-forget 投递（失败仅清失效订阅，绝不影响主请求）。
 */

export type PushEventKind =
  | "checkin" // 今日更新
  | "entry" // 新日记
  | "list" // 清单完成
  | "hug" // 被抱抱
  | "letter" // 时光信解锁
  | "collab"; // P3-T1 合写（邀请/交稿/成稿）

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: PushEventKind;
};

export function pushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
  );
}

function vapidOptions() {
  return {
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    privateKey: process.env.VAPID_PRIVATE_KEY!,
    subject: process.env.VAPID_SUBJECT || "mailto:duet@example.com",
  };
}

function endpointHash(endpoint: string) {
  return createHash("sha256").update(endpoint).digest("hex");
}

type SubscribeInput = {
  userId: string;
  subscription: {
    endpoint?: string | null;
    keys?: { p256dh?: string | null; auth?: string | null } | null;
  };
};

export async function saveSubscription(
  userId: string,
  subscription: SubscribeInput["subscription"],
): Promise<{ ok: boolean; error?: string }> {
  const endpoint = subscription.endpoint;
  const p256dh = subscription.keys?.p256dh;
  const auth = subscription.keys?.auth;
  if (
    !endpoint ||
    !endpoint.startsWith("https://") ||
    !p256dh ||
    !auth ||
    p256dh.length > 160 ||
    auth.length > 60
  ) {
    return { ok: false, error: "订阅信息无效" };
  }
  await prisma.pushSubscription.upsert({
    where: {
      userId_endpointHash: {
        userId,
        endpointHash: endpointHash(endpoint),
      },
    },
    create: {
      userId,
      endpoint,
      endpointHash: endpointHash(endpoint),
      p256dh,
      auth,
    },
    update: { p256dh, auth },
  });
  return { ok: true };
}

export async function deleteSubscription(userId: string, endpoint: string) {
  await prisma.pushSubscription.deleteMany({
    where: { userId, endpointHash: endpointHash(endpoint) },
  });
}

/** 投递给单用户全部设备；410/404 视为失效订阅并清除 */
async function deliverToUser(userId: string, payload: PushPayload) {
  if (!pushConfigured()) return;
  const subs = await prisma.pushSubscription.findMany({
    where: { userId },
  });
  if (subs.length === 0) return;

  webpush.setVapidDetails(
    vapidOptions().subject,
    vapidOptions().publicKey,
    vapidOptions().privateKey,
  );

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 12 },
        );
      } catch (err) {
        const statusCode =
          typeof err === "object" && err && "statusCode" in err
            ? (err as { statusCode?: number }).statusCode
            : undefined;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription
            .delete({ where: { id: sub.id } })
            .catch(() => undefined);
        }
      }
    }),
  );
}

/**
 * 事件投递：不阻塞主请求。调用方须先落库。
 * partnerId 为空或等于操作者时跳过（自己不给自己推）。
 */
export function pushToPartner(
  partnerId: string | null | undefined,
  actorId: string,
  payload: PushPayload,
) {
  if (!partnerId || partnerId === actorId || !pushConfigured()) return;
  void deliverToUser(partnerId, payload).catch(() => undefined);
}

// —— 业务事件文案（保持克制、不轰炸） ——

export function pushCheckinUpdated(nickname: string) {
  return {
    title: "今日更新",
    body: `${nickname} 刚刚更新了今天`,
    url: "/today",
    tag: "checkin" as const,
  };
}

export function pushEntryCreated(nickname: string, title: string | null) {
  return {
    title: "新日记",
    body: title ? `${nickname} 写了《${title}》` : `${nickname} 写了一篇新日记`,
    url: "/journal",
    tag: "entry" as const,
  };
}

export function pushListDone(nickname: string, itemTitle: string) {
  return {
    title: "清单完成",
    body: `${nickname} 完成了「${itemTitle}」`,
    url: "/us",
    tag: "list" as const,
  };
}

export function pushHugReceived(nickname: string) {
  return {
    title: "收到一个抱抱",
    body: `${nickname} 给了你一个抱抱 🫂`,
    url: "/today",
    tag: "hug" as const,
  };
}

export function pushLetterUnlocked(title: string | null) {
  return {
    title: "时光信解锁",
    body: title ? `「${title}」今天可以打开了` : "有一封信今天可以打开了",
    url: "/us/letters",
    tag: "letter" as const,
  };
}

// —— P3-T1 合写通知（邀请/交稿/成稿三时刻） ——

export function pushCollabInvited(
  nickname: string,
  day: string,
  title: string | null,
) {
  return {
    title: "合写邀请",
    body: title
      ? `${nickname} 想邀你合写 ${day} 的《${title}》`
      : `${nickname} 想邀你合写 ${day} 的日记`,
    url: "/today",
    tag: "collab" as const,
  };
}

export function pushCollabSectionDone(nickname: string) {
  return {
    title: "合写进展",
    body: `${nickname} 写好了 TA 那一段`,
    url: "/today",
    tag: "collab" as const,
  };
}

export function pushCollabPublished(title: string | null) {
  return {
    title: "合写完成",
    body: title ? `《${title}》合写完成了` : "你们的合写日记完成了",
    url: "/journal",
    tag: "collab" as const,
  };
}

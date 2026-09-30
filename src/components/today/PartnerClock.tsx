"use client";

import { useEffect, useState } from "react";

/** 时段问候（按当地时间小时） */
function greeting(hour: number) {
  if (hour >= 5 && hour < 11) return "早安";
  if (hour >= 11 && hour < 14) return "午安";
  if (hour >= 14 && hour < 18) return "下午好";
  if (hour >= 18 && hour < 23) return "晚上好";
  return "夜深了";
}

function formatTime(zone: string, date: Date) {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: zone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    return null;
  }
}

type PartnerClockProps = {
  /** 对方时区（null = Asia/Shanghai） */
  timeZone: string | null;
  partnerNickname: string;
};

/**
 * P2-N4：对方当地时间 + 时段问候，每分钟刷新。
 * 纯客户端渲染（Intl 时区在服务端/客户端一致但为避免水合偏差首帧显示 —）。
 */
export function PartnerClock({ timeZone, partnerNickname }: PartnerClockProps) {
  const zone = timeZone || "Asia/Shanghai";
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // 延迟一帧再置时间，避免 effect 内同步 setState（级联渲染）
    const t = window.setTimeout(() => setNow(new Date()), 0);
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(id);
    };
  }, []);

  const time = now ? formatTime(zone, now) : null;
  if (!time) {
    return (
      <span className="text-[12px] text-ink-tertiary">{partnerNickname}</span>
    );
  }
  const hour = Number(time.slice(0, 2));

  return (
    <span
      className="text-[12px] text-ink-tertiary"
      title={`${partnerNickname}的当地时间`}
    >
      {partnerNickname} · {time} {greeting(hour)}
    </span>
  );
}

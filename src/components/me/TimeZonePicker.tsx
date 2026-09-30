"use client";

import { useState, useTransition } from "react";
import { updateMyTimeZoneAction } from "@/server/space-actions";

const COMMON_ZONES = [
  { value: "Asia/Shanghai", label: "上海（默认）" },
  { value: "Asia/Tokyo", label: "东京" },
  { value: "Asia/Singapore", label: "新加坡" },
  { value: "Asia/Hong_Kong", label: "香港" },
  { value: "Asia/Taipei", label: "台北" },
  { value: "Europe/London", label: "伦敦" },
  { value: "Europe/Paris", label: "巴黎" },
  { value: "America/New_York", label: "纽约" },
  { value: "America/Los_Angeles", label: "洛杉矶" },
  { value: "America/Vancouver", label: "温哥华" },
  { value: "Australia/Sydney", label: "悉尼" },
  { value: "Pacific/Auckland", label: "奥克兰" },
];

/** P2-N4：我的时区设置（对方页面按此时区显示当地时间与问候） */
export function TimeZonePicker({ initial }: { initial: string | null }) {
  const [zone, setZone] = useState(initial ?? "Asia/Shanghai");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await updateMyTimeZoneAction({
        timeZone: zone === "Asia/Shanghai" ? null : zone,
      });
      if (res?.error) {
        setError(res.error);
        return;
      }
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
    });
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      <label className="block">
        <span className="text-[12px] text-ink-secondary">我的时区</span>
        <select
          value={zone}
          onChange={(e) => setZone(e.target.value)}
          className="mt-1.5 h-10 w-full max-w-[220px] rounded-[10px] border border-line bg-white/45 px-2 text-[14px] text-ink outline-none focus:border-brand"
        >
          {COMMON_ZONES.map((z) => (
            <option key={z.value} value={z.value}>
              {z.label}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-[10px] bg-brand px-4 py-2 text-[13px] font-medium text-[#F5F6F4] disabled:opacity-60"
        >
          保存
        </button>
        {saved ? <span className="text-[12px] text-brand">已保存</span> : null}
        {error ? (
          <span className="text-[12px] text-danger" role="alert">
            {error}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-[12px] text-ink-tertiary">
        对方在今日页会看到你的当地时间与问候。写日记的日子仍按上海时间计算。
      </p>
    </div>
  );
}

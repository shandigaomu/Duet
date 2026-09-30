"use client";

import { useEffect, useReducer, useState } from "react";
import {
  applyThemeClass,
  readThemePreference,
  resolveTheme,
  writeThemePreference,
  type ThemePreference,
} from "@/lib/theme";

function subscribeTheme(onChange: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener("duet-theme-change", onChange);
  mq.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("duet-theme-change", onChange);
    mq.removeEventListener("change", onChange);
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // 首帧前由 layout 内联 boot 脚本落主题类；这里订阅后续变化（偏好或系统）并重新同步
  const [, syncTheme] = useReducer((x: number) => x + 1, 0);

  useEffect(() => subscribeTheme(syncTheme), []);

  useEffect(() => {
    const pref = readThemePreference();
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyThemeClass(resolveTheme(pref, systemDark));
  });

  return <>{children}</>;
}

export function ThemePicker() {
  const [pref, setPref] = useState<ThemePreference>("system");

  useEffect(() => {
    // 延迟到渲染后读取，避免同步 setState 触发级联渲染（react-hooks/set-state-in-effect）
    const t = window.setTimeout(() => setPref(readThemePreference()), 0);
    return () => window.clearTimeout(t);
  }, []);

  function choose(next: ThemePreference) {
    setPref(next);
    writeThemePreference(next);
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyThemeClass(resolveTheme(next, systemDark));
    window.dispatchEvent(new Event("duet-theme-change"));
  }

  const options: { id: ThemePreference; label: string }[] = [
    { id: "light", label: "浅色" },
    { id: "dark", label: "深色" },
    { id: "system", label: "跟随系统" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => choose(o.id)}
          aria-pressed={pref === o.id}
          className={`rounded-[10px] px-3 py-1.5 text-[13px] ${
            pref === o.id
              ? "bg-brand text-white"
              : "bg-white/45 text-ink-secondary hover:bg-white/60"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

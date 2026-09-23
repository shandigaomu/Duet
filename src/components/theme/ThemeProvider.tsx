"use client";

import { useEffect, useState } from "react";
import {
  applyThemeClass,
  readThemePreference,
  resolveTheme,
  writeThemePreference,
  type ThemePreference,
} from "@/lib/theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    function sync() {
      const pref = readThemePreference();
      const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      applyThemeClass(resolveTheme(pref, systemDark));
    }
    sync();
    setReady(true);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", sync);
    window.addEventListener("duet-theme-change", sync);
    return () => {
      mq.removeEventListener("change", sync);
      window.removeEventListener("duet-theme-change", sync);
    };
  }, []);

  return (
    <div className={ready ? undefined : undefined} suppressHydrationWarning>
      {children}
    </div>
  );
}

export function ThemePicker() {
  const [pref, setPref] = useState<ThemePreference>("system");

  useEffect(() => {
    setPref(readThemePreference());
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

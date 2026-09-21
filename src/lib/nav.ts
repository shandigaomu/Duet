export const MAIN_NAV = [
  { href: "/today", label: "今日", match: (path: string) => path === "/today" },
  {
    href: "/journal",
    label: "记录",
    match: (path: string) => path.startsWith("/journal"),
  },
  { href: "/me", label: "我的", match: (path: string) => path.startsWith("/me") },
] as const;

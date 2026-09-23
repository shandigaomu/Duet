export const MAIN_NAV = [
  { href: "/today", label: "今日", match: (path: string) => path === "/today" },
  {
    href: "/journal",
    label: "记录",
    match: (path: string) => path.startsWith("/journal"),
  },
  {
    href: "/us",
    label: "我们",
    match: (path: string) => path.startsWith("/us"),
  },
  { href: "/me", label: "我的", match: (path: string) => path.startsWith("/me") },
] as const;

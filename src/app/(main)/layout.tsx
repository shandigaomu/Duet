import { MainShell } from "@/components/shell/MainShell";
import { requirePaired } from "@/lib/guards";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePaired();
  return <MainShell>{children}</MainShell>;
}

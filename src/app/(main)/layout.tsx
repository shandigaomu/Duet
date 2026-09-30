import { MainShell } from "@/components/shell/MainShell";
import { requirePaired } from "@/lib/guards";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { membership } = await requirePaired();
  return (
    <MainShell spaceName={membership.space.name ?? null}>
      {children}
    </MainShell>
  );
}

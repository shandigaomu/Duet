import { MainShell } from "@/components/shell/MainShell";
import { requirePaired } from "@/lib/guards";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { membership } = await requirePaired();
  const partner = membership.space.members.find(
    (m) => m.userId !== membership.userId,
  );
  return (
    <MainShell
      spaceName={membership.space.name ?? null}
      partnerNickname={partner?.nickname ?? null}
    >
      {children}
    </MainShell>
  );
}

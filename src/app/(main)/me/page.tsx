import { Workbench } from "@/components/shell/Workbench";
import { MeSettings } from "@/components/me/MeSettings";
import { requirePaired } from "@/lib/guards";

export const metadata = { title: "我的" };

export default async function MePage() {
  const { user, membership } = await requirePaired();
  const members = membership.space.members;
  const partner = members.find((m) => m.userId !== user.id);

  return (
    <Workbench
      eyebrow="Settings · Space"
      title="我的工作台"
      description="资料、空间信息与危险操作集中在此。"
      stats={[
        { label: "配对", value: members.length >= 2 ? "已配对" : "等待中" },
        { label: "主题", value: "可切换" },
        { label: "成员", value: `${members.length}/2` },
        { label: "版本", value: "V2" },
      ]}
    >
      <MeSettings
        nickname={membership.nickname}
        email={user.email}
        avatarUrl={membership.avatarUrl ?? user.image ?? null}
        inviteCode={membership.space.inviteCode}
        memberCount={members.length}
        partnerNickname={partner?.nickname ?? null}
      />
    </Workbench>
  );
}

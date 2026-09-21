import { CreateSpaceForm } from "@/components/onboarding/CreateSpaceForm";
import { requireOnboarding } from "@/lib/guards";

export const metadata = { title: "创建空间" };

export default async function CreateSpacePage() {
  const { pairing } = await requireOnboarding();
  const inviteCode =
    pairing.status === "waiting" ? pairing.membership?.space.inviteCode : null;
  const nickname =
    pairing.status === "waiting" ? pairing.membership?.nickname : null;

  return (
    <CreateSpaceForm
      initialInviteCode={inviteCode}
      initialNickname={nickname}
    />
  );
}

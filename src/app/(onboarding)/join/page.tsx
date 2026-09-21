import { JoinSpaceForm } from "@/components/onboarding/JoinSpaceForm";
import { requireOnboarding } from "@/lib/guards";

export const metadata = { title: "加入空间" };

export default async function JoinSpacePage() {
  await requireOnboarding();
  return <JoinSpaceForm />;
}

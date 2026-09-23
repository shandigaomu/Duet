import { EntryForm } from "@/components/journal/EntryForm";
import { requirePaired } from "@/lib/guards";

export const metadata = { title: "写一条" };

export default async function NewJournalPage() {
  const { user, membership } = await requirePaired();
  return (
    <EntryForm
      mode="create"
      draftOwner={{ userId: user.id, spaceId: membership.spaceId }}
    />
  );
}

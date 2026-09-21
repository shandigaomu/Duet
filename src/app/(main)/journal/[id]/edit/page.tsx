import { notFound, redirect } from "next/navigation";
import { EntryForm } from "@/components/journal/EntryForm";
import { requirePaired } from "@/lib/guards";
import { getEntryById } from "@/server/entry-actions";

export const metadata = { title: "编辑日记" };

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditJournalPage({ params }: Props) {
  const { id } = await params;
  const { user } = await requirePaired();
  const entry = await getEntryById(id);
  if (!entry) notFound();
  if (entry.authorId !== user.id) redirect(`/journal/${id}`);
  return <EntryForm mode="edit" initial={entry} />;
}

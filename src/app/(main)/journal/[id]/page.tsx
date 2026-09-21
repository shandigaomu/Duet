import { notFound } from "next/navigation";
import { EntryDetail } from "@/components/journal/EntryDetail";
import { getEntryById } from "@/server/entry-actions";

export const metadata = { title: "日记详情" };

type Props = {
  params: Promise<{ id: string }>;
};

export default async function JournalDetailPage({ params }: Props) {
  const { id } = await params;
  const entry = await getEntryById(id);
  if (!entry) notFound();
  return <EntryDetail entry={entry} />;
}

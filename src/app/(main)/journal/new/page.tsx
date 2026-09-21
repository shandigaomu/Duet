import { EntryForm } from "@/components/journal/EntryForm";

export const metadata = { title: "写一条" };

export default function NewJournalPage() {
  return <EntryForm mode="create" />;
}

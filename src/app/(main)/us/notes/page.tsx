import { NotesView } from "@/components/us/NotesView";
import { loadNotes } from "@/server/note-actions";

export const metadata = { title: "悄悄话" };

export default async function NotesPage() {
  const data = await loadNotes();
  return <NotesView notes={data.notes} pinned={data.pinned} />;
}

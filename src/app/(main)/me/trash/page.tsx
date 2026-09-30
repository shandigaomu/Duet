import { TrashView } from "@/components/me/TrashView";
import { loadTrash } from "@/server/trash-actions";

export const metadata = { title: "回收站" };

export default async function TrashPage() {
  const data = await loadTrash();
  return <TrashView items={data.items} />;
}

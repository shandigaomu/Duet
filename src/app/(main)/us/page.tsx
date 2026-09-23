import { UsOverview } from "@/components/us/UsOverview";
import { loadUsOverview } from "@/server/list-actions";

export const metadata = { title: "我们" };

export default async function UsPage() {
  const data = await loadUsOverview();
  return (
    <UsOverview
      openListCount={data.openListCount}
      photoCount={data.photoCount}
      noteCount={data.noteCount}
    />
  );
}

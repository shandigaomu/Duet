import { ListsView } from "@/components/us/ListsView";
import type { ListCategory } from "@/lib/list";
import { loadListItems } from "@/server/list-actions";

export const metadata = { title: "清单" };

type Props = {
  searchParams: Promise<{ category?: string }>;
};

function parseCategory(raw?: string): ListCategory | "all" {
  if (raw === "go" || raw === "eat" || raw === "do") return raw;
  return "all";
}

export default async function ListsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const category = parseCategory(sp.category);
  const data = await loadListItems({ category });
  return (
    <ListsView
      key={category}
      items={data.items}
      initialCategory={category}
      partnerNickname={data.partnerNickname}
    />
  );
}

import { EntryForm } from "@/components/journal/EntryForm";
import { requirePaired } from "@/lib/guards";

export const metadata = { title: "写一条" };

type Props = {
  searchParams: Promise<{ prefill?: string }>;
};

/** P1-3：?prefill=URL(JSON{title,body}) 清单跳转预填 */
function parsePrefill(raw?: string): { title: string; body: string } | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(decodeURIComponent(raw)) as {
      title?: unknown;
      body?: unknown;
    };
    if (typeof obj.body !== "string" || !obj.body.trim()) return null;
    return {
      title: typeof obj.title === "string" ? obj.title.slice(0, 120) : "",
      body: obj.body.slice(0, 20000),
    };
  } catch {
    return null;
  }
}

export default async function NewJournalPage({ searchParams }: Props) {
  const { user, membership } = await requirePaired();
  const sp = await searchParams;
  return (
    <EntryForm
      mode="create"
      draftOwner={{ userId: user.id, spaceId: membership.spaceId }}
      prefill={parsePrefill(sp.prefill)}
    />
  );
}

import { ReactionWallView } from "@/components/us/ReactionWallView";
import { partnerOf } from "@/lib/entry-shared";
import { requirePaired } from "@/lib/guards";
import { loadReactionWall } from "@/server/reaction-wall";

export const metadata = { title: "回应墙" };

export default async function ReactionsPage() {
  const [data, ctx] = await Promise.all([loadReactionWall(), requirePaired()]);
  const partner = partnerOf(ctx);

  return <ReactionWallView data={data} partnerNickname={partner?.nickname ?? "你"} />;
}

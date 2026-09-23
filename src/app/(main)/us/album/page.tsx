import { AlbumView } from "@/components/us/AlbumView";
import { loadAlbum } from "@/server/album-actions";

export const metadata = { title: "相册" };

type Props = {
  searchParams: Promise<{ source?: string }>;
};

function parseSource(raw?: string): "all" | "mine" | "yours" {
  if (raw === "mine" || raw === "yours") return raw;
  return "all";
}

export default async function AlbumPage({ searchParams }: Props) {
  const sp = await searchParams;
  const source = parseSource(sp.source);
  const data = await loadAlbum({ source });
  return (
    <AlbumView
      key={source}
      photos={data.photos}
      partnerNickname={data.partnerNickname}
      initialSource={source}
    />
  );
}

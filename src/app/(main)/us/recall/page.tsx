import { RecallView } from "@/components/us/RecallView";
import { loadTodayRecall } from "@/server/recall-actions";

export const metadata = { title: "一起看" };

export default async function RecallPage() {
  const recall = await loadTodayRecall();
  return <RecallView recall={recall} />;
}

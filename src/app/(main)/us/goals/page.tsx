import { GoalsView } from "@/components/us/GoalsView";
import { loadGoals } from "@/server/goal-actions";

export const metadata = { title: "目标" };

export default async function GoalsPage() {
  const data = await loadGoals();
  return (
    <GoalsView
      today={data.today}
      goals={data.goals}
      partnerNickname={data.partnerNickname}
    />
  );
}

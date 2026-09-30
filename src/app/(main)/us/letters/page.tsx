import { LettersView } from "@/components/us/LettersView";
import { loadLetters } from "@/server/letter-actions";

export const metadata = { title: "时光信" };

export default async function LettersPage() {
  const data = await loadLetters();
  return (
    <LettersView
      today={data.today}
      letters={data.letters}
      partnerNickname={data.partnerNickname}
    />
  );
}

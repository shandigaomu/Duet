import { redirect } from "next/navigation";
import { getPairingState, getSession } from "@/lib/session";

export default async function HomePage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const pairing = await getPairingState(session.user.id);
  if (pairing.status === "paired") redirect("/today");
  redirect("/create");
}

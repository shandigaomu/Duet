import { LockScreen } from "@/components/lock/LockScreen";
import { loadAppLockState } from "@/server/lock-actions";

export const metadata = { title: "已上锁" };

export default async function LockPage() {
  await loadAppLockState();
  return <LockScreen />;
}

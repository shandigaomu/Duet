import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = { title: "登录" };

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="text-center text-ink-secondary">加载中…</p>}>
      <LoginForm />
    </Suspense>
  );
}

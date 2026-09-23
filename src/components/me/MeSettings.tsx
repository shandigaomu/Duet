"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { EditProfileSheet } from "@/components/me/EditProfileSheet";
import { ThemePicker } from "@/components/theme/ThemeProvider";
import { Button } from "@/components/ui/Button";
import { authClient } from "@/lib/auth-client";
import { unpairSpaceAction } from "@/server/space-actions";

type MeSettingsProps = {
  nickname: string;
  email: string;
  avatarUrl: string | null;
  inviteCode: string;
  memberCount: number;
  partnerNickname: string | null;
};

export function MeSettings({
  nickname: initialNickname,
  email,
  avatarUrl: initialAvatar,
  inviteCode,
  memberCount,
  partnerNickname,
}: MeSettingsProps) {
  const router = useRouter();
  const [nickname, setNickname] = useState(initialNickname);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatar);
  const [editOpen, setEditOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [confirmUnpair, setConfirmUnpair] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function logout() {
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function unpair() {
    if (!confirmUnpair) {
      setConfirmUnpair(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await unpairSpaceAction();
      if (res?.error) setError(res.error);
    });
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="glass-panel flex items-center gap-4 p-5">
          <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-brand-soft text-[18px] font-semibold text-brand">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              nickname.slice(0, 1)
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[17px] font-semibold text-ink">
              {nickname}
            </p>
            <p className="mt-0.5 truncate text-[13px] text-ink-secondary">
              {email}
            </p>
          </div>
        </section>

        <section className="glass-panel p-5">
          <h2 className="text-[12px] font-medium tracking-[0.04em] text-ink-tertiary">
            空间
          </h2>
          <dl className="mt-4 space-y-3 text-[14px]">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-ink-secondary">邀请码</dt>
              <dd className="flex items-center gap-2">
                <span className="font-mono tracking-[0.12em] text-ink">
                  {inviteCode}
                </span>
                <button
                  type="button"
                  onClick={copyInvite}
                  className="text-[12px] font-medium text-brand"
                >
                  {copied ? "已复制" : "复制"}
                </button>
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-secondary">配对状态</dt>
              <dd className="text-ink">
                {memberCount >= 2
                  ? `已配对${partnerNickname ? ` · ${partnerNickname}` : ""}`
                  : "等待对方加入"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-secondary">成员</dt>
              <dd className="text-ink">{memberCount}/2</dd>
            </div>
          </dl>
        </section>

        <section className="glass-panel p-5">
          <h2 className="text-[12px] font-medium tracking-[0.04em] text-ink-tertiary">
            外观
          </h2>
          <p className="mt-1 text-[13px] text-ink-secondary">主题</p>
          <div className="mt-3">
            <ThemePicker />
          </div>
        </section>

        <section className="glass-panel p-5">
          <h2 className="text-[12px] font-medium tracking-[0.04em] text-ink-tertiary">
            账号
          </h2>
          <ul className="mt-3 space-y-1">
            <li>
              <button
                type="button"
                className="w-full py-3 text-left text-[15px] text-ink hover:text-brand"
                onClick={() => setEditOpen(true)}
              >
                编辑资料
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={logout}
                className="w-full py-3 text-left text-[15px] text-ink hover:text-brand"
              >
                登出
              </button>
            </li>
          </ul>
        </section>

        <section className="glass-panel p-5">
          <h2 className="text-[12px] font-medium tracking-[0.04em] text-ink-tertiary">
            危险操作
          </h2>
          <Button
            variant="danger"
            className="mt-4"
            onClick={unpair}
            disabled={pending}
          >
            {confirmUnpair ? "再次确认：解除配对" : "解除配对"}
          </Button>
          {confirmUnpair ? (
            <button
              type="button"
              className="mt-2 block text-[12px] text-ink-tertiary underline-offset-2 hover:underline"
              onClick={() => setConfirmUnpair(false)}
            >
              取消
            </button>
          ) : (
            <p className="mt-2 text-[12px] text-ink-tertiary">
              解绑后双方回到未配对状态
            </p>
          )}
          {error ? (
            <p className="mt-2 text-[13px] text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </section>
      </div>

      <EditProfileSheet
        open={editOpen}
        nickname={nickname}
        avatarUrl={avatarUrl}
        onClose={() => setEditOpen(false)}
        onSaved={(next) => {
          setNickname(next.nickname);
          setAvatarUrl(next.avatarUrl);
          router.refresh();
        }}
      />
    </>
  );
}

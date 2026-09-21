"use client";

import { useId, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { AvatarCropDialog } from "@/components/me/AvatarCropDialog";
import { Button } from "@/components/ui/Button";
import { uploadImageFile } from "@/lib/upload-client";
import { updateProfileAction } from "@/server/profile-actions";

type EditProfileSheetProps = {
  open: boolean;
  nickname: string;
  avatarUrl: string | null;
  onClose: () => void;
  onSaved: (next: { nickname: string; avatarUrl: string | null }) => void;
};

export function EditProfileSheet({
  open,
  nickname: initialNickname,
  avatarUrl: initialAvatar,
  onClose,
  onSaved,
}: EditProfileSheetProps) {
  if (!open) return null;

  return (
    <Body
      key={`${initialNickname}-${initialAvatar ?? "none"}`}
      initialNickname={initialNickname}
      initialAvatar={initialAvatar}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function Body({
  initialNickname,
  initialAvatar,
  onClose,
  onSaved,
}: {
  initialNickname: string;
  initialAvatar: string | null;
  onClose: () => void;
  onSaved: (next: { nickname: string; avatarUrl: string | null }) => void;
}) {
  const titleId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [nickname, setNickname] = useState(initialNickname);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatar);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onPick(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("请选择图片");
      return;
    }
    setError(null);
    setCropFile(file);
  }

  async function onCropped(blob: Blob) {
    setCropFile(null);
    setError(null);
    try {
      const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      const { url } = await uploadImageFile(file, "avatar");
      setAvatarUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "头像上传失败");
    }
  }

  function save() {
    const name = nickname.trim();
    if (!name) {
      setError("请填写昵称");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await updateProfileAction({
        nickname: name,
        avatarUrl,
      });
      if (!res.ok) {
        setError(res.error || "保存失败");
        return;
      }
      onSaved({
        nickname: res.nickname ?? name,
        avatarUrl: res.avatarUrl ?? null,
      });
      onClose();
    });
  }

  const sheet = (
    <>
      <div className="fixed inset-0 z-[80] flex items-end justify-center md:items-center md:p-6">
        <button
          type="button"
          className="sheet-overlay absolute inset-0 bg-[rgba(18,21,26,0.18)] backdrop-blur-md"
          aria-label="关闭"
          onClick={onClose}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="sheet-panel glass-sheet relative z-10 flex max-h-[min(92dvh,720px)] w-full max-w-[480px] flex-col rounded-t-[28px] md:rounded-[28px]"
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/35 px-5 py-4 md:px-6">
            <div>
              <p className="text-[11px] font-medium tracking-[0.14em] text-[var(--accent)] uppercase">
                Profile
              </p>
              <h2
                id={titleId}
                className="mt-1 font-display text-[26px] leading-tight text-ink"
              >
                编辑资料
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex size-9 items-center justify-center rounded-full bg-white/45 text-ink-secondary"
              aria-label="关闭"
            >
              <X className="size-5" strokeWidth={1.75} />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 md:px-6">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative size-20 overflow-hidden rounded-[14px] bg-brand-soft"
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="flex size-full items-center justify-center text-[22px] font-semibold text-brand">
                    {nickname.slice(0, 1) || "?"}
                  </span>
                )}
              </button>
              <div>
                <button
                  type="button"
                  className="text-[14px] font-medium text-brand"
                  onClick={() => fileRef.current?.click()}
                >
                  更换头像
                </button>
                {avatarUrl ? (
                  <button
                    type="button"
                    className="mt-1 block text-[13px] text-ink-tertiary"
                    onClick={() => setAvatarUrl(null)}
                  >
                    移除头像
                  </button>
                ) : (
                  <p className="mt-1 text-[13px] text-ink-tertiary">
                    将裁剪为方图
                  </p>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    onPick(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>

            <label className="block">
              <span className="text-[12px] font-medium tracking-[0.04em] text-ink-secondary">
                昵称
              </span>
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value.slice(0, 40))}
                maxLength={40}
                className="mt-2 h-11 w-full rounded-[var(--radius-sm)] border border-line-strong bg-white/55 px-3 text-[15px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
              />
            </label>

            {error ? (
              <p className="text-[13px] text-danger" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-white/35 bg-white/25 px-5 pt-4 backdrop-blur-xl md:px-6 pb-[max(1rem,calc(env(safe-area-inset-bottom)+0.75rem))]">
            <Button
              className="h-12 w-full"
              onClick={save}
              disabled={pending}
            >
              {pending ? "保存中…" : "保存"}
            </Button>
          </div>
        </div>
      </div>

      {cropFile ? (
        <AvatarCropDialog
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onDone={onCropped}
        />
      ) : null}
    </>
  );

  if (typeof document === "undefined") return null;
  return createPortal(sheet, document.body);
}

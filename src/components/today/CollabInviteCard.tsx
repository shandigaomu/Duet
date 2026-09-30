"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PenLine } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { uploadImageFile } from "@/lib/upload-client";
import {
  confirmCollabAction,
  revokeCollabAction,
  submitCollabSectionAction,
} from "@/server/collab-actions";

type CollabInvite = {
  entryId: string;
  day: string;
  title: string | null;
  authorNickname: string;
  mySectionSubmitted: boolean;
  iConfirmed: boolean;
  partnerConfirmed: boolean;
};

type CollabInviteCardProps = {
  invite: CollabInvite | null;
  /** 我是邀请人时展示等待/撤回 */
  myPendingInvite: { entryId: string; day: string; title: string | null } | null;
};

/** P2-N8：今日页合写卡（双方各一段，互不可改） */
export function CollabInviteCard({ invite, myPendingInvite }: CollabInviteCardProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [body, setBody] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!invite && !myPendingInvite) return null;

  function pickImage(file: File) {
    setUploading(true);
    void uploadImageFile(file, "entry")
      .then((res) => setImageUrls((prev) => [...prev, res.url].slice(0, 9)))
      .catch((e: Error) => setError(e.message || "图片上传失败"))
      .finally(() => setUploading(false));
  }

  function submitSection() {
    if (!invite) return;
    setError(null);
    startTransition(async () => {
      const res = await submitCollabSectionAction({
        entryId: invite.entryId,
        body,
        imageUrls,
      });
      if (!res.ok) {
        setError(res.error || "提交失败");
        return;
      }
      router.refresh();
    });
  }

  function confirm() {
    if (!invite) return;
    setError(null);
    startTransition(async () => {
      const res = await confirmCollabAction({ entryId: invite.entryId });
      if (!res.ok) {
        setError(res.error || "操作失败");
        return;
      }
      router.refresh();
    });
  }

  function revoke() {
    if (!myPendingInvite) return;
    startTransition(async () => {
      const res = await revokeCollabAction({
        entryId: myPendingInvite.entryId,
      });
      if (res.ok) router.refresh();
    });
  }

  if (myPendingInvite && !invite) {
    return (
      <div className="mb-4 glass-panel flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-[13px] text-ink-secondary">
          ✍️ 你发起的 {myPendingInvite.day} 合写日记
          {myPendingInvite.title ? `《${myPendingInvite.title}》` : ""}，
          等待 TA 写 TA 的段落（7 天内有效）
        </p>
        <Button
          variant="ghost"
          className="h-8 px-3 text-[12px]"
          onClick={revoke}
          disabled={pending}
        >
          撤回邀请
        </Button>
      </div>
    );
  }

  if (!invite) return null;

  return (
    <div className="mb-4 glass-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium tracking-[0.08em] text-[var(--accent)] uppercase">
            Collab
          </p>
          <p className="mt-1 text-[14px] text-ink">
            {invite.authorNickname} 想和你合写 {invite.day} 的日记
            {invite.title ? `《${invite.title}》` : ""}
          </p>
          {invite.partnerConfirmed ? (
            <p className="mt-0.5 text-[12px] text-brand">TA 已确认完成</p>
          ) : null}
        </div>
        {!expanded && !invite.iConfirmed ? (
          <Button
            className="h-9 px-4 text-[13px]"
            onClick={() => setExpanded(true)}
          >
            <PenLine className="size-3.5" strokeWidth={1.75} />
            写我的段落
          </Button>
        ) : null}
      </div>

      {invite.iConfirmed ? (
        <p className="mt-3 text-[13px] text-ink-secondary">
          你已确认完成 ✓
          {invite.partnerConfirmed
            ? " · 双方都确认后日记已发布到时间线"
            : " · 等 TA 确认后发布"}
        </p>
      ) : null}

      {expanded && !invite.iConfirmed ? (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 20_000))}
            rows={5}
            placeholder={`写你眼中的一天……（互不可改对方文字）`}
            className="w-full resize-none rounded-[12px] border border-line bg-white/45 px-3 py-2.5 text-[14px] outline-none focus:border-brand"
          />
          {imageUrls.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {imageUrls.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt=""
                  className="size-16 rounded-[10px] object-cover"
                />
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer rounded-[10px] border border-dashed border-line px-3 py-1.5 text-[12px] text-ink-tertiary hover:border-brand hover:text-brand">
              {uploading ? "上传中…" : "+ 图片"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) pickImage(f);
                  e.target.value = "";
                }}
              />
            </label>
            <div className="flex-1" />
            <Button
              variant="ghost"
              className="h-9 px-3 text-[13px]"
              onClick={() => setExpanded(false)}
            >
              收起
            </Button>
            <Button
              className="h-9 px-4 text-[13px]"
              onClick={submitSection}
              disabled={pending || !body.trim() || uploading}
            >
              {pending ? "保存中…" : "提交段落"}
            </Button>
            <Button
              variant="ghost"
              className="h-9 px-3 text-[13px]"
              onClick={confirm}
              disabled={pending}
            >
              确认完成
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 text-[13px] text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

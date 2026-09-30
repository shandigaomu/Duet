"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MailOpen, Lock, Sparkles } from "lucide-react";
import { LettersViewTabs } from "@/components/us/LettersViewTabs";
import { LetterSheet } from "@/components/us/LetterSheet";
import { Workbench, WorkbenchToolbar } from "@/components/shell/Workbench";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { LetterDTO } from "@/lib/letter";

type LettersViewProps = {
  today: string;
  letters: LetterDTO[];
  partnerNickname: string;
};

/** P2-N3：时光信列表（三态） */
export function LettersView({
  today,
  letters,
  partnerNickname,
}: LettersViewProps) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<LetterDTO | null>(null);

  const unlocking = letters.filter((l) => l.state === "unlocking");
  const sealed = letters.filter(
    (l) => l.state === "sealed" || l.state === "unlocking",
  );
  const opened = letters.filter((l) => l.state === "opened");

  return (
    <>
      <Workbench
        eyebrow="Us · Time letters"
        title="时光信"
        description={`写给未来的信，到日子才会开启。今天是 ${today}。`}
        action={
          <Button
            className="h-10 px-4"
            onClick={() => {
              setEditing(null);
              setSheetOpen(true);
            }}
          >
            写一封信
          </Button>
        }
        toolbar={
          <div>
            <LettersViewTabs />
            <WorkbenchToolbar>
              <span className="px-2 text-[12px] text-ink-tertiary">
                {unlocking.length > 0
                  ? `✨ 今天有 ${unlocking.length} 封信开启`
                  : "最近没有信开启"}
              </span>
            </WorkbenchToolbar>
          </div>
        }
      >
        <div className="space-y-8">
          {letters.length === 0 ? (
            <div className="glass-panel flex flex-col items-center gap-3 p-10 text-center">
              <Sparkles className="size-6 text-brand" strokeWidth={1.5} />
              <p className="font-display text-[18px] text-ink-secondary">
                还没有埋下任何一封信
              </p>
              <p className="max-w-[320px] text-[13px] text-ink-tertiary">
                纪念日前、生日前，写一封给未来的信——到日子那天，它才会被打开。
              </p>
            </div>
          ) : null}

          {sealed.length > 0 ? (
            <section>
              <h2 className="mb-3 font-display text-[20px] text-ink-secondary">
                未开启
              </h2>
              <ul className="space-y-3">
                {sealed.map((l) => (
                  <LetterCard
                    key={l.id}
                    letter={l}
                    partnerNickname={partnerNickname}
                    onEdit={
                      l.isMine && l.state === "sealed"
                        ? () => {
                            setEditing(l);
                            setSheetOpen(true);
                          }
                        : undefined
                    }
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {opened.length > 0 ? (
            <section>
              <h2 className="mb-3 font-display text-[20px] text-ink-secondary">
                已开启
              </h2>
              <ul className="space-y-3">
                {opened.map((l) => (
                  <LetterCard key={l.id} letter={l} partnerNickname={partnerNickname} />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </Workbench>

      <LetterSheet
        open={sheetOpen}
        mode={editing ? "edit" : "create"}
        today={today}
        initial={
          editing
            ? {
                id: editing.id,
                title: editing.title,
                body: editing.body,
                imageUrl: editing.imageUrl,
                unlockDay: editing.unlockDay,
              }
            : null
        }
        onClose={() => {
          setSheetOpen(false);
          setEditing(null);
        }}
        onSaved={() => router.refresh()}
      />
    </>
  );
}

function LetterCard({
  letter,
  partnerNickname,
  onEdit,
}: {
  letter: LetterDTO;
  partnerNickname: string;
  onEdit?: () => void;
}) {
  const authorLabel = letter.isMine ? "我" : partnerNickname;
  const sealedToMe = letter.body === null;

  return (
    <li
      className={cn(
        "glass-panel p-5",
        letter.state === "unlocking" &&
          "border-2 border-[var(--signal)] shadow-[0_0_0_1px_var(--signal)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[16px] font-medium text-ink">
            {letter.title || "一封没有标题的信"}
          </p>
          <p className="mt-1 text-[12px] text-ink-tertiary">
            {authorLabel} 写于 {letter.unlockDay.slice(0, 10)} 之前
            {letter.state === "unlocking" ? " · 今天开启 ✨" : null}
          </p>
        </div>
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full",
            letter.state === "unlocking"
              ? "bg-[var(--signal)]/15 text-[var(--signal)]"
              : "bg-brand-soft text-brand",
          )}
        >
          {letter.state === "sealed" ? (
            <Lock className="size-4" strokeWidth={1.75} />
          ) : (
            <MailOpen className="size-4" strokeWidth={1.75} />
          )}
        </span>
      </div>

      {sealedToMe ? (
        <p className="mt-3 rounded-[10px] bg-white/35 px-3 py-2 text-[13px] text-ink-tertiary">
          🔒 {letter.unlockDay} 开启，届时可见
        </p>
      ) : (
        <>
          {letter.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={letter.imageUrl}
              alt=""
              className="mt-3 max-h-52 w-full rounded-[12px] object-cover"
            />
          ) : null}
          <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
            {letter.body}
          </p>
        </>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[12px] text-ink-tertiary">
          {letter.isMine
            ? letter.state === "sealed"
              ? "你的信 · 对方还看不到内容"
              : "你的信"
            : letter.state === "sealed"
              ? `${authorLabel} 的信`
              : `${authorLabel} 的信`}
        </span>
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="text-[12px] font-medium text-brand"
          >
            编辑
          </button>
        ) : null}
      </div>
    </li>
  );
}

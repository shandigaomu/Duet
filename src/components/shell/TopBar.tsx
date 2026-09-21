import Link from "next/link";

type TopBarProps = {
  title?: string;
  trailing?: React.ReactNode;
  showBrandOnMobile?: boolean;
};

export function TopBar({
  title,
  trailing,
  showBrandOnMobile = true,
}: TopBarProps) {
  return (
    <header className="glass-bar sticky top-0 z-20 mx-0 flex h-[var(--topbar-h)] items-center justify-between px-5 md:mx-0 md:rounded-none md:px-8">
      <div className="flex min-w-0 items-baseline gap-3">
        {showBrandOnMobile ? (
          <Link
            href="/today"
            className="font-display text-[22px] tracking-[0.03em] text-brand transition-opacity hover:opacity-80 md:hidden"
          >
            Duet
          </Link>
        ) : null}
        {title ? (
          <h1 className="truncate text-[17px] font-semibold text-ink md:text-[18px]">
            {title}
          </h1>
        ) : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </header>
  );
}

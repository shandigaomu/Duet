import { cn } from "@/lib/cn";

type WorkbenchStat = {
  label: string;
  value: string | number;
};

type WorkbenchProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  stats?: WorkbenchStat[];
  toolbar?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function Workbench({
  eyebrow = "Duet Workbench",
  title,
  description,
  action,
  stats,
  toolbar,
  children,
  className,
}: WorkbenchProps) {
  return (
    <div className={cn("relative z-[1] flex min-h-0 flex-1 flex-col", className)}>
      <header className="shrink-0 border-b border-[rgba(18,21,26,0.06)] px-5 py-5 md:px-8 md:py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium tracking-[0.14em] text-[var(--accent)] uppercase">
              {eyebrow}
            </p>
            <h1 className="mt-2 font-display text-[28px] leading-tight tracking-[0.01em] text-ink md:text-[34px]">
              {title}
            </h1>
            {description ? (
              <p className="mt-2 max-w-xl text-[13px] text-ink-secondary md:text-[14px]">
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>

        {stats && stats.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-y-2 rounded-[var(--radius-md)] bg-white/30 px-1 py-2 md:px-2">
            {stats.map((s) => (
              <div
                key={s.label}
                className="glass-stat flex min-w-[7rem] flex-1 flex-col px-3 py-1.5 md:min-w-[8.5rem]"
              >
                <span className="text-[11px] tracking-[0.04em] text-ink-tertiary">
                  {s.label}
                </span>
                <span className="mt-0.5 text-[18px] font-semibold text-ink">
                  {s.value}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {toolbar ? <div className="mt-4">{toolbar}</div> : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-8 md:py-6">
        {children}
      </div>
    </div>
  );
}

type WorkbenchToolbarProps = {
  children: React.ReactNode;
  trailing?: React.ReactNode;
};

export function WorkbenchToolbar({ children, trailing }: WorkbenchToolbarProps) {
  return (
    <div className="glass-toolbar flex flex-wrap items-center justify-between gap-3 px-2 py-2 md:px-3">
      <div className="flex flex-wrap items-center gap-1">{children}</div>
      {trailing ? <div className="flex items-center gap-2">{trailing}</div> : null}
    </div>
  );
}

type WorkbenchTabProps = {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
};

export function WorkbenchTab({
  active,
  children,
  onClick,
  disabled,
}: WorkbenchTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-[10px] px-3 py-1.5 text-[13px] font-medium transition-colors",
        active
          ? "bg-white/70 text-brand shadow-[0_1px_0_rgba(255,255,255,0.6)_inset]"
          : "text-ink-secondary hover:bg-white/35 hover:text-ink",
        disabled && "opacity-60",
      )}
    >
      {children}
    </button>
  );
}

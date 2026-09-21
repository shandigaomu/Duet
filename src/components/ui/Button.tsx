import Link from "next/link";
import { cn } from "@/lib/cn";

type ButtonProps = {
  children: React.ReactNode;
  href?: string;
  type?: "button" | "submit";
  variant?: "primary" | "ghost" | "danger";
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
};

export function Button({
  children,
  href,
  type = "button",
  variant = "primary",
  className,
  disabled,
  onClick,
}: ButtonProps) {
  const styles = cn(
    "pressable inline-flex h-11 items-center justify-center rounded-[var(--radius-sm)] px-5 text-[14px] font-semibold disabled:pointer-events-none disabled:opacity-50",
    variant === "primary" &&
      "bg-brand text-[#F5F6F4] shadow-[0_8px_24px_rgba(31,74,69,0.28)] hover:bg-brand/92",
    variant === "ghost" &&
      "border border-white/50 bg-white/35 text-ink shadow-[var(--shadow-glass)] backdrop-blur-xl hover:bg-white/50",
    variant === "danger" && "bg-danger text-[#F5F6F4] hover:bg-danger/90",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={styles}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={styles} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

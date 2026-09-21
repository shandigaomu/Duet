export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-5 py-12">
      <div className="glass-panel relative w-full max-w-[420px] p-7 md:p-9">
        {children}
      </div>
    </div>
  );
}

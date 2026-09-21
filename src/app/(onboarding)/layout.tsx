export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="glass-panel w-full max-w-[420px] p-6 md:p-8">{children}</div>
    </div>
  );
}

import { BottomNav } from "@/components/shell/BottomNav";
import { SideNav } from "@/components/shell/SideNav";

type MainShellProps = {
  children: React.ReactNode;
};

/**
 * 文章示例式工作台：环境底 + 左侧玻璃导航 + 中央 inset 舞台。
 * 移动端收起侧栏，保留底栏。
 */
export function MainShell({ children }: MainShellProps) {
  return (
    <div className="min-h-dvh p-3 md:p-4">
      <SideNav />
      <div className="flex min-h-[calc(100dvh-1.5rem)] flex-col md:min-h-[calc(100dvh-2rem)] md:pl-[calc(var(--nav-width)+12px)]">
        <div className="glass-stage relative z-0 flex min-h-[calc(100dvh-1.5rem)] flex-1 flex-col pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+12px)] md:min-h-[calc(100dvh-2rem)] md:pb-0">
          {children}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}

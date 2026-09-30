import { BottomNav } from "@/components/shell/BottomNav";
import { SideNav } from "@/components/shell/SideNav";
import { QuickNoteButton } from "@/components/us/QuickNoteSheet";

type MainShellProps = {
  children: React.ReactNode;
  /** P0-2：空间名（桌面侧栏显示） */
  spaceName?: string | null;
  /** P2-N7：对方昵称（悄悄话入口） */
  partnerNickname?: string | null;
};

/**
 * 文章示例式工作台：环境底 + 左侧玻璃导航 + 中央 inset 舞台。
 * 移动端收起侧栏，保留底栏。
 */
export function MainShell({ children, spaceName, partnerNickname }: MainShellProps) {
  return (
    <div className="min-h-dvh p-3 md:p-4">
      <SideNav spaceName={spaceName} partnerNickname={partnerNickname} />
      <div className="flex min-h-[calc(100dvh-1.5rem)] flex-col md:min-h-[calc(100dvh-2rem)] md:pl-[calc(var(--nav-width)+12px)]">
        <div className="glass-stage relative z-0 flex min-h-[calc(100dvh-1.5rem)] flex-1 flex-col pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+12px)] md:min-h-[calc(100dvh-2rem)] md:pb-0">
          {children}
        </div>
      </div>
      <BottomNav />
      {/* P2-N7：移动端悄悄话悬浮心形（桌面走 SideNav） */}
      <div className="md:hidden">
        <QuickNoteButton partnerNickname={partnerNickname ?? "TA"} />
      </div>
    </div>
  );
}

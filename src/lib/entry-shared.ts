/**
 * Duet 日记可见性与空间成员的纯工具函数。
 * 不带 prisma / 不依赖 io——供 "use server" 模块安全复用导出。
 */

type PartnerCtx = {
  user: { id: string };
  membership: {
    space: { members: Array<{ userId: string; nickname: string }> };
  };
};

export function partnerOf(ctx: PartnerCtx) {
  return ctx.membership.space.members.find((m) => m.userId !== ctx.user.id);
}

/**
 * 可见性 + 未删除 + 未在合写 pending（P2-N5/N8：单一封装点，所有查询都走这里防漏）。
 * pending 合写仅出现在今日页邀请卡，不进时间线/相册/统计。
 * P3-T6：writing（正在写占位）档任何人都不进常规可见性——占位条单独纯投影查询。
 */
export function entryVisibleWhere(userId: string) {
  return {
    AND: [
      // writing 档：作者自己也不从常规列表出（自己不需要占位条），发布时原子替换
      { visibility: { not: "writing" } },
      { OR: [{ visibility: "shared" }, { authorId: userId }] },
    ],
    deletedAt: null,
    collabStatus: { not: "pending" },
  };
}

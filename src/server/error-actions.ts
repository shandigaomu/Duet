"use server";

import { prisma } from "@/lib/db";
import { requirePaired } from "@/lib/guards";

export type ErrorLogDTO = {
  id: string;
  route: string;
  kind: string;
  message: string;
  stack: string | null;
  createdAt: string;
};

/** P0-3：最近错误（仅自己产生/上报的），供设置页开发者分组 */
export async function loadRecentErrors(): Promise<{
  errors: ErrorLogDTO[];
  total: number;
}> {
  const { user } = await requirePaired();
  const [rows, total] = await Promise.all([
    prisma.errorLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.errorLog.count({ where: { userId: user.id } }),
  ]);
  return {
    errors: rows.map((r) => ({
      id: r.id,
      route: r.route,
      kind: r.kind,
      message: r.message,
      stack: r.stack,
      createdAt: r.createdAt.toISOString(),
    })),
    total,
  };
}

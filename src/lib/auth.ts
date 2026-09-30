import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "mysql",
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  user: {
    additionalFields: {},
  },
  // 本地开发端口不固定（next dev 可能随机分配），用端口通配符放行 loopback；
  // 与 BETTER_AUTH_URL 推导出的 origin 合并使用，不影响生产同域配置
  trustedOrigins: ["http://127.0.0.1:*", "http://localhost:*"],
  plugins: [nextCookies()],
});

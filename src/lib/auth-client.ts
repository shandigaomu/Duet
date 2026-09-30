import { createAuthClient } from "better-auth/react";

// 不设 baseURL：客户端始终同源请求（dev 任意端口 / 生产反代同域），
// 避免写死端口导致换端口启动时登录 Failed to fetch
export const authClient = createAuthClient();

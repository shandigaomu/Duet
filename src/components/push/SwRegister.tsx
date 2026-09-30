"use client";

import { useEffect } from "react";

/** V3-F1：注册 Service Worker（PWA 缓存 + Web Push 接收）。生产才注册，dev 避免缓存干扰。 */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const t = window.setTimeout(() => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // 注册失败静默（PWA 是增强，不阻塞主流程）
      });
    }, 1200);
    return () => window.clearTimeout(t);
  }, []);

  return null;
}

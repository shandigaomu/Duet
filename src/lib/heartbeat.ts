"use client";

import { useEffect, useRef } from "react";

/**
 * P5-O2 统一心跳：全应用共享一条定时器（模块级），任何组件都可注册回调。
 * 原状是每个组件各起一个 45s interval（今日页上全页轮询 + 悄悄话未读两条并行）；
 * 现在合并为一条，今日页数据稳定时由 TodayView 降频（setHeartbeatRate）。
 * 页面不可见时不触发（原行为等价，只是从「tick 内跳过」变成「不 fire」）。
 */

/** 常规心跳：与原 45s 轮询一致 */
export const HEARTBEAT_MS = 45_000;
/** 静止退坡：双方今日已同步且已读、无待读信号时降为 3 分钟 */
export const HEARTBEAT_IDLE_MS = 180_000;

const callbacks = new Set<() => void>();
let timer: number | null = null;
let rate = HEARTBEAT_MS;

function fire() {
  if (document.visibilityState !== "visible") return;
  for (const cb of [...callbacks]) cb();
}

function ensureTimer() {
  if (timer == null) timer = window.setInterval(fire, rate);
}

/** 全局改心跳周期；退坡只动周期不改语义。卸载时由 TodayView 还原为默认。 */
export function setHeartbeatRate(ms: number) {
  if (ms === rate) return;
  rate = ms;
  if (timer != null) {
    window.clearInterval(timer);
    timer = window.setInterval(fire, rate);
  }
}

/** 注册一个心跳回调，返回注销函数（最后一份注销时定时器自我回收） */
function registerHeartbeat(cb: () => void): () => void {
  callbacks.add(cb);
  ensureTimer();
  return () => {
    callbacks.delete(cb);
    if (callbacks.size === 0 && timer != null) {
      window.clearInterval(timer);
      timer = null;
    }
  };
}

/** React 绑定：回调经 ref 每次渲染换新，注册只发生一次 */
export function useHeartbeat(cb: () => void) {
  const ref = useRef(cb);
  useEffect(() => {
    ref.current = cb;
  });
  useEffect(() => registerHeartbeat(() => ref.current()), []);
}

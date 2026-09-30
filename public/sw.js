// Duet Service Worker（V3-F1 PWA + V3-N1 Web Push 接收端）
// 策略：app shell 预缓存；静态资源 runtime 缓存；页面 network-first；POST/Action 一律直连。
const VERSION = "duet-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-asset`;
const PAGE_CACHE = `${VERSION}-page`;

const SHELL_ASSETS = [
  "/manifest.json",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(VERSION))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(css|js|woff2?|png|jpg|jpeg|webp|gif|svg)$/i.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // 上传/推送订阅等接口直连
  if (url.pathname.startsWith("/api/")) return;

  // 静态资源：cache-first
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(ASSET_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // 页面/数据：network-first，离线回退缓存
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && req.mode === "navigate") {
          const copy = res.clone();
          caches.open(PAGE_CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches
          .match(req)
          .then((hit) => hit ?? caches.match("/today"))
          .then(
            (hit) =>
              hit ??
              new Response("离线", {
                status: 503,
                headers: { "Content-Type": "text/plain; charset=utf-8" },
              }),
          ),
      ),
  );
});

// —— V3-N1 Web Push 接收 ——
self.addEventListener("push", (event) => {
  let payload = { title: "Duet", body: "有新的动静" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // 纯文本 fallback
    if (event.data) payload.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: payload.tag || "duet",
      data: { url: payload.url || "/today" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/today";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin)) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

// —— V3-N1：页面通知订阅同步（订阅变更时把旧 endpoint 也告诉服务端删除） ——
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription ? { applicationServerKey: event.oldSubscription.options.applicationServerKey, userVisibleOnly: true } : undefined)
      .then((sub) =>
        fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: sub.toJSON() }),
        }),
      ),
  );
});

"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

type AvatarCropDialogProps = {
  file: File;
  onCancel: () => void;
  onDone: (blob: Blob) => void;
};

const FRAME = 280;
const OUT_SIZE = 512;

/** 简易方图裁剪：拖动平移 + 缩放，导出 512² JPEG */
export function AvatarCropDialog({
  file,
  onCancel,
  onDone,
}: AvatarCropDialogProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  );
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  function layout(nw: number, nh: number, s: number, o: { x: number; y: number }) {
    const cover = Math.max(FRAME / nw, FRAME / nh) * s;
    const drawW = nw * cover;
    const drawH = nh * cover;
    const dx = (FRAME - drawW) / 2 + o.x;
    const dy = (FRAME - drawH) / 2 + o.y;
    return { drawW, drawH, dx, dy };
  }

  function exportCrop() {
    const img = imgRef.current;
    if (!img || !natural) return;
    const { drawW, drawH, dx, dy } = layout(
      natural.w,
      natural.h,
      scale,
      offset,
    );
    const canvas = document.createElement("canvas");
    canvas.width = OUT_SIZE;
    canvas.height = OUT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const ratio = OUT_SIZE / FRAME;
    ctx.fillStyle = "#F5F6F4";
    ctx.fillRect(0, 0, OUT_SIZE, OUT_SIZE);
    ctx.drawImage(
      img,
      dx * ratio,
      dy * ratio,
      drawW * ratio,
      drawH * ratio,
    );
    canvas.toBlob(
      (blob) => {
        if (blob) onDone(blob);
      },
      "image/jpeg",
      0.9,
    );
  }

  const box =
    natural && layout(natural.w, natural.h, scale, offset);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(18,21,26,0.28)] backdrop-blur-sm"
        aria-label="关闭"
        onClick={onCancel}
      />
      <div className="relative z-10 w-full max-w-[360px] rounded-[var(--radius-lg)] bg-bg-elevated p-5 shadow-[var(--shadow-sheet)]">
        <h2 className="text-[17px] font-semibold text-ink">裁剪头像</h2>
        <p className="mt-1 text-[13px] text-ink-secondary">
          拖动调整位置，滑杆缩放
        </p>

        <div
          className="relative mx-auto mt-4 size-[280px] cursor-grab overflow-hidden rounded-[var(--radius-md)] bg-white/40 active:cursor-grabbing"
          onPointerDown={(e) => {
            (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
            drag.current = {
              x: e.clientX,
              y: e.clientY,
              ox: offset.x,
              oy: offset.y,
            };
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            setOffset({
              x: drag.current.ox + (e.clientX - drag.current.x),
              y: drag.current.oy + (e.clientY - drag.current.y),
            });
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              src={src}
              alt=""
              draggable={false}
              onLoad={(e) => {
                const el = e.currentTarget;
                setNatural({ w: el.naturalWidth, h: el.naturalHeight });
                setScale(1);
                setOffset({ x: 0, y: 0 });
              }}
              className="pointer-events-none absolute max-w-none select-none"
              style={
                box
                  ? {
                      width: box.drawW,
                      height: box.drawH,
                      left: box.dx,
                      top: box.dy,
                    }
                  : { opacity: 0 }
              }
            />
          ) : null}
          <div className="pointer-events-none absolute inset-0 rounded-[var(--radius-md)] ring-2 ring-brand/40" />
        </div>

        <label className="mt-4 block">
          <span className="text-[12px] text-ink-secondary">缩放</span>
          <input
            type="range"
            min={1}
            max={2.5}
            step={0.01}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="mt-1 w-full accent-brand"
          />
        </label>

        <div className="mt-5 flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={onCancel}>
            取消
          </Button>
          <Button
            className="flex-1"
            onClick={exportCrop}
            disabled={!natural}
          >
            使用此图
          </Button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type TrailPoint = { x: number; y: number; life: number };

function CometCursorLayer({ isDark }: { isDark: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const mouse = useRef({ x: -300, y: -300 });
  const trail = useRef<TrailPoint[]>([]);
  const isDarkRef = useRef(isDark);
  isDarkRef.current = isDark;

  useEffect(() => {
    document.body.classList.add("aura-cursor-active");
    return () => document.body.classList.remove("aura-cursor-active");
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const moveDot = (x: number, y: number) => {
      const dot = dotRef.current;
      if (!dot) return;
      dot.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      dot.style.opacity = "1";
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const x = e.clientX;
      const y = e.clientY;
      mouse.current = { x, y };
      moveDot(x, y);

      const last = trail.current[trail.current.length - 1];
      if (!last || Math.hypot(x - last.x, y - last.y) > 1.5) {
        trail.current.push({ x, y, life: 1 });
        if (trail.current.length > 36) trail.current.shift();
      }
    };

    const onPointerLeave = () => {
      if (dotRef.current) dotRef.current.style.opacity = "0";
    };

    const draw = () => {
      const dark = isDarkRef.current;
      ctx.clearRect(0, 0, w, h);

      const head = mouse.current;
      const points = trail.current;

      for (let i = 0; i < points.length; i++) {
        points[i].life *= 0.88;
      }
      trail.current = points.filter((p) => p.life > 0.04);

      const core = dark ? "34, 211, 238" : "109, 40, 217";
      const tail = dark ? "168, 85, 247" : "8, 145, 178";

      if (points.length >= 2) {
        for (let i = 1; i < points.length; i++) {
          const t = i / (points.length - 1);
          const alpha = t * points[i].life * (dark ? 0.75 : 0.6);
          ctx.beginPath();
          ctx.moveTo(points[i - 1].x, points[i - 1].y);
          ctx.lineTo(points[i].x, points[i].y);
          ctx.strokeStyle = `rgba(${tail}, ${alpha})`;
          ctx.lineWidth = 2 + t * 14;
          ctx.lineCap = "round";
          ctx.stroke();
        }
      }

      const glowR = dark ? 30 : 26;
      const glow = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, glowR);
      glow.addColorStop(0, `rgba(${core}, ${dark ? 1 : 0.9})`);
      glow.addColorStop(0.4, `rgba(${tail}, ${dark ? 0.45 : 0.4})`);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(head.x, head.y, glowR, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(head.x, head.y, dark ? 4.5 : 4, 0, Math.PI * 2);
      ctx.fillStyle = dark ? "#f0fdff" : "#4c1d95";
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerleave", onPointerLeave);
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="aura-comet-canvas"
        aria-hidden
      />
      <div
        ref={dotRef}
        className={`aura-cursor-dot aura-cursor-dot-fixed ${isDark ? "aura-cursor-dot-dark" : "aura-cursor-dot-light"}`}
        style={{ opacity: 0 }}
        aria-hidden
      />
    </>
  );
}

export function CometCursor({ isDark, enabled }: { isDark: boolean; enabled: boolean }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!enabled || !mounted || typeof document === "undefined") return null;

  return createPortal(<CometCursorLayer isDark={isDark} />, document.body);
}

// useState import missing!
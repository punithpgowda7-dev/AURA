"use client";

import { useEffect, useRef } from "react";

type Star = {
  x: number;
  y: number;
  z: number;
  size: number;
};

type Planet = {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  hue: number;
  alpha: number;
};

function initStars(count: number, w: number, h: number): Star[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    z: Math.random() * 1.5 + 0.2,
    size: Math.random() * 1.8 + 0.4,
  }));
}

function initPlanets(w: number, h: number, isDark: boolean): Planet[] {
  const hues = isDark ? [190, 270, 320, 210] : [260, 200, 280, 220];
  return hues.map((hue, i) => ({
    x: w * (0.15 + i * 0.22),
    y: h * (0.2 + (i % 2) * 0.45),
    radius: 40 + i * 28,
    vx: (Math.random() - 0.5) * 0.15,
    vy: (Math.random() - 0.5) * 0.12,
    hue,
    alpha: isDark ? 0.12 + i * 0.03 : 0.08 + i * 0.02,
  }));
}

export function AuraBackground({ isDark }: { isDark: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const planetsRef = useRef<Planet[]>([]);

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
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      starsRef.current = initStars(isDark ? 180 : 140, w, h);
      planetsRef.current = initPlanets(w, h, isDark);
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      const planets = planetsRef.current;
      for (const p of planets) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -p.radius) p.x = w + p.radius;
        if (p.x > w + p.radius) p.x = -p.radius;
        if (p.y < -p.radius) p.y = h + p.radius;
        if (p.y > h + p.radius) p.y = -p.radius;

        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
        grad.addColorStop(0, `hsla(${p.hue}, 80%, ${isDark ? "65%" : "55%"}, ${p.alpha * 1.2})`);
        grad.addColorStop(0.5, `hsla(${p.hue}, 70%, 50%, ${p.alpha * 0.5})`);
        grad.addColorStop(1, "hsla(0, 0%, 0%, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      const stars = starsRef.current;
      const speedBase = isDark ? 0.35 : 0.22;
      for (const s of stars) {
        const speed = speedBase * s.z;
        s.y += speed;
        s.x += speed * 0.15;
        if (s.y > h + 4) {
          s.y = -4;
          s.x = Math.random() * w;
        }
        if (s.x > w + 4) s.x = -4;
        if (s.x < -4) s.x = w + 4;

        const twinkle = 0.5 + Math.sin(Date.now() * 0.002 + s.x * 0.01) * 0.5;
        const alpha = (isDark ? 0.35 + s.z * 0.45 : 0.45 + s.z * 0.4) * twinkle;
        const size = s.size * (0.6 + s.z * 0.5);

        ctx.beginPath();
        ctx.arc(s.x, s.y, size, 0, Math.PI * 2);
        if (isDark) {
          ctx.fillStyle = `rgba(220, 240, 255, ${alpha})`;
        } else {
          ctx.fillStyle = `rgba(79, 70, 229, ${alpha * 0.85})`;
        }
        ctx.fill();

        if (s.z > 1) {
          ctx.strokeStyle = isDark
            ? `rgba(34, 211, 238, ${alpha * 0.3})`
            : `rgba(124, 58, 237, ${alpha * 0.25})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x - speed * 8, s.y - speed * 12);
          ctx.stroke();
        }
      }

      raf = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [isDark]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0" aria-hidden>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <div className={isDark ? "aura-grid-dark" : "aura-grid-light"} />
      <div className={`aura-orb aura-orb-1 ${isDark ? "aura-orb-dark-cyan" : "aura-orb-light-cyan"}`} />
      <div className={`aura-orb aura-orb-2 ${isDark ? "aura-orb-dark-purple" : "aura-orb-light-purple"}`} />
      {isDark && <div className="aura-scanline" />}
      <div className={`aura-vignette ${isDark ? "aura-vignette-dark" : "aura-vignette-light"}`} />
    </div>
  );
}

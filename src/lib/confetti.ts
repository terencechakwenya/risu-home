// Tiny dependency-free confetti burst. Spawns a throwaway full-screen canvas,
// animates ~90 paper bits with gravity for ~1.5s, then removes itself. Purely
// visual — never awaited, never in the Save path. Respects reduced-motion.

const COLORS = ["#16365C", "#ED1C24", "#639922", "#BA7517", "#185FA5", "#EAB308"];

export function celebrate(opts?: { particles?: number; originY?: number }) {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  // Drop the celebration entirely on very low-RAM devices. A full-screen canvas
  // plus an RAF animation is pure overhead the save doesn't need, and on a
  // ~1 GiB phone it's exactly the kind of allocation that tips the tab into the
  // OS low-memory toast. deviceMemory is approximate GiB (Chrome/Android).
  const deviceMemory = (navigator as { deviceMemory?: number }).deviceMemory;
  if (typeof deviceMemory === "number" && deviceMemory <= 1) return;

  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:60";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }

  const cx = canvas.width / 2;
  const cy = canvas.height * (opts?.originY ?? 0.4);
  // Clamp particle count on memory-constrained devices (≤2 GiB) — keeps the
  // burst cheap without dropping it on mid-range phones.
  const lowMem = typeof deviceMemory === "number" && deviceMemory <= 2;
  const N = Math.min(opts?.particles ?? 90, lowMem ? 40 : 200);

  const parts = Array.from({ length: N }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 7;
    return {
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 6,
      size: 4 + Math.random() * 5,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      life: 0,
    };
  });

  const gravity = 0.22;
  const drag = 0.992;
  const maxLife = 95;
  let raf = 0;

  const frame = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of parts) {
      p.life++;
      if (p.life > maxLife) continue;
      alive = true;
      p.vx *= drag;
      p.vy = p.vy * drag + gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - p.life / maxLife);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
    if (alive) {
      raf = requestAnimationFrame(frame);
    } else {
      cancelAnimationFrame(raf);
      canvas.remove();
    }
  };
  raf = requestAnimationFrame(frame);
}

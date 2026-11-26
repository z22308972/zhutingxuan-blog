/**
 * 轻柔不干扰阅读的动态粒子画布背景
 * 特点：极低透明度、缓慢漂浮、轻度鼠标连线互动、支持暂停开关与 prefers-reduced-motion
 */
(function () {
  const STORAGE_KEY = "blog_particles_enabled";
  const canvas = document.getElementById("particle-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const prefersReduced =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let enabled = localStorage.getItem(STORAGE_KEY) !== "0" && !prefersReduced;
  let width = 0;
  let height = 0;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let particles = [];
  let rafId = null;
  let mouse = { x: -9999, y: -9999, active: false };

  function getParticleCount(w, h) {
    const area = w * h;
    return Math.max(22, Math.min(56, Math.round(area / 26000)));
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, Math.floor(rect.width));
    height = Math.max(1, Math.floor(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const target = getParticleCount(width, height);
    if (particles.length === 0) {
      for (let i = 0; i < target; i++) particles.push(makeParticle());
    } else if (particles.length < target) {
      while (particles.length < target) particles.push(makeParticle());
    } else if (particles.length > target) {
      particles.length = target;
    }
  }

  function makeParticle() {
    const isTeal = Math.random() < 0.28;
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.34,
      vy: (Math.random() - 0.5) * 0.34,
      r: 1.15 + Math.random() * 1.45,
      alpha: 0.14 + Math.random() * 0.14,
      color: isTeal ? "13, 148, 136" : "100, 116, 139"
    };
  }

  function step() {
    if (!enabled || document.hidden) {
      rafId = null;
      return;
    }

    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < -12) p.x = width + 12;
      if (p.x > width + 12) p.x = -12;
      if (p.y < -12) p.y = height + 12;
      if (p.y > height + 12) p.y = -12;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color}, ${p.alpha.toFixed(3)})`;
      ctx.fill();
    }

    // 柔和连线（低透明度，绝不干扰正文）
    const maxDist = 130;
    const maxDistSq = maxDist * maxDist;
    ctx.lineWidth = 0.75;

    for (let i = 0; i < particles.length; i++) {
      const a = particles[i];
      for (let j = i + 1; j < particles.length; j++) {
        const b = particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < maxDistSq) {
          const opacity = (1 - Math.sqrt(d2) / maxDist) * 0.085;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(100, 116, 139, ${opacity.toFixed(3)})`;
          ctx.stroke();
        }
      }

      if (mouse.active) {
        const dx = a.x - mouse.x;
        const dy = a.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        const mouseMax = 145;
        if (d2 < mouseMax * mouseMax) {
          const opacity = (1 - Math.sqrt(d2) / mouseMax) * 0.11;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(13, 148, 136, ${opacity.toFixed(3)})`;
          ctx.stroke();
        }
      }
    }

    rafId = requestAnimationFrame(step);
  }

  function start() {
    if (!enabled) return;
    if (!rafId) rafId = requestAnimationFrame(step);
  }

  function stop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    ctx.clearRect(0, 0, width, height);
  }

  window.addEventListener("resize", () => {
    resize();
    if (enabled && !rafId) start();
  });

  window.addEventListener("mousemove", (e) => {
    if (!enabled) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x >= 0 && y >= 0 && x <= rect.width && y <= rect.height) {
      mouse.x = x;
      mouse.y = y;
      mouse.active = true;
    } else {
      mouse.active = false;
    }
  });

  window.addEventListener("mouseleave", () => {
    mouse.active = false;
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    } else if (enabled) {
      start();
    }
  });

  resize();
  if (enabled) start();

  window.ParticleField = {
    isEnabled: () => enabled,
    toggle() {
      enabled = !enabled;
      localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
      if (enabled) {
        resize();
        start();
      } else {
        stop();
      }
      return enabled;
    }
  };
})();

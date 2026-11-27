/**
 * 灵动交互式粒子星网 + 柔和流光背景 + 点击涟漪扩散特效
 * 支持侧边栏「粒子: 开/关」按钮一键切换，兼容 prefers-reduced-motion
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
  let sparks = [];
  let ripples = [];
  let orbs = [];
  let rafId = null;
  let tick = 0;
  let mouse = { x: -9999, y: -9999, active: false };

  const PALETTE = [
    { rgb: "13, 148, 136", glow: true },   // 翡翠青
    { rgb: "14, 165, 233", glow: true },   // 晴空蓝
    { rgb: "99, 102, 241", glow: false },  // 柔和靛蓝
    { rgb: "71, 85, 105", glow: false }    // 远山灰蓝
  ];

  function getParticleCount(w, h) {
    const area = w * h;
    return Math.max(46, Math.min(96, Math.round(area / 13500)));
  }

  function initOrbs() {
    orbs = [
      {
        x: width * 0.22,
        y: height * 0.25,
        vx: 0.32,
        vy: 0.22,
        r: Math.max(220, Math.min(380, width * 0.34)),
        rgb: "13, 148, 136",
        alpha: 0.085
      },
      {
        x: width * 0.78,
        y: height * 0.32,
        vx: -0.26,
        vy: 0.28,
        r: Math.max(200, Math.min(350, width * 0.3)),
        rgb: "56, 189, 248",
        alpha: 0.08
      },
      {
        x: width * 0.55,
        y: height * 0.78,
        vx: 0.24,
        vy: -0.25,
        r: Math.max(200, Math.min(340, width * 0.28)),
        rgb: "99, 102, 241",
        alpha: 0.055
      }
    ];
  }

  function makeParticle() {
    const pick = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    const speed = 0.42 + Math.random() * 0.75;
    const angle = Math.random() * Math.PI * 2;
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      baseVx: Math.cos(angle) * speed,
      baseVy: Math.sin(angle) * speed,
      r: 1.7 + Math.random() * 2.3,
      alpha: 0.36 + Math.random() * 0.36,
      phase: Math.random() * Math.PI * 2,
      pulseSpeed: 0.02 + Math.random() * 0.028,
      color: pick.rgb,
      glow: pick.glow
    };
  }

  function spawnClickEffect(x, y) {
    ripples.push({
      x,
      y,
      r: 6,
      maxR: 135,
      alpha: 0.45
    });
    for (let i = 0; i < 12; i++) {
      const ang = (Math.PI * 2 * i) / 12 + (Math.random() - 0.5) * 0.35;
      const spd = 1.6 + Math.random() * 2.4;
      const pick = PALETTE[i % 3];
      sparks.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        r: 1.8 + Math.random() * 2.0,
        alpha: 0.85,
        color: pick.rgb
      });
    }
    if (sparks.length > 90) sparks.splice(0, sparks.length - 90);
    if (ripples.length > 8) ripples.shift();
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, Math.floor(rect.width));
    height = Math.max(1, Math.floor(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (orbs.length === 0) initOrbs();

    const target = getParticleCount(width, height);
    if (particles.length === 0) {
      for (let i = 0; i < target; i++) particles.push(makeParticle());
    } else if (particles.length < target) {
      while (particles.length < target) particles.push(makeParticle());
    } else if (particles.length > target) {
      particles.length = target;
    }
  }

  function drawAmbientOrbs() {
    for (let i = 0; i < orbs.length; i++) {
      const o = orbs[i];
      o.x += o.vx;
      o.y += o.vy;
      if (o.x < -o.r * 0.3 || o.x > width + o.r * 0.3) o.vx *= -1;
      if (o.y < -o.r * 0.3 || o.y > height + o.r * 0.3) o.vy *= -1;

      const grad = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
      grad.addColorStop(0, `rgba(${o.rgb}, ${o.alpha})`);
      grad.addColorStop(0.55, `rgba(${o.rgb}, ${(o.alpha * 0.38).toFixed(4)})`);
      grad.addColorStop(1, `rgba(${o.rgb}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function step() {
    if (!enabled || document.hidden) {
      rafId = null;
      return;
    }

    tick++;
    ctx.clearRect(0, 0, width, height);

    // 1. 流动极光光晕层
    drawAmbientOrbs();

    // 2. 鼠标柔和光晕跟随
    if (mouse.active) {
      const mg = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 165);
      mg.addColorStop(0, "rgba(13, 148, 136, 0.11)");
      mg.addColorStop(0.6, "rgba(14, 165, 233, 0.04)");
      mg.addColorStop(1, "rgba(13, 148, 136, 0)");
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 165, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. 更新并绘制粒子（带弹性鼠标吸引与呼吸感）
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.phase += p.pulseSpeed;

      if (mouse.active) {
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const d2 = dx * dx + dy * dy;
        const pullRadius = 210;
        if (d2 < pullRadius * pullRadius && d2 > 36) {
          const dist = Math.sqrt(d2);
          const force = ((pullRadius - dist) / pullRadius) * 0.038;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }
      }

      // 缓慢回归自然巡航速度，防止聚集过死
      p.vx += (p.baseVx - p.vx) * 0.025;
      p.vy += (p.baseVy - p.vy) * 0.025;

      p.x += p.vx;
      p.y += p.vy;

      if (p.x < -16) p.x = width + 16;
      if (p.x > width + 16) p.x = -16;
      if (p.y < -16) p.y = height + 16;
      if (p.y > height + 16) p.y = -16;

      const pulse = 0.82 + Math.sin(p.phase) * 0.24;
      const radius = p.r * pulse;
      const alpha = Math.min(0.88, p.alpha * pulse);

      if (p.glow) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color}, ${(alpha * 0.18).toFixed(3)})`;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color}, ${alpha.toFixed(3)})`;
      ctx.fill();
    }

    // 4. 清晰灵动的星网连线
    const maxDist = 158;
    const maxDistSq = maxDist * maxDist;

    for (let i = 0; i < particles.length; i++) {
      const a = particles[i];
      for (let j = i + 1; j < particles.length; j++) {
        const b = particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < maxDistSq) {
          const ratio = 1 - Math.sqrt(d2) / maxDist;
          const opacity = ratio * 0.28;
          ctx.lineWidth = 0.7 + ratio * 0.8;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle =
            a.glow || b.glow
              ? `rgba(13, 148, 136, ${opacity.toFixed(3)})`
              : `rgba(71, 85, 105, ${(opacity * 0.85).toFixed(3)})`;
          ctx.stroke();
        }
      }

      if (mouse.active) {
        const dx = a.x - mouse.x;
        const dy = a.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        const mouseMax = 195;
        if (d2 < mouseMax * mouseMax) {
          const ratio = 1 - Math.sqrt(d2) / mouseMax;
          const opacity = ratio * 0.46;
          ctx.lineWidth = 0.9 + ratio * 1.1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(13, 148, 136, ${opacity.toFixed(3)})`;
          ctx.stroke();
        }
      }
    }

    // 5. 点击水波涟漪与星火微粒
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      rp.r += 3.2;
      rp.alpha *= 0.94;
      if (rp.r >= rp.maxR || rp.alpha < 0.015) {
        ripples.splice(i, 1);
        continue;
      }
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = `rgba(13, 148, 136, ${rp.alpha.toFixed(3)})`;
      ctx.stroke();
    }

    for (let i = sparks.length - 1; i >= 0; i--) {
      const sp = sparks[i];
      sp.x += sp.vx;
      sp.y += sp.vy;
      sp.vx *= 0.96;
      sp.vy *= 0.96;
      sp.alpha *= 0.945;
      sp.r *= 0.985;
      if (sp.alpha < 0.02) {
        sparks.splice(i, 1);
        continue;
      }
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${sp.color}, ${sp.alpha.toFixed(3)})`;
      ctx.fill();
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
    sparks = [];
    ripples = [];
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

  window.addEventListener("click", (e) => {
    if (!enabled) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x >= 0 && y >= 0 && x <= rect.width && y <= rect.height) {
      spawnClickEffect(x, y);
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

// <network-field>: a quiet, drifting network of points and hairline connections behind the hero.
// Points drift slowly; nearby points link with faint lines; the cursor gently connects to what is close.
(() => {
  if (customElements.get('network-field')) return;

  const LINK = 150;          // px: points closer than this connect
  const DENSITY = 1 / 17000; // points per px² of hero
  const SPEED = 4;           // px per second, max drift
  const INK = '14,17,22';

  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  class NetworkField extends HTMLElement {
    connectedCallback() {
      this.style.cssText += ';display:block;position:absolute;pointer-events:none;';
      const c = this.canvas = document.createElement('canvas');
      c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
      c.setAttribute('aria-hidden', 'true');
      this.appendChild(c);
      this.ctx = c.getContext('2d');
      this.pts = [];
      this.mouse = null;
      this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.last = performance.now(); this.visible = true;
      this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(this);
      this.io = new IntersectionObserver(e => { this.visible = e[0].isIntersecting; }); this.io.observe(this);
      // the cursor is tracked on the hero, since this layer ignores the pointer
      const host = this.parentElement;
      this.onMove = e => { const r = this.getBoundingClientRect(); this.mouse = { x: e.clientX - r.left, y: e.clientY - r.top }; };
      this.onLeave = () => { this.mouse = null; };
      host.addEventListener('pointermove', this.onMove);
      host.addEventListener('pointerleave', this.onLeave);
      this.resize();
      const loop = now => {
        const dt = Math.min(now - this.last, 100) / 1000; this.last = now;
        if (this.visible && !document.hidden) { if (!this.reduced) this.step(dt); this.draw(); }
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    }
    disconnectedCallback() {
      cancelAnimationFrame(this.raf); this.ro && this.ro.disconnect(); this.io && this.io.disconnect();
      const host = this.parentElement; if (host) { host.removeEventListener('pointermove', this.onMove); host.removeEventListener('pointerleave', this.onLeave); }
    }

    resize() {
      const d = Math.min(devicePixelRatio || 1, 2), w = this.clientWidth, h = this.clientHeight;
      if (!w || !h) return;
      this.canvas.width = Math.round(w * d); this.canvas.height = Math.round(h * d);
      this.ctx.setTransform(d, 0, 0, d, 0, 0);
      this.w = w; this.h = h;
      // keep existing points, add or trim to match the area
      const want = Math.round(w * h * DENSITY);
      while (this.pts.length < want) {
        const a = rnd() * Math.PI * 2, v = (.35 + rnd() * .65) * SPEED;
        this.pts.push({ x: rnd() * w, y: rnd() * h, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 1.4 });
      }
      this.pts.length = want;
    }

    step(dt) {
      const { w, h } = this;
      for (const p of this.pts) {
        p.x += p.vx * dt; p.y += p.vy * dt;
        // wrap softly around the edges so the field never empties
        if (p.x < -20) p.x = w + 20; else if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20; else if (p.y > h + 20) p.y = -20;
      }
    }

    draw() {
      const { ctx, w, h, pts } = this;
      if (!w) return;
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = .8;
      // hairlines between near neighbours
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j], dx = a.x - b.x, dy = a.y - b.y;
          if (dx > LINK || dx < -LINK || dy > LINK || dy < -LINK) continue;
          const dd = Math.hypot(dx, dy);
          if (dd < LINK) {
            // flat: one line weight; only a short fade at the very edge so links don't pop
            ctx.strokeStyle = `rgba(${INK},${Math.min(1, (LINK - dd) / (LINK * .15)) * .11})`;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      // the cursor reaches out to nearby points
      const m = this.mouse;
      if (m) {
        for (const p of pts) {
          const dd = Math.hypot(p.x - m.x, p.y - m.y);
          if (dd < LINK * 1.3) {
            ctx.strokeStyle = `rgba(${INK},${Math.min(1, (LINK * 1.3 - dd) / (LINK * .2)) * .11})`;
            ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(p.x, p.y); ctx.stroke();
          }
        }
      }
      ctx.fillStyle = `rgba(${INK},.4)`;
      for (const p of pts) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  customElements.define('network-field', NetworkField);
})();

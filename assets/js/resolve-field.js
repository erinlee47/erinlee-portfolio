// <resolve-field>: a tangled knot of points that settles into a few clean rows, then rests.
// The idea behind the hero: complex in, simple out.
(() => {
  if (customElements.get('resolve-field')) return;

  const LINK = 170;          // px: while tangled, points closer than this connect
    const SPEED = 12;          // px per second, drift while tangled
  const DELAY = 700;         // ms of tangle before it starts to settle
  const DUR = 2400;          // ms for each point to reach its place
  const INK = '14,17,22';
  const LINE_TANGLE = .09, LINE_ORDER = .14, DOT = .4;

  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // same curve as the case study transitions: cubic-bezier(.65,0,.25,1), close enough as ease-in-out
  const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

  class ResolveField extends HTMLElement {
    connectedCallback() {
      this.style.cssText += ';display:block;position:absolute;pointer-events:none;';
      const c = this.canvas = document.createElement('canvas');
      c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
      c.setAttribute('aria-hidden', 'true');
      this.appendChild(c);
      this.ctx = c.getContext('2d');
      this.pts = [];
      this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.start = null; this.last = performance.now(); this.done = false;
      this.ro = new ResizeObserver(() => { this.resize(); if (this.done) this.draw(1e9); });
      this.ro.observe(this);
      this.resize();
      const loop = now => {
        if (this.start === null) this.start = now;
        const dt = Math.min(now - this.last, 100) / 1000; this.last = now;
        const t = this.reduced ? 1e9 : now - this.start;
        this.step(dt, t); this.draw(t);
        if (t < DELAY + DUR + 800) this.raf = requestAnimationFrame(loop);
        else this.done = true;     // settled: stop animating, the drawing rests
      };
      this.raf = requestAnimationFrame(loop);
    }
    disconnectedCallback() { cancelAnimationFrame(this.raf); this.ro && this.ro.disconnect(); }

    resize() {
      const d = Math.min(devicePixelRatio || 1, 2), w = this.clientWidth, h = this.clientHeight;
      if (!w || !h) return;
      this.canvas.width = Math.round(w * d); this.canvas.height = Math.round(h * d);
      this.ctx.setTransform(d, 0, 0, d, 0, 0);
      this.w = w; this.h = h;
      const narrow = w < 700;
      // always 12 dots: 3 rows of 4
      const rows = 3, cols = 4;
      // where the clean rows end up: clear of the text. Right of it on desktop, above the headline on phones
      const x0 = w * (narrow ? .68 : .72), x1 = w * (narrow ? .92 : .93);
      const y0 = h * (narrow ? .015 : .34), y1 = h * (narrow ? .085 : .66);
      // where the knot starts: one dense, messy cluster around the same spot
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const rx = narrow ? w * .14 : w * .11, ry = narrow ? h * .05 : h * .17;
      seed = 11;
      this.pts = [];
      for (let i = 0; i < rows * cols; i++) {
        const row = Math.floor(i / cols), col = i % cols;
        const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
        const va = rnd() * Math.PI * 2, v = (.35 + rnd() * .65) * SPEED;
        this.pts.push({
          x: cx + Math.cos(a) * r * rx, y: cy + Math.sin(a) * r * ry,
          vx: Math.cos(va) * v, vy: Math.sin(va) * v,
          tx: x0 + (cols === 1 ? 0 : (x1 - x0) * col / (cols - 1)),
          ty: y0 + (rows === 1 ? 0 : (y1 - y0) * row / (rows - 1)),
          row, col, lag: col * 45 + rnd() * 220, p: 0,
        });
      }
    }

    step(dt, t) {
      for (const q of this.pts) {
        q.p = ease(Math.min(1, Math.max(0, (t - DELAY - q.lag) / DUR)));
        if (q.p < 1) { q.x += q.vx * dt * (1 - q.p); q.y += q.vy * dt * (1 - q.p); }
      }
    }

    draw(t) {
      const { ctx, w, h, pts } = this;
      if (!w) return;
      if (t >= 1e9) for (const q of pts) q.p = 1;
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = .8;
      const pos = q => [q.x + (q.tx - q.x) * q.p, q.y + (q.ty - q.y) * q.p];
      const P = pts.map(pos);
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], [ax, ay] = P[i];
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j], [bx, by] = P[j];
          const settle = Math.min(a.p, b.p);
          // the tangle's links fade out as the points settle
          const loose = 1 - (a.p + b.p) / 2;
          let alpha = 0;
          if (loose > 0) {
            const dd = Math.hypot(ax - bx, ay - by);
            if (dd < LINK) alpha = Math.min(1, (LINK - dd) / (LINK * .15)) * LINE_TANGLE * loose;
          }
          // clean links between neighbours in a row fade in
          if (a.row === b.row && Math.abs(a.col - b.col) === 1) alpha = Math.max(alpha, LINE_ORDER * settle);
          if (alpha > .003) {
            ctx.strokeStyle = `rgba(${INK},${alpha})`;
            ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
          }
        }
      }
      ctx.fillStyle = `rgba(${INK},${DOT})`;
      for (const [x, y] of P) { ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  customElements.define('resolve-field', ResolveField);
})();

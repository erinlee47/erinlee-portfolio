// <scribble-field>: one dotted line draws itself as a tangled scribble, then pulls straight
// into a single simple line that ends on an accent dot. Complex in, simple out.
(() => {
  if (customElements.get('scribble-field')) return;

  const M = 700;             // samples along the line
  const DRAW = 1400;         // ms: the scribble draws itself
  const HOLD = 450;          // ms: a beat on the tangle
  const PULL = 2600;         // ms: each part of the line straightens
  const SPREAD = .35;        // how much later the far end straightens than the near end
  const INK = 'rgba(14,17,22,.7)';
  const ACCENT = '#B85C37';  // --accent, oklch(.58 .13 42)

  const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const easeOut = x => 1 - Math.pow(1 - x, 3);
  const clamp = x => Math.max(0, Math.min(1, x));

  // Catmull-Rom through control points, then resample evenly by length
  function smooth(ctrl, steps) {
    const out = [];
    for (let i = 0; i < ctrl.length - 1; i++) {
      const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
      for (let s = 0; s < steps; s++) {
        const t = s / steps, t2 = t * t, t3 = t2 * t;
        out.push([
          .5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          .5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        ]);
      }
    }
    out.push(ctrl[ctrl.length - 1]);
    return out;
  }
  function resample(pts, n) {
    const acc = [0];
    for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = acc[acc.length - 1], out = [];
    let j = 0;
    for (let k = 0; k < n; k++) {
      const d = total * k / (n - 1);
      while (j < acc.length - 2 && acc[j + 1] < d) j++;
      const seg = acc[j + 1] - acc[j] || 1, f = (d - acc[j]) / seg;
      out.push([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f]);
    }
    return out;
  }

  class ScribbleField extends HTMLElement {
    connectedCallback() {
      this.style.cssText += ';display:block;position:absolute;pointer-events:none;';
      const c = this.canvas = document.createElement('canvas');
      c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
      c.setAttribute('aria-hidden', 'true');
      this.appendChild(c);
      this.ctx = c.getContext('2d');
      this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.start = null; this.t = 0;
      this.ro = new ResizeObserver(() => { this.resize(); this.draw(this.t); });
      this.ro.observe(this);
      this.resize();
      const end = DRAW + HOLD + PULL * (1 + SPREAD) + 200;
      const loop = now => {
        if (this.start === null) this.start = now;
        this.t = this.reduced ? end : now - this.start;
        this.draw(this.t);
        if (this.t < end) this.raf = requestAnimationFrame(loop);
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
      // the line runs across the right side on desktop, across the top on phones
      const xa = w * (narrow ? .6 : .6), xb = w * (narrow ? .94 : .96);
      const y = narrow ? h * .045 : h * .46;
      const cx = narrow ? w * .78 : w * .8, rx = narrow ? w * .09 : w * .09, ry = narrow ? h * .035 : h * .12;
      // the tangle: enter from the left, loop around inside a loose ball, leave to the right
      let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const ctrl = [[xa, y], [cx - rx * 1.25, y + ry * .05]];
      let ang = Math.PI, px = cx - rx * .6, py = y;
      for (let i = 0; i < 24; i++) {
        // wander with momentum and keep curling back toward the middle: loose, hand-drawn loops
        ang += (rnd() < .5 ? -1 : 1) * (.5 + rnd() * 1.4) + .9;
        const step = (.55 + rnd() * .8);
        px += Math.cos(ang) * rx * step; py += Math.sin(ang) * ry * step * .9;
        // pull back inside the ball so it stays one bunched-up shape
        px += (cx - px) * .35; py += (y - py) * .35;
        // and never past its edge
        const ex = (px - cx) / rx, ey = (py - y) / ry, e = Math.hypot(ex, ey);
        if (e > 1) { px = cx + ex / e * rx; py = y + ey / e * ry; }
        ctrl.push([px, py]);
      }
      ctrl.push([cx + rx * 1.25, y - ry * .05], [xb, y]);
      this.A = resample(smooth(ctrl, 24), M);
      // the answer: one straight line between the same two ends
      this.B = Array.from({ length: M }, (_, k) => [xa + (xb - xa) * k / (M - 1), y]);
      this.P = this.A.map(p => p.slice());
    }

    draw(t) {
      const { ctx, w, h, A, B, P } = this;
      if (!w) return;
      const drawn = easeOut(clamp(t / DRAW));
      const pt = t - DRAW - HOLD;
      for (let k = 0; k < M; k++) {
        // the near end straightens first, the far end last, like pulling a string taut
        const f = ease(clamp((pt - PULL * SPREAD * (k / M)) / PULL));
        P[k][0] = A[k][0] + (B[k][0] - A[k][0]) * f;
        P[k][1] = A[k][1] + (B[k][1] - A[k][1]) * f;
      }
      const upto = Math.max(2, Math.round(M * drawn));
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.setLineDash([.1, 3.6]);   // round dots, like a dotted pen line
      ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]);
      for (let k = 1; k < upto; k++) ctx.lineTo(P[k][0], P[k][1]);
      ctx.stroke();
      ctx.restore();
      // the accent dot rides the tip while drawing, and marks the end once it's simple
      const tip = P[upto - 1];
      ctx.fillStyle = ACCENT;
      ctx.beginPath(); ctx.arc(tip[0], tip[1], 3.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  customElements.define('scribble-field', ScribbleField);
})();

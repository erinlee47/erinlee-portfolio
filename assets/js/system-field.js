// <system-field>: a stippled system that untangles.
// A knotted cloud of points (the complex system behind the screen) slowly resolves into one calm ring
// (the simple experience). Two companions travel along it, a person and an AI, and connect once it settles.
(() => {
  if (customElements.get('system-field')) return;

  const N = 4200;            // points in the form
  const ORBIT_SHARE = 0.26;  // share of points that sit on orbits
  const CYCLE = 15;          // seconds: complex hold, untangle, simple hold, re-tangle
  const TAU = Math.PI * 2;

  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  // Deterministic randoms so the form is the same on every load
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };

  // Rotate a point around the x axis, then the z axis
  function tilt([x, y, z], ax, az) {
    const ca = Math.cos(ax), sa = Math.sin(ax), cz = Math.cos(az), sz = Math.sin(az);
    const y1 = y * ca - z * sa, z1 = y * sa + z * ca;
    return [x * cz - y1 * sz, x * sz + y1 * cz, z1];
  }

  // Each point has a place in the tangle (a) and a place in the calm form (b)
  function buildPoints() {
    const pts = [];
    const orbits = [
      { r: 1.42, ax: 1.05, az: .35 }, { r: 1.62, ax: -.55, az: 1.1 }, { r: 1.30, ax: .2, az: -.9 }
    ];
    for (let i = 0; i < N; i++) {
      const onOrbit = rnd() < ORBIT_SHARE;
      const t = rnd() * TAU;
      let a, b;
      if (!onOrbit) {
        // (2,5) torus knot with a loose, grainy tube
        const p = 2, q = 5, R = 1, r = .42;
        const k = R + r * Math.cos(q * t);
        // a tube around the knot curve, like a ribbon of stipple
        const ph = rnd() * TAU, tr = .085 * Math.sqrt(rnd());
        a = [k * Math.cos(p * t) + Math.cos(ph) * tr, k * Math.sin(p * t) + Math.sin(ph) * tr * .8, r * Math.sin(q * t) + Math.sin(ph + 1.3) * tr];
        // unwound onto a calm ring: a smooth donut surface
        const ang = p * t, tube = .085, ring = 1 + Math.cos(ph) * tube;
        b = [Math.cos(ang) * ring, Math.sin(ang) * ring, Math.sin(ph) * tube];
      } else {
        const o = orbits[Math.floor(rnd() * orbits.length)];
        const jit = .006;
        a = tilt([Math.cos(t) * o.r, Math.sin(t) * o.r, gauss() * jit], o.ax, o.az);
        // every orbit settles into one path in the ring's plane
        b = [Math.cos(t) * 1.48, Math.sin(t) * 1.48, gauss() * .008];
      }
      // Orbit points are drawn sparser (dotted lines); knot points denser (stipple)
      pts.push({ a, b, orbit: onOrbit, lag: rnd() * .35 });
    }
    return pts;
  }

  class SystemField extends HTMLElement {
    connectedCallback() {
      this.style.cssText += ';display:block;position:absolute;pointer-events:none;';
      const c = this.canvas = document.createElement('canvas');
      c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
      c.setAttribute('aria-hidden', 'true');
      this.appendChild(c);
      this.ctx = c.getContext('2d');
      this.pts = buildPoints();
      const css = getComputedStyle(document.documentElement);
      this.ink = '14,17,22';
      this.human = css.getPropertyValue('--accent').trim() || '#B8683F';
      this.ai = '#4E55C8';
      this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.t = 0; this.last = performance.now(); this.visible = true;
      this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(this); this.ro.observe(this.parentElement);
      this.io = new IntersectionObserver(e => { this.visible = e[0].isIntersecting; }); this.io.observe(this);
      this.resize();
      const loop = now => {
        const dt = Math.min(now - this.last, 50); this.last = now;
        if (this.visible && !document.hidden) {
          if (!this.reduced) this.t += dt / 1000;
          this.draw();
        }
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    }
    disconnectedCallback() { cancelAnimationFrame(this.raf); this.ro && this.ro.disconnect(); this.io && this.io.disconnect(); }

    // Fit the form into the open space right of the hero copy
    resize() {
      const d = Math.min(devicePixelRatio || 1, 2), w = this.clientWidth, h = this.clientHeight;
      if (!w || !h) return;
      this.canvas.width = Math.round(w * d); this.canvas.height = Math.round(h * d);
      this.ctx.setTransform(d, 0, 0, d, 0, 0);
      this.w = w; this.h = h;
      const box = this.getBoundingClientRect();
      const copy = [...this.parentElement.querySelectorAll('.hero h1, .hero__lede')];
      const textRight = Math.max(0, ...copy.map(el => {
        // measure the actual text line widths, not the block
        const r = document.createRange(); r.selectNodeContents(el);
        return [...r.getClientRects()].reduce((m, q) => Math.max(m, q.right), 0) - box.left;
      }));
      const room = w - textRight;
      // the widest orbit is ~1.62x the ring radius
      // Size to the free space; on narrower screens it gets smaller rather than crowding the copy
      let rad = Math.min(room / 3.4, h * .28);
      this.fade = 1;
      if (rad < 90) { rad = Math.max(rad, h * .14); this.fade = .7; }
      this.rad = rad;
      // keep the widest orbit inside the column
      this.cx = Math.min(w - rad * 1.7, Math.max(textRight + rad * 1.7, w - rad * 1.75));
      this.cy = h * .47;
    }

    draw() {
      const { ctx, w, h, rad, cx, cy } = this;
      if (!w) return;
      ctx.clearRect(0, 0, w, h);

      // Morph timeline: 0 = tangled, 1 = resolved
      const u = this.reduced ? .5 : (this.t % CYCLE) / CYCLE;
      let m;
      if (u < .22) m = 0;
      else if (u < .42) m = ease((u - .22) / .20);
      else if (u < .80) m = 1;
      else m = 1 - ease((u - .80) / .20);
      if (this.reduced) m = 1;

      const rotY = this.t * .09, rx = 1.02 + Math.sin(this.t * .07) * .05;
      const cyr = Math.cos(rotY), syr = Math.sin(rotY), cx1 = Math.cos(rx), sx1 = Math.sin(rx);
      const persp = 4.2;
      const project = ([x, y, z]) => {
        // spin around the vertical axis, then tip toward the viewer
        const x1 = x * cyr + z * syr, z1 = -x * syr + z * cyr;
        const y2 = y * cx1 - z1 * sx1, z2 = y * sx1 + z1 * cx1;
        const s = persp / (persp + z2);
        return [cx + x1 * rad * s, cy + y2 * rad * s, z2];
      };

      // Stipple: small squares, darker toward the viewer; batched by tone
      const buckets = [[], [], [], []];
      for (const p of this.pts) {
        const k = ease(clamp((m * 1.35) - p.lag));
        const q = [p.a[0] + (p.b[0] - p.a[0]) * k, p.a[1] + (p.b[1] - p.a[1]) * k, p.a[2] + (p.b[2] - p.a[2]) * k];
        const [sx, sy, z] = project(q);
        const depth = clamp((1.6 - z) / 3.2);
        buckets[Math.min(3, Math.floor(depth * 4))].push(sx, sy, p.orbit ? 1.2 : 1.5);
      }
      const tones = [.13, .24, .38, .58];
      buckets.forEach((b, i) => {
        ctx.fillStyle = `rgba(${this.ink},${tones[i] * this.fade})`;
        for (let j = 0; j < b.length; j += 3) ctx.fillRect(b[j] - b[j + 2] / 2, b[j + 1] - b[j + 2] / 2, b[j + 2], b[j + 2]);
      });

      // Companions: a person and an AI, travelling the form
      const at = (tt) => {
        const p = 2, q = 5, R = 1, r = .42, kk = R + r * Math.cos(q * tt);
        const A = [kk * Math.cos(p * tt), kk * Math.sin(p * tt), r * Math.sin(q * tt)];
        const B = [Math.cos(p * tt), Math.sin(p * tt), 0];
        return project(A.map((v, i) => v + (B[i] - v) * m));
      };
      const s = this.reduced ? 0 : this.t * .045;
      const P = at(s), Q = at(s + .95);
      if (m > .02) {
        ctx.save();
        ctx.setLineDash([2, 5]); ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(${this.ink},${.38 * m * this.fade})`;
        ctx.beginPath(); ctx.moveTo(P[0], P[1]); ctx.lineTo(Q[0], Q[1]); ctx.stroke();
        ctx.restore();
      }
      const dot = ([x, y], color) => {
        ctx.globalAlpha = .16 * this.fade; ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.fill();
        ctx.globalAlpha = this.fade;
        ctx.beginPath(); ctx.arc(x, y, 3.4, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
      };
      dot(P, this.human); dot(Q, this.ai);
    }
  }
  customElements.define('system-field', SystemField);
})();

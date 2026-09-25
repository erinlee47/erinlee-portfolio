// Flowing noise-warped gradient (in the spirit of ruucm/shadergradient), plain WebGL.
(() => {
  if (customElements.get('shader-gradient')) return;
  const VS = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;
  const FS = `precision highp float;
uniform vec2 r;uniform float t;uniform float amt;
uniform vec3 c0;uniform vec3 c1;uniform vec3 c2;uniform vec3 c3;
vec3 m289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 m289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 perm(vec4 x){return m289(((x*34.)+1.)*x);}
vec4 tis(vec4 r){return 1.79284291400159-.85373472095314*r;}
float sn(vec3 v){const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;
vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
i=m289(i);vec4 p=perm(perm(perm(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
vec4 nm=tis(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=nm.x;p1*=nm.y;p2*=nm.z;p3*=nm.w;
vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}
float hs(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){vec2 uv=gl_FragCoord.xy/r;vec2 p=uv*vec2(r.x/r.y,1.)*1.1;
float n1=sn(vec3(p*.8,t*.05));
float n2=sn(vec3(p*1.4+n1*.9,t*.07+10.));
float n3=sn(vec3(p*.6-n2*.6,t*.04+30.));
vec3 col=mix(c0,c1,smoothstep(-.5,.8,n1));
col=mix(col,c2,smoothstep(-.3,.9,n2)*.85);
col=mix(col,c3,smoothstep(.25,1.,n3)*amt);
col=mix(col,c0,smoothstep(.35,0.,uv.y)*.6);
col+=(hs(gl_FragCoord.xy+fract(t))-.5)*.03;
gl_FragColor=vec4(col,1.);}`;
  const hex = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255); };
  class ShaderGradient extends HTMLElement {
    static get observedAttributes() { return ['speed', 'intensity', 'colors']; }
    connectedCallback() {
      this.style.cssText += ';display:block;position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:hidden;';
      const c = this.canvas = document.createElement('canvas');
      c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
      this.appendChild(c);
      const gl = this.gl = c.getContext('webgl', { antialias: false, premultipliedAlpha: false });
      if (!gl) return;
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
      const pr = this.pr = gl.createProgram();
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(pr); gl.useProgram(pr);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      this.u = n => gl.getUniformLocation(pr, n);
      this.applyColors();
      this.t = 0; this.last = performance.now(); this.visible = true;
      this.reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(this);
      this.io = new IntersectionObserver(e => { this.visible = e[0].isIntersecting; }); this.io.observe(this);
      this.resize();
      const loop = now => {
        const dt = Math.min(now - this.last, 50); this.last = now;
        if (this.visible) { if (!this.reduced) this.t += dt / 1000 * this.speed; this.draw(); }
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    }
    disconnectedCallback() { cancelAnimationFrame(this.raf); this.ro && this.ro.disconnect(); this.io && this.io.disconnect(); if (this.canvas) this.canvas.remove(); }
    attributeChangedCallback(n) { if (n === 'colors') this.applyColors(); }
    get speed() { const v = parseFloat(this.getAttribute('speed')); return isNaN(v) ? 1 : v; }
    get intensity() { const v = parseFloat(this.getAttribute('intensity')); return isNaN(v) ? .55 : v; }
    applyColors() {
      if (!this.gl) return;
      const list = (this.getAttribute('colors') || '#EAE5E9,#E6DCE7,#D2D0E6,#C3C7E3').split(',');
      ['c0', 'c1', 'c2', 'c3'].forEach((k, i) => this.gl.uniform3fv(this.u(k), hex(list[i] || list[0])));
    }
    resize() {
      const d = Math.min(window.devicePixelRatio || 1, 1.5), w = this.clientWidth, h = this.clientHeight;
      if (!w || !h) return;
      this.canvas.width = Math.round(w * d); this.canvas.height = Math.round(h * d);
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    draw() {
      const gl = this.gl;
      gl.uniform2f(this.u('r'), this.canvas.width, this.canvas.height);
      gl.uniform1f(this.u('t'), this.t + 12);
      gl.uniform1f(this.u('amt'), this.intensity);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }
  customElements.define('shader-gradient', ShaderGradient);
})();

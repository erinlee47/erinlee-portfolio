// Case study scroll reveal: headings, copy and media fade and rise 12px as they enter view.
(() => {
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const els = Array.from(document.querySelectorAll('main h1, main p, main img, main video'));
  const hidden = new Set(els);
  const ease = 'cubic-bezier(.22,.61,.36,1)';
  const show = el => {
    if (!hidden.delete(el)) return;
    el.style.opacity = '1';
    el.style.transform = 'none';
    el.style.willChange = 'auto';
  };
  els.forEach((el, i) => {
    const d = (i % 3) * 70;
    el.style.opacity = '0';
    el.style.transform = 'translateY(12px)';
    el.style.willChange = 'opacity, transform';
    el.style.transition = `opacity .7s ${ease} ${d}ms, transform .7s ${ease} ${d}ms`;
  });
  const sweep = () => {
    const h = window.innerHeight;
    hidden.forEach(el => { if (el.getBoundingClientRect().top < h * 0.94) show(el); });
    if (!hidden.size) {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', sweep);
    }
  };
  let queued = false;
  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; sweep(); });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', sweep);
  requestAnimationFrame(sweep);
  setTimeout(() => els.forEach(show), 4000);
})();

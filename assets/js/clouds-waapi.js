// Clouds WAAPI animation — consistent speed across devices (no mobile slowdown)
(function(){
  if (!('animate' in Element.prototype)) return;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  // Helper readers
  function readVar(cs, name, fallback=''){ return (cs.getPropertyValue(name) || '').trim() || fallback; }
  function parseTime(val){
    const v = String(val || '').trim(); if (!v) return 0;
    const ms = v.match(/^(-?\d+\.?\d*)ms$/i); if (ms) return parseFloat(ms[1]);
    const s  = v.match(/^(-?\d+\.?\d*)s$/i);  if (s)  return parseFloat(s[1]) * 1000;
    const n = parseFloat(v); return Number.isFinite(n) ? n*1000 : 0;
  }
  function parseNumber(val){ const n = parseFloat(val); return Number.isFinite(n) ? n : 0; }

  // Measure actual pixel distance between fromX and toX transforms for the cloud element,
  // regardless of whether values are in px, vw, svw, etc.
  function measureDistancePx(el, fromX, toX){
    const prev = el.style.transform;
    try{
      el.style.transform = `translateX(${fromX})`;
      const x1 = el.getBoundingClientRect().left;
      el.style.transform = `translateX(${toX})`;
      const x2 = el.getBoundingClientRect().left;
      return Math.abs(x2 - x1);
    } finally {
      el.style.transform = prev || '';
    }
  }

  const DEFAULT_SPEED_PX_S = 90; // fallback speed if none specified

  document.querySelectorAll('.cloud').forEach(cloud => {
    const cs = getComputedStyle(cloud);

    const fromX = readVar(cs, '--from', '-20vw');
    const toX   = readVar(cs, '--to',   '120vw');
    const delayMs  = parseTime(readVar(cs, '--delay', '0s'));

    // Duration precedence: --duration > --speed > default speed
    let durationMs = parseTime(readVar(cs, '--duration', ''));
    if (!durationMs) {
      const speed = parseNumber(readVar(cs, '--speed', '')) || DEFAULT_SPEED_PX_S; // px/s
      const distancePx = measureDistancePx(cloud, fromX, toX);
      durationMs = Math.max(1000, (distancePx / speed) * 1000);
    }

    // Small random jitter (±8%) to avoid bunching; no viewport-based slowdowns
    const jitter = 1 + (Math.random() - 0.5) * 0.16;
    durationMs = Math.max(1000, durationMs * jitter);

    const anim = cloud.animate(
      [{ transform: `translateX(${fromX})`, opacity: 1 },
       { transform: `translateX(${toX})`,   opacity: 1 }],
      { duration: durationMs, delay: delayMs, iterations: Infinity }
    );

    // Randomize starting phase
    try { anim.currentTime = Math.random() * durationMs; } catch {}
  });
})();
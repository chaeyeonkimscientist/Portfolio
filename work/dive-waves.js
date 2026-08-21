(function () {
  const c = document.getElementById('hero-wave');
  if (!c || !c.getContext) return;
  const x = c.getContext('2d');
  const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const BONE = [239, 231, 239];
  let W, H, dpr, ph = 0;

  function rs() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = c.clientWidth || innerWidth;
    H = c.clientHeight || innerHeight;
    c.width = W * dpr;
    c.height = H * dpr;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  rs();
  addEventListener('resize', rs);

  const ar = 0.16;
  function fr() {
    ph += 0.012;
    x.clearRect(0, 0, W, H);
    const ch = 7, amp = 22 + ar * 14, fq = 0.004 + ar * 0.008, la = 0.3;
    for (let k = 0; k < ch; k++) {
      const yb = H / (ch + 1) * (k + 1), of = k * 1.7, ca = amp * (0.55 + (k % 3) * 0.28);
      x.beginPath();
      for (let px = 0; px <= W; px += 6) {
        const nz = Math.sin(px * fq + ph + of) + 0.5 * Math.sin(px * fq * 2.3 + ph * 1.4 + of);
        const yy = yb + nz * ca;
        px === 0 ? x.moveTo(px, yy) : x.lineTo(px, yy);
      }
      x.strokeStyle = 'rgba(' + BONE[0] + ',' + BONE[1] + ',' + BONE[2] + ',' + (la * (0.5 + k / ch * 0.6)) + ')';
      x.lineWidth = 2.2;
      x.stroke();
    }
    if (!rm) requestAnimationFrame(fr);
  }
  fr();
})();

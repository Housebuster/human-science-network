// Homepage hero map: travels eastward (map moves left) between region stops, looping seamlessly.
// Constant ~15px/s with soft ease-in/out; after each arrival it rests 30s. Page loads still; first move after 3s.
(() => {
  const pan = document.querySelector(".hn-pan");
  if (!pan || matchMedia("(prefers-reduced-motion: reduce)").matches || innerWidth <= 640) return;
  const WM = +pan.dataset.wm, STOPS = pan.dataset.stops.split(",").map(Number);
  const V = 15, RAMP = 2.5; // px/s, seconds of ease at each end
  let p = STOPS[0], i = 0, timer = null, raf = 0, move = null;
  const set = (x) => { pan.style.transform = `translateX(${-x}px)`; };
  // Distance covered after t seconds for a move of length d with cruise speed V and smooth ramps.
  const plan = (d) => {
    let ramp = RAMP, a = V / RAMP; // accel
    if (a * ramp * ramp > d) ramp = Math.sqrt(d / a); // short move: never reaches cruise
    const vmax = a * ramp, dr = 0.5 * a * ramp * ramp, cruise = (d - 2 * dr) / vmax;
    const T = 2 * ramp + cruise;
    const at = (t) => {
      if (t <= 0) return 0; if (t >= T) return d;
      if (t < ramp) return 0.5 * a * t * t;
      if (t < ramp + cruise) return dr + vmax * (t - ramp);
      const u = T - t; return d - 0.5 * a * u * u;
    };
    return { T, at };
  };
  const step = (now) => {
    const t = (now - move.t0) / 1000;
    set(move.from + move.plan.at(t));
    if (t < move.plan.T) { raf = requestAnimationFrame(step); return; }
    p = (move.from + move.d) % WM; set(p); move = null; schedule(30000);
  };
  const start = () => {
    const next = STOPS[(i + 1) % STOPS.length];
    const d = ((next - p) % WM + WM) % WM || WM;
    i = (i + 1) % STOPS.length;
    move = { from: p, d, plan: plan(d), t0: performance.now() };
    raf = requestAnimationFrame(step);
  };
  const schedule = (ms) => { clearTimeout(timer); timer = setTimeout(start, ms); };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearTimeout(timer); cancelAnimationFrame(raf);
      if (move) { const t = (performance.now() - move.t0) / 1000; p = move.from + move.plan.at(t); move.hiddenAt = p; }
    } else if (move) { // resume remaining distance
      const done = move.hiddenAt - move.from; move = { from: move.hiddenAt, d: move.d - done, plan: plan(move.d - done), t0: performance.now() };
      raf = requestAnimationFrame(step);
    } else schedule(3000);
  });
  schedule(3000);
})();

// Homepage hero map: after a short delay, slowly pans between regions, one move every 30s.
// Offsets are in SVG user units (viewBox 1440 wide); see .hn-pan transition in style.css.
(() => {
  const pan = document.querySelector(".hn-pan");
  if (!pan || matchMedia("(prefers-reduced-motion: reduce)").matches || innerWidth <= 640) return;
  const STOPS = [330, 120, -230]; // Americas, Europe, Asia
  let i = 0, timer = null;
  const move = () => { pan.style.transform = `translateX(${STOPS[i]}px)`; i = (i + 1) % STOPS.length; };
  const start = (delay) => { clearTimeout(timer); timer = setTimeout(function tick() { move(); timer = setTimeout(tick, 30000); }, delay); };
  document.addEventListener("visibilitychange", () => document.hidden ? clearTimeout(timer) : start(3000));
  start(3000);
})();

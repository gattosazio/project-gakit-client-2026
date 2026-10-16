interface WeatherPlaybackOptions {
  paused: () => boolean;
  reducedMotion: (reduced: boolean) => void;
  draw: (deltaSeconds: number) => void;
}

/** One uncapped RAF chain, suspended outside the viewport or behind a modal. */
export function weatherPlayback(element: HTMLElement, options: WeatherPlaybackOptions) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  let inView = typeof IntersectionObserver === 'undefined';
  let hasSize = false;
  let disposed = false;
  let frame: number | null = null;
  let lastTime = 0;
  const visible = () => !disposed && inView && hasSize && document.visibilityState === 'visible' && !options.paused();
  const stop = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  };
  const tick = (time: number) => {
    frame = null;
    if (!visible() || media.matches) return;
    options.draw(Math.min(Math.max(0, (time - lastTime) / 1000), 0.08));
    lastTime = time;
    if (visible() && !media.matches) frame = requestAnimationFrame(tick);
  };
  const refresh = () => {
    if (disposed) return;
    const rect = element.getBoundingClientRect();
    hasSize = rect.width > 0 && rect.height > 0;
    options.reducedMotion(media.matches);
    if (!visible()) stop();
    else if (media.matches) { stop(); options.draw(0); }
    else if (frame === null) { lastTime = performance.now(); frame = requestAnimationFrame(tick); }
  };
  const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
    const entry = entries.find(value => value.target === element);
    if (entry) inView = entry.isIntersecting && entry.intersectionRatio > 0;
    refresh();
  });
  observer?.observe(element);
  document.addEventListener('visibilitychange', refresh);
  media.addEventListener('change', refresh);
  refresh();
  return {
    refresh,
    dispose() {
      disposed = true;
      stop();
      observer?.disconnect();
      document.removeEventListener('visibilitychange', refresh);
      media.removeEventListener('change', refresh);
    },
  };
}

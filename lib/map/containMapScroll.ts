/** Keep wheel gestures over the map from scrolling its surrounding page. */
export function containMapScroll(viewport: HTMLElement): () => void {
  const handleWheel = (event: WheelEvent) => {
    if (event.defaultPrevented) return;
    // Let a nested panel consume the gesture while it has room to scroll.
    // At its edge, contain the remaining gesture instead of scrolling the page.
    if (!event.ctrlKey) {
      let element = event.target instanceof Element ? event.target : null;
      while (element && element !== viewport) {
        if (element instanceof HTMLElement) {
          const style = getComputedStyle(element);
          const dy = event.shiftKey ? 0 : event.deltaY;
          const dx = event.deltaX || (event.shiftKey ? event.deltaY : 0);
          const scrollsY = /^(auto|scroll)$/.test(style.overflowY) && element.scrollHeight > element.clientHeight;
          const scrollsX = /^(auto|scroll)$/.test(style.overflowX) && element.scrollWidth > element.clientWidth;
          const canScrollY = scrollsY && (dy < 0 ? element.scrollTop > 0 : dy > 0 && element.scrollTop + element.clientHeight < element.scrollHeight - 1);
          const canScrollX = scrollsX && (dx < 0 ? element.scrollLeft > 0 : dx > 0 && element.scrollLeft + element.clientWidth < element.scrollWidth - 1);
          if (canScrollY || canScrollX) return;
        }
        element = element.parentElement;
      }
    }
    // MapLibre still handles the original canvas event. Prevent only the
    // browser's page-scroll/page-zoom default, without stopping propagation.
    event.preventDefault();
  };
  viewport.addEventListener('wheel', handleWheel, { passive: false });
  return () => viewport.removeEventListener('wheel', handleWheel);
}

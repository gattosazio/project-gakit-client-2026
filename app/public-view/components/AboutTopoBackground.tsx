/** Decorative watershed and floodplain contours, rendered as a static SVG. */
export function AboutTopoBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 select-none bg-[url('/images/backgrounds/about-topography.svg')] bg-cover bg-center"
    />
  );
}

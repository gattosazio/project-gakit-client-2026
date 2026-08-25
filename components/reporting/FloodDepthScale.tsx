import { MAX_DEPTH_CM, SCENE_CM, criticalityStripRgb } from '@/lib/reports/depthReferences';

const STRIP_CM = 5;
const STRIP_COUNT = MAX_DEPTH_CM / STRIP_CM;
const TICK_STEP_CM = 50;

/** Position within the full scene (0..SCENE_CM); the tick column spans the whole scene. */
const pctOf = (cm: number) => Math.min(Math.max(cm / SCENE_CM, 0), 1) * 100;
/** Position within the strips column (0..MAX_DEPTH_CM). */
const pctOfScale = (cm: number) => Math.min(Math.max(cm / MAX_DEPTH_CM, 0), 1) * 100;
const stripTopCm = (index: number) => (index + 1) * STRIP_CM;
const stripIndexOf = (cm: number) => Math.round(cm / STRIP_CM) - 1;

/**
 * Vertical flood-depth scale shown beside the reference illustration:
 * centimeter tick labels on the left, and the strip slider on the right. The
 * column holds one strip per 5 cm — no gaps, so every strip boundary lands
 * exactly on its centimeter position — and strip colors encode criticality:
 * green while shallow, amber through knee/waist, red once head-deep (the
 * server's "critical" threshold). It doubles as a slider: press and drag
 * along the column and the selection follows the pointer, hovering previews
 * that level on the illustration, clicking selects a strip, and arrow keys
 * step in 5 cm increments. The selected strip widens (animated, so it
 * grows/shrinks as you slide) to mark the choice, and hovered strips nudge
 * wider in sympathy.
 */
export function FloodDepthScale({
  value,
  preview,
  onSelect,
  onPreview,
}: {
  value: number | null;
  preview: number | null;
  onSelect: (cm: number) => void;
  onPreview: (cm: number | null) => void;
}) {
  const previewStrip = preview != null ? stripIndexOf(preview) : null;
  const selectedStrip = value != null ? stripIndexOf(value) : null;
  const tooltipPct = preview != null ? pctOfScale(preview) : 50;
  /** Custom readings beyond the scale's top get a "250+" tick instead. */
  const overflow = value != null && value > MAX_DEPTH_CM;

  const cmFromPointer = (element: HTMLElement, clientY: number) => {
    const rect = element.getBoundingClientRect();
    const raw = ((rect.bottom - clientY) / rect.height) * MAX_DEPTH_CM;
    return Math.min(MAX_DEPTH_CM, Math.max(STRIP_CM, Math.ceil(raw / STRIP_CM) * STRIP_CM));
  };

  const step = (delta: number) => {
    const base = value ?? STRIP_CM;
    const next = Math.min(MAX_DEPTH_CM, Math.max(STRIP_CM, base + delta));
    onSelect(next);
    onPreview(next);
  };

  /** Same hue, much darker, so the chosen strip stands out from its band. */
  const stripBackground = (index: number, isSelected: boolean) => {
    const [r, g, b] = criticalityStripRgb(stripTopCm(index));
    const k = isSelected ? 0.55 : 1;
    return `rgb(${Math.round(r * k)} ${Math.round(g * k)} ${Math.round(b * k)})`;
  };

  return (
    <div className="flex shrink-0 items-stretch gap-1 pl-1" aria-label="Flood depth selector">
      <div className="relative w-4">
        <span
          aria-hidden
          className="absolute inset-x-0 text-center text-[9px] font-medium leading-none text-slate-400"
          style={{ bottom: `calc(${pctOf(MAX_DEPTH_CM)}% + 3px)` }}
        >
          cm
        </span>
        <div
          role="group"
          aria-label="Water depth strips"
          className="absolute inset-x-0 bottom-0 flex touch-none flex-col-reverse"
          style={{ height: `${pctOf(MAX_DEPTH_CM)}%` }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            const cm = cmFromPointer(event.currentTarget, event.clientY);
            onPreview(cm);
            onSelect(cm);
          }}
          onPointerMove={(event) => {
            const cm = cmFromPointer(event.currentTarget, event.clientY);
            onPreview(cm);
            if (event.buttons & 1) onSelect(cm);
          }}
          onPointerLeave={(event) => {
            if (event.buttons & 1) return;
            onPreview(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              step(STRIP_CM);
            } else if (event.key === 'ArrowDown') {
              event.preventDefault();
              step(-STRIP_CM);
            }
          }}
        >
          {preview != null && (
            <div
              className={`pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm ${
                tooltipPct > 88 ? 'translate-y-1' : '-translate-y-1/2'
              }`}
              style={{
                bottom:
                  tooltipPct > 88 ? `calc(${tooltipPct}% - 26px)` : `calc(${tooltipPct}% + 10px)`,
              }}
            >
              ~{preview} cm
            </div>
          )}

          {Array.from({ length: STRIP_COUNT }, (_, index) => {
            const isHovered = previewStrip === index;
            const isSelected = selectedStrip === index;
            const emphasized = isSelected || isHovered;
            return (
              <button
                key={index}
                type="button"
                onMouseEnter={() => onPreview(stripTopCm(index))}
                onClick={() => onSelect(stripTopCm(index))}
                aria-label={`About ${stripTopCm(index)} centimeters deep`}
                aria-pressed={isSelected}
                className={`flex-1 cursor-pointer rounded-[2px] border-b border-white/60 transition-[transform] duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon ${
                  emphasized ? 'relative z-10' : ''
                } ${
                  isSelected
                    ? 'scale-x-[1.45]'
                    : isHovered
                      ? 'scale-x-[1.2]'
                      : ''
                }`}
                style={{ backgroundColor: stripBackground(index, isSelected) }}
              />
            );
           })}
        </div>
      </div>

      <div
        aria-hidden
        className="relative w-6 text-left text-[9px] font-medium leading-none text-slate-400"
      >
        {Array.from({ length: MAX_DEPTH_CM / TICK_STEP_CM + 1 }, (_, index) => {
          const cm = index * TICK_STEP_CM;
          const isMax = cm === MAX_DEPTH_CM;
          return (
            <span
              key={cm}
              className={`absolute left-0 translate-y-1/2 ${isMax ? 'font-semibold text-red-700' : ''}`}
              style={{ bottom: `${pctOf(cm)}%` }}
            >
              {isMax ? `${cm}${overflow ? '+' : ''}` : cm}
            </span>
          );
        })}
      </div>
    </div>
  );
}

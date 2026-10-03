'use client';

import { useCallback, useRef, useState } from 'react';

function formatHour(hour: number): string {
  const suffix = hour < 12 ? 'AM' : 'PM';
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelveHour}${suffix}`;
}

interface RainStripProps {
  /** Hourly precipitation (mm). */
  hours?: number[];
  /** Hourly precipitation probability (0-100%). */
  probabilities?: number[];
}

/**
 * Miniature 24-hour precipitation strip. When precipitation probabilities
 * are available, renders Google-style probability bars (0-100% scale).
 * Features expanded full-height touch targets and pointer/scrubbing support
 * for mobile and desktop.
 */
export function RainStrip({ hours, probabilities }: RainStripProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const hasProbabilities = Array.isArray(probabilities) && probabilities.length === 24;
  const hasHours = Array.isArray(hours) && hours.length > 0;

  if (!hasProbabilities && !hasHours) return null;

  if (hasProbabilities) {
    const maxProb = Math.max(...probabilities);
    const maxMm = hasHours ? Math.max(...hours) : 0;
    if (maxProb <= 0 && maxMm <= 0) return null;
  } else if (hasHours) {
    const max = Math.max(...hours);
    if (max <= 0) return null;
  }

  const seriesLength = hasProbabilities ? probabilities.length : (hours?.length ?? 24);

  // Keep the floating label inside the strip's horizontal bounds.
  const rawLeft = hovered !== null ? ((hovered + 0.5) / seriesLength) * 100 : 50;
  const labelLeft = Math.min(Math.max(rawLeft, 12), 88);

  const renderHoverLabel = () => {
    if (hovered === null) return null;
    const timeLabel = formatHour(hovered);
    if (hasProbabilities) {
      const prob = probabilities[hovered] ?? 0;
      return `${timeLabel} · ${prob}% chance`;
    }
    const mm = hours?.[hovered] ?? 0;
    return `${timeLabel} · ${mm.toFixed(1)}mm`;
  };

  const updateHoverFromClientX = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width - 1));
      const index = Math.floor((x / rect.width) * seriesLength);
      setHovered(Math.max(0, Math.min(index, seriesLength - 1)));
    },
    [seriesLength]
  );

  const hoursList = Array.from({ length: seriesLength }, (_, i) => i);
  const maxMm = hasHours ? Math.max(...hours) : 0;

  return (
    <div className="relative pt-5" onMouseLeave={() => setHovered(null)}>
      {hovered !== null && (
        <span
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm"
          style={{ left: `${labelLeft}%` }}
        >
          {renderHoverLabel()}
        </span>
      )}
      {/* Interactive track with generous height for easy touch & hover */}
      <div
        ref={trackRef}
        className="flex h-6 items-end gap-[2px] cursor-pointer touch-none select-none py-0.5"
        role="img"
        aria-label="Hourly rain probability distribution"
        onPointerDown={(e) => {
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {}
          updateHoverFromClientX(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons > 0 || e.pointerType === 'mouse') {
            updateHoverFromClientX(e.clientX);
          }
        }}
        onPointerUp={(e) => {
          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch {}
        }}
      >
        {hoursList.map((hour) => {
          const isHovered = hovered === hour;
          const dimmed = hovered !== null && !isHovered;

          let heightPct: number;
          let opacity: number;
          let colorClass: string;

          if (hasProbabilities) {
            const prob = probabilities[hour] ?? 0;
            const intensity = prob / 100;
            heightPct = prob > 0 ? Math.round(16 + intensity * 84) : 8;
            opacity = isHovered ? 1 : dimmed ? 0.25 : prob > 0 ? 0.45 + intensity * 0.55 : 0.2;
            colorClass = isHovered ? 'bg-sky-600' : prob >= 50 ? 'bg-sky-500' : 'bg-sky-400';
          } else {
            const mm = hours?.[hour] ?? 0;
            const intensity = maxMm > 0 ? mm / maxMm : 0;
            heightPct = Math.round(((mm > 0 ? 20 : 8) + intensity * 80) * (isHovered ? 1.15 : 1));
            opacity = isHovered ? 1 : dimmed ? 0.25 : mm > 0 ? 0.45 + intensity * 0.55 : 0.2;
            colorClass = isHovered ? 'bg-sky-600' : 'bg-sky-500';
          }

          return (
            <div
              key={hour}
              className="relative flex h-full flex-1 items-end"
              onMouseEnter={() => setHovered(hour)}
            >
              <span
                className={`w-full rounded-[1px] transition-all duration-150 ${colorClass}`}
                style={{
                  height: `${Math.min(heightPct, 100)}%`,
                  opacity,
                }}
              />
            </div>
          );
        })}
      </div>
      {/* Quarter-day ticks; invisible spacers keep each label aligned to its bar. */}
      <div className="mt-0.5 flex gap-[2px]" aria-hidden>
        {hoursList.map((hour) => {
          const showTick = hour % 6 === 0;
          return (
            <span
              key={hour}
              className={`min-w-[2px] flex-1 text-center text-[9px] font-medium leading-none ${
                hovered === hour
                  ? 'text-slate-600'
                  : showTick
                    ? 'text-slate-400'
                    : 'invisible'
              }`}
            >
              {formatHour(hour)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

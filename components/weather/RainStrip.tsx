'use client';

import { useCallback, useRef, useState } from 'react';
import { hourlyRainSeries, rainIntervalLabel } from '@/lib/weather/hourlyOutlook';

function formatHour(hour: number): string {
  const suffix = hour < 12 ? 'AM' : 'PM';
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelveHour}${suffix}`;
}

interface RainStripProps {
  compact?: boolean;
  /** Hourly precipitation (mm). */
  hours?: (number | null)[];
  /** Hourly precipitation probability (0-100%). */
  probabilities?: (number | null)[];
}

/**
 * Miniature 24-hour precipitation strip. When precipitation probabilities
 * are available, renders Google-style probability bars (0-100% scale).
 * Features expanded full-height touch targets and pointer/scrubbing support
 * for mobile and desktop.
 */
export function RainStrip({ hours: rawHours, probabilities: rawProbabilities, compact = false }: RainStripProps) {
  const hours = hourlyRainSeries({ hours: rawHours }, 'amount');
  const probabilities = hourlyRainSeries({ hourlyProbabilities: rawProbabilities }, 'chance');
  const [hovered, setHovered] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const hasProbabilities = probabilities !== null;
  const hasHours = hours !== null;
  const seriesLength = 24;

  // Hooks must run before any early return.
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

  if (!hasProbabilities && !hasHours) return null;

  // Keep the floating label inside the strip's horizontal bounds.
  const labelLeft = 50;

  const renderHoverLabel = () => {
    if (hovered === null) return null;
    const timeLabel = rainIntervalLabel(hovered);
    if (hasProbabilities) {
      const prob = probabilities[hovered];
      if (prob == null) return `${timeLabel} · Unavailable`;
      return `${timeLabel} · ${prob}% chance`;
    }
    const mm = hours?.[hovered];
    if (mm == null) return `${timeLabel} · Unavailable`;
    return `${timeLabel} · ${mm.toFixed(1)}mm`;
  };

  const hoursList = Array.from({ length: seriesLength }, (_, i) => i);
  const maxMm = hasHours ? Math.max(...hours.map(value => value ?? 0)) : 0;

  return (
    <div className={`relative ${compact ? 'mt-1' : 'pt-4'}`} onMouseLeave={() => setHovered(null)}>
      {hovered !== null && (
        <span
          className={`pointer-events-none absolute ${compact ? 'bottom-full mb-1' : 'top-0'} z-10 max-w-full -translate-x-1/2 rounded-md bg-slate-800 px-1.5 py-0.5 text-center text-[10px] font-semibold text-white shadow-sm`}
          style={{ left: `${labelLeft}%` }}
        >
          {renderHoverLabel()}
        </span>
      )}
      {/* Interactive track with generous height for easy touch & hover */}
      <div
        ref={trackRef}
        className={`flex ${compact ? 'h-8' : 'h-6'} items-end gap-[2px] cursor-pointer touch-none select-none py-0.5`}
        role="img"
        aria-label={hasProbabilities ? 'Rain probability for one-hour intervals ending at the labelled Philippine times' : 'Rainfall in millimetres for one-hour intervals ending at the labelled Philippine times'}
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
          const value = hasProbabilities ? probabilities[hour] : hours?.[hour];
          if (value == null) return <div key={hour} className="h-full flex-1" aria-hidden="true" />;
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
      <div className={compact ? 'mt-1 grid grid-cols-4' : 'mt-0.5 flex gap-[2px]'} aria-hidden>
        {hoursList.map((hour) => {
          const showTick = hour % 6 === 0;
          if (compact && !showTick) return null;
          return (
            <span
              key={hour}
              className={`${compact ? 'text-left' : 'min-w-[2px] flex-1 text-center'} text-[9px] font-medium leading-none ${
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

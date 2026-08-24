'use client';

import { useState } from 'react';

function formatHour(hour: number): string {
  const suffix = hour < 12 ? 'AM' : 'PM';
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelveHour}${suffix}`;
}

/**
 * Miniature hourly-precipitation strip: one slim bar per hour of the local
 * day, scaled to the day's wettest hour. Hovering a bar grows it and shows
 * the hour + amount in a floating label. Hidden entirely when no series is
 * available or nothing falls at all — an empty flat strip is just noise.
 */
export function RainStrip({ hours }: { hours?: number[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (!hours || hours.length === 0) return null;
  const max = Math.max(...hours);
  if (max <= 0) return null;

  // Keep the floating label inside the strip's horizontal bounds.
  const rawLeft = hovered !== null ? ((hovered + 0.5) / hours.length) * 100 : 50;
  const labelLeft = Math.min(Math.max(rawLeft, 12), 88);

  return (
    <div className="relative pt-5" onMouseLeave={() => setHovered(null)}>
      {hovered !== null && (
        <span
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm"
          style={{ left: `${labelLeft}%` }}
        >
          {formatHour(hovered)} · {hours[hovered].toFixed(1)}mm
        </span>
      )}
      <div
        className="flex h-4 items-end gap-[2px]"
        role="img"
        aria-label="Hourly rain distribution"
      >
        {hours.map((mm, hour) => {
          const intensity = mm / max;
          const isHovered = hovered === hour;
          const dimmed = hovered !== null && !isHovered;
          return (
            <span
              key={hour}
              onMouseEnter={() => setHovered(hour)}
              className={`min-w-[2px] flex-1 cursor-default rounded-[1px] transition-all duration-150 ${
                isHovered ? 'bg-sky-600' : 'bg-sky-500'
              }`}
              style={{
                height: `${Math.min(
                  Math.round(((mm > 0 ? 20 : 8) + intensity * 80) * (isHovered ? 1.15 : 1)),
                  118,
                )}%`,
                opacity: isHovered ? 1 : dimmed ? 0.25 : mm > 0 ? 0.45 + intensity * 0.55 : 0.2,
              }}
            />
          );
        })}
      </div>
      {/* Quarter-day ticks; invisible spacers keep each label aligned to its bar. */}
      <div className="mt-0.5 flex gap-[2px]" aria-hidden>
        {hours.map((_, hour) => {
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

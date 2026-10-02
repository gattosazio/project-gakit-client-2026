'use client';

import { useMemo } from 'react';
import { isDaytimeInManila } from '@/lib/weather/weatherCodes';

interface AmbientWeatherIconProps {
  conditionCode: number;
  observedAt?: string;
  isDark?: boolean;
  className?: string;
}

/**
 * Ambient micro-motion weather indicator for the operations dashboard.
 * Features optically balanced, duotone animated weather glyphs across all conditions.
 */
export function AmbientWeatherIcon({
  conditionCode,
  observedAt,
  isDark,
  className = '',
}: AmbientWeatherIconProps) {
  const isDaytime = useMemo(
    () => isDaytimeInManila(observedAt ?? new Date().toISOString()),
    [observedAt]
  );

  const darkMode = isDark ?? (!isDaytime || (conditionCode >= 95 && conditionCode <= 99));

  // Rain / Drizzle / Showers: WMO codes 51-67, 80-86
  const isRain =
    (conditionCode >= 51 && conditionCode <= 67) ||
    (conditionCode >= 80 && conditionCode <= 86);

  // Thunderstorms: WMO codes 95-99
  const isThunder = conditionCode >= 95 && conditionCode <= 99;

  // Overcast: WMO code 3 (also handles 45, 48 if reported)
  const isOvercast = conditionCode === 3 || conditionCode === 45 || conditionCode === 48;

  // Partly Cloudy: WMO codes 1, 2
  const isPartlyCloudy = conditionCode === 1 || conditionCode === 2;

  // Clear Sky: WMO code 0
  const isClear = conditionCode === 0;

  // ─── 1. Thunderstorm ────────────────────────────────────────────────────────
  if (isThunder) {
    return (
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-2xs ${
          darkMode
            ? 'bg-slate-800/90 text-amber-400 border border-slate-700/80 shadow-amber-500/10'
            : 'bg-amber-50 text-amber-600 border border-amber-200/70'
        } ${className}`}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973"
            className={darkMode ? 'text-slate-300' : 'text-slate-600'}
          />
          <path
            d="m13 12-3 5h4l-3 5"
            className="text-amber-400 animate-pulse [animation-duration:3s] motion-reduce:animate-none"
          />
        </svg>
      </div>
    );
  }

  // ─── 2. Rain / Showers / Drizzle ───────────────────────────────────────────
  if (isRain) {
    return (
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-2xs ${
          darkMode
            ? 'bg-slate-800/90 text-sky-300 border border-slate-700/80 shadow-sky-500/10'
            : 'bg-sky-50 text-sky-600 border border-sky-200/70'
        } ${className}`}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"
            className={darkMode ? 'text-sky-300' : 'text-sky-600'}
          />
          <path
            d="M8 15v5"
            className="text-sky-400 animate-pulse [animation-duration:2.4s] motion-reduce:animate-none"
          />
          <path
            d="M12 17v5"
            className="text-sky-300 animate-pulse [animation-duration:2.4s] [animation-delay:800ms] motion-reduce:animate-none"
          />
          <path
            d="M16 15v5"
            className="text-sky-400 animate-pulse [animation-duration:2.4s] [animation-delay:1600ms] motion-reduce:animate-none"
          />
        </svg>
      </div>
    );
  }

  // ─── 3. Overcast (Layered Double Cloud Deck) ───────────────────────────────
  if (isOvercast) {
    return (
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-2xs ${
          darkMode
            ? 'bg-slate-800/90 text-slate-200 border border-slate-700/80 shadow-slate-500/10'
            : 'bg-slate-100 text-slate-700 border border-slate-200/80'
        } ${className}`}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Background Cloud */}
          <path
            d="M16.5 13h1.8a3.5 3.5 0 0 0 .5-6.96 5 5 0 0 0-9.2-1.54A4 4 0 0 0 8 9"
            className={darkMode ? 'text-slate-400/80 stroke-[1.8]' : 'text-slate-400 stroke-[1.8]'}
          />
          {/* Foreground Cloud */}
          <path
            d="M14 20H6a5 5 0 1 1 4.9-6H14a3 3 0 0 1 0 6Z"
            className={`${
              darkMode
                ? 'text-slate-200 fill-slate-800/80'
                : 'text-slate-700 fill-white/80'
            } stroke-[2] animate-[pulse_6s_ease-in-out_infinite] motion-reduce:animate-none`}
          />
        </svg>
      </div>
    );
  }

  // ─── 4. Partly Cloudy (Day / Night Duotone) ────────────────────────────────
  if (isPartlyCloudy) {
    if (isDaytime) {
      return (
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-2xs ${
            darkMode
              ? 'bg-slate-800/90 text-amber-400 border border-slate-700/80 shadow-amber-500/10'
              : 'bg-amber-50/80 text-amber-600 border border-amber-200/70'
          } ${className}`}
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Sun Rays & Disc */}
            <path
              d="M12 2v2"
              className="text-amber-400 stroke-[2]"
            />
            <path
              d="m19.07 4.93-1.41 1.41"
              className="text-amber-400 stroke-[2]"
            />
            <path
              d="M20 12h2"
              className="text-amber-400 stroke-[2]"
            />
            <path
              d="m4.93 4.93 1.41 1.41"
              className="text-amber-400 stroke-[2]"
            />
            <path
              d="M15.947 12.65a4 4 0 0 0-5.925-4.128"
              className="text-amber-400 fill-amber-400/25 stroke-[2] animate-pulse [animation-duration:3.5s] motion-reduce:animate-none"
            />
            {/* Foreground Cloud */}
            <path
              d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"
              className={`${
                darkMode
                  ? 'text-slate-200 fill-slate-800/80'
                  : 'text-slate-700 fill-white/80'
              } stroke-[2] animate-[pulse_6s_ease-in-out_infinite] motion-reduce:animate-none`}
            />
          </svg>
        </div>
      );
    }

    return (
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-2xs ${
          darkMode
            ? 'bg-slate-800/90 text-indigo-300 border border-slate-700/80 shadow-indigo-500/10'
            : 'bg-indigo-50/80 text-indigo-400 border border-indigo-200/70'
        } ${className}`}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Crescent Moon */}
          <path
            d="M10.188 8.5A6 6 0 0 1 16 4a6 6 0 0 1 6 6 6 6 0 0 1-3 5.188"
            className="text-indigo-200 fill-indigo-300/20 stroke-[2] animate-pulse [animation-duration:4s] motion-reduce:animate-none"
          />
          {/* Foreground Cloud */}
          <path
            d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"
            className={`${
              darkMode
                ? 'text-slate-300 fill-slate-900/80'
                : 'text-slate-600 fill-white/80'
            } stroke-[2] animate-[pulse_6s_ease-in-out_infinite] motion-reduce:animate-none`}
          />
        </svg>
      </div>
    );
  }

  // ─── 5. Clear Sky (Day / Night Duotone) ────────────────────────────────────
  if (isClear) {
    if (isDaytime) {
      return (
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-2xs ${
            darkMode
              ? 'bg-slate-800/90 text-amber-400 border border-slate-700/80 shadow-amber-500/10'
              : 'bg-amber-50 text-amber-500 border border-amber-200/70'
          } ${className}`}
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Core Sun Disc with Warm Fill */}
            <circle
              cx="12"
              cy="12"
              r="4"
              className="text-amber-500 fill-amber-400/25 stroke-[2]"
            />
            {/* Rotating Corona Rays */}
            <g className="text-amber-400 stroke-[2] animate-[spin_25s_linear_infinite] origin-center motion-reduce:animate-none">
              <line x1="12" y1="2" x2="12" y2="4" />
              <line x1="12" y1="20" x2="12" y2="22" />
              <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
              <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
              <line x1="2" y1="12" x2="4" y2="12" />
              <line x1="20" y1="12" x2="22" y2="12" />
              <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
              <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
            </g>
          </svg>
        </div>
      );
    }

    return (
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-2xs ${
          darkMode
            ? 'bg-slate-800/90 text-indigo-200 border border-slate-700/80 shadow-indigo-500/10'
            : 'bg-indigo-50 text-indigo-500 border border-indigo-200/70'
        } ${className}`}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Crescent Moon */}
          <path
            d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"
            className={`${
              darkMode
                ? 'text-indigo-200 fill-indigo-300/20'
                : 'text-indigo-500 fill-indigo-100/60'
            } stroke-[2] animate-[pulse_6s_ease-in-out_infinite] motion-reduce:animate-none`}
          />
          {/* Companion Twinkling Star */}
          <path
            d="M19 3v4m-2-2h4"
            className="text-amber-300 stroke-[1.8] animate-pulse [animation-duration:2.4s] motion-reduce:animate-none"
          />
        </svg>
      </div>
    );
  }

  // ─── Fallback (Generic Cloud) ──────────────────────────────────────────────
  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-2xs ${
        darkMode
          ? 'bg-slate-800/90 text-slate-200 border border-slate-700/80'
          : 'bg-slate-100 text-slate-600 border border-slate-200/80'
      } ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"
          className={darkMode ? 'text-slate-200' : 'text-slate-600'}
        />
      </svg>
    </div>
  );
}

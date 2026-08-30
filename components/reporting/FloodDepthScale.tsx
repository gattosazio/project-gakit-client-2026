'use client';

import { useRef, useState } from 'react';
import {
  MAX_DEPTH_CM,
  SCENE_CM,
  depthCodeFromCm,
  fallbackCategoryLabel,
} from '@/lib/reports/depthReferences';

const STRIP_CM = 5;
const TICK_STEP_CM = 50;

/** Position within the full scene (0..SCENE_CM); tick labels span the whole scene. */
const pctOf = (cm: number) => Math.min(Math.max(cm / SCENE_CM, 0), 1) * 100;
/** Position within the track region (0..MAX_DEPTH_CM). */
const pctOfScale = (cm: number) => Math.min(Math.max(cm / MAX_DEPTH_CM, 0), 1) * 100;
const clampCm = (cm: number) => Math.min(MAX_DEPTH_CM, Math.max(STRIP_CM, cm));

/**
 * Vertical flood-depth slider beside the reference illustration. A thin
 * gradient track (emerald to amber to red) maps 0 to 250 cm; the thumb
 * sits at the active depth and the illustration previews drags. While
 * nothing is chosen the thumb rests near the bottom with a sonar pulse
 * so the touch point is obvious on load.
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
  const shownCm = preview ?? value;
  const overflowing = value != null && value > MAX_DEPTH_CM;
  const chipHigh = shownCm != null && pctOfScale(shownCm) > 88;

  const thumbBottomFor = (cm: number) =>
    `clamp(0px, calc(${pctOfScale(Math.min(cm, MAX_DEPTH_CM))}% - 10px), calc(100% - 20px))`;
  const thumbBottom = thumbBottomFor(shownCm ?? STRIP_CM);

  const thumbRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const lastEmittedCmRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const [pressed, setPressed] = useState(false);

  const applyThumb = (cm: number) => {
    if (thumbRef.current) thumbRef.current.style.bottom = thumbBottomFor(cm);
  };

  const cmFromPointer = (element: HTMLElement, clientY: number) => {
    const rect = element.getBoundingClientRect();
    const raw = ((rect.bottom - clientY) / rect.height) * MAX_DEPTH_CM;
    return clampCm(Math.ceil(raw / STRIP_CM) * STRIP_CM);
  };

  const selectCm = (nextCm: number) => onSelect(clampCm(nextCm));

  return (
    <div className="flex shrink-0 items-stretch gap-1 pl-1" aria-label="Flood depth selector">
      <div className="relative w-7">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 text-center text-[9px] font-medium leading-none text-slate-400"
          style={{ bottom: `calc(${pctOf(MAX_DEPTH_CM)}% + 3px)` }}
        >
          cm
        </span>

        <div className="absolute inset-x-0 bottom-0" style={{ height: `${pctOf(MAX_DEPTH_CM)}%` }}>
          <div
            aria-hidden
            className="absolute left-1/2 h-full w-3.5 -translate-x-1/2 rounded-full bg-slate-100 ring-1 ring-slate-200/80"
          >
            <div
              className="absolute left-1/2 top-0 h-full w-[6px] -translate-x-1/2 rounded-full"
              style={{
                backgroundImage:
                  'linear-gradient(to top, rgb(16 185 129) 0%, rgb(16 185 129) 11%, rgb(245 158 11) 11%, rgb(245 158 11) 58%, rgb(239 68 68) 58%, rgb(239 68 68) 100%)',
              }}
            />
          </div>
          {[TICK_STEP_CM, 100, 150, 200].map((cmValue) => (
            <span
              key={cmValue}
              aria-hidden
              className="absolute left-0 right-0 h-px bg-white/50"
              style={{ bottom: `${pctOfScale(cmValue)}%` }}
            />
          ))}

          <div
            role="slider"
            tabIndex={0}
            aria-label="Flood depth in centimeters"
            aria-valuemin={STRIP_CM}
            aria-valuemax={MAX_DEPTH_CM}
            aria-valuenow={shownCm ?? STRIP_CM}
            aria-orientation="vertical"
            className="absolute -inset-x-2 inset-y-0 cursor-pointer touch-none outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              draggingRef.current = true;
              setPressed(true);
              const next = cmFromPointer(event.currentTarget, event.clientY);
              lastEmittedCmRef.current = next;
              applyThumb(next);
              onPreview(next);
              onSelect(next);
            }}
            onPointerMove={(event) => {
              if (!draggingRef.current && !(event.buttons & 1)) return;
              const target = event.currentTarget;
              const clientY = event.clientY;
              if (rafIdRef.current !== null) return;
              rafIdRef.current = requestAnimationFrame(() => {
                rafIdRef.current = null;
                const next = cmFromPointer(target, clientY);
                if (next === lastEmittedCmRef.current) return;
                lastEmittedCmRef.current = next;
                applyThumb(next);
                onPreview(next);
                onSelect(next);
              });
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
              if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
              }
              draggingRef.current = false;
              lastEmittedCmRef.current = null;
              setPressed(false);
              onPreview(null);
            }}
            onPointerCancel={() => {
              if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
              }
              draggingRef.current = false;
              lastEmittedCmRef.current = null;
              setPressed(false);
            }}
            onPointerLeave={() => {
              if (draggingRef.current) return;
              onPreview(null);
            }}
            onKeyDown={(event) => {
              const base = shownCm ?? STRIP_CM;
              if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
                event.preventDefault();
                selectCm(base + STRIP_CM);
              } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
                event.preventDefault();
                selectCm(base - STRIP_CM);
              } else if (event.key === 'Home') {
                event.preventDefault();
                selectCm(STRIP_CM);
              } else if (event.key === 'End') {
                event.preventDefault();
                selectCm(MAX_DEPTH_CM);
              }
            }}
          />

          <div
            ref={thumbRef}
            aria-hidden
            className="pointer-events-none absolute left-1/2 h-5 w-8 -ml-4"
            style={{ bottom: thumbBottom }}
          >
            <div
              className={`flex h-full w-full items-center justify-center rounded-full bg-white ring-1 ring-slate-300 transition-all duration-150 ease-out ${
                pressed ? 'scale-95 shadow-sm' : 'scale-100 shadow-md'
              }`}
            >
              <div className="h-1 w-3 rounded-full bg-slate-300" />
            </div>

            {preview != null && (
              <div
                className={`pointer-events-auto absolute right-full mr-2 whitespace-nowrap rounded-lg bg-slate-800/95 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow ${
                  chipHigh ? 'top-1' : 'bottom-1'
                }`}
              >
                {preview} cm
                <span className="ml-1 font-normal text-white/70">
                  {fallbackCategoryLabel(depthCodeFromCm(Math.min(preview, MAX_DEPTH_CM)))}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        aria-hidden
        className="pointer-events-none relative w-6 text-left text-[9px] font-medium leading-none text-slate-400"
      >
        {Array.from({ length: MAX_DEPTH_CM / TICK_STEP_CM + 1 }, (_, index) => {
          const cmValue = index * TICK_STEP_CM;
          const isMax = cmValue === MAX_DEPTH_CM;
          return (
            <span
              key={cmValue}
              className={`absolute left-0 translate-y-1/2 ${isMax ? 'font-semibold text-red-700' : ''}`}
              style={{ bottom: `${pctOf(cmValue)}%` }}
            >
              {isMax ? `${cmValue}${overflowing ? '+' : ''}` : cmValue}
            </span>
          );
        })}
      </div>
    </div>
  );
}
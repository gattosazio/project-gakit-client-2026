'use client';

import { useRef, useState } from 'react';

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * Horizontal soft slider: a recessed track with a raised thumb that sinks
 * while pressed, and a flat fill for the current level. The thumb position
 * is set imperatively during a drag so it tracks the pointer in the same
 * frame, independent of any parent re-render.
 */
export function PillSlider({
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
  ariaLabel,
  accent = '#6366f1',
  className = '',
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  ariaLabel: string;
  accent?: string;
  className?: string;
}) {
  const span = max - min;
  const pctOf = (v: number) => clamp((v - min) / span, 0, 1) * 100;
  const thumbLeftFor = (v: number) =>
    `clamp(0px, calc(${pctOf(v)}% - 10px), calc(100% - 20px))`;

  const thumbRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [pressed, setPressed] = useState(false);

  const applyThumb = (v: number) => {
    if (thumbRef.current) thumbRef.current.style.left = thumbLeftFor(v);
  };

  const valueFromPointer = (element: HTMLElement, clientX: number) => {
    const rect = element.getBoundingClientRect();
    const raw = ((clientX - rect.left) / rect.width) * span + min;
    return clamp(Math.round(raw / step) * step, min, max);
  };

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-orientation="horizontal"
      className={`relative h-5 w-full cursor-pointer touch-none outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon ${className}`}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        draggingRef.current = true;
        setPressed(true);
        const next = valueFromPointer(event.currentTarget, event.clientX);
        applyThumb(next);
        onChange(next);
      }}
      onPointerMove={(event) => {
        if (!draggingRef.current && !(event.buttons & 1)) return;
        const next = valueFromPointer(event.currentTarget, event.clientX);
        applyThumb(next);
        onChange(next);
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        draggingRef.current = false;
        setPressed(false);
      }}
      onPointerCancel={() => {
        draggingRef.current = false;
        setPressed(false);
      }}
      onPointerLeave={() => {
        if (draggingRef.current) return;
      }}
      onKeyDown={(event) => {
        const base = value;
        if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
          event.preventDefault();
          onChange(clamp(base + step, min, max));
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
          event.preventDefault();
          onChange(clamp(base - step, min, max));
        } else if (event.key === 'Home') {
          event.preventDefault();
          onChange(min);
        } else if (event.key === 'End') {
          event.preventDefault();
          onChange(max);
        }
      }}
    >
      <div
        aria-hidden
        className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-slate-100 shadow-[inset_2px_3px_6px_rgba(15,23,42,0.15),inset_-2px_-2px_6px_rgba(255,255,255,0.9)]"
      >
        <div
          className="absolute left-0 top-0 h-full rounded-full opacity-70"
          style={{ width: `${pctOf(value)}%`, backgroundColor: accent }}
        />
      </div>

      <div
        ref={thumbRef}
        aria-hidden
        className={`pointer-events-none absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border border-white transition-shadow duration-150 ease-out ${
          pressed
            ? 'scale-95 shadow-[inset_2px_3px_6px_rgba(15,23,42,0.3),inset_-2px_-2px_5px_rgba(255,255,255,0.8)]'
            : 'scale-100 shadow-[3px_4px_8px_rgba(15,23,42,0.25),-2px_-3px_6px_rgba(255,255,255,0.95),0_1px_2px_rgba(15,23,42,0.1)]'
        }`}
        style={{ left: thumbLeftFor(value), backgroundColor: accent }}
      />
    </div>
  );
}

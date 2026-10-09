'use client';

import { useId } from 'react';

/**
 * Accessible labelled switch. Unlike a `<label>` wrapping a `<button>` (which
 * does not compute an accessible name), the text is associated via
 * `aria-labelledby` so screen readers announce the control's name.
 */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  className = '',
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}) {
  const labelId = useId();

  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-lg border border-canvas-grey px-3 py-2.5 ${className}`}
    >
      <span>
        <span id={labelId} className="text-sm font-semibold text-slate-700">
          {label}
        </span>
        {description && (
          <span className="mt-0.5 block text-xs font-normal text-slate-500">
            {description}
          </span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          checked ? 'bg-gakit-maroon' : 'bg-slate-200'
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            checked ? 'left-[1.375rem]' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );
}

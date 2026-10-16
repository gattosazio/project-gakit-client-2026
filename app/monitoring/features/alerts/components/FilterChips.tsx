'use client';

import type { LucideIcon } from 'lucide-react';

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  icon: LucideIcon;
}

/**
 * Horizontal toggle chips used as the primary filter in each alerts panel.
 * `aria-pressed` communicates selection to assistive tech.
 */
export function FilterChips<T extends string>({
  options,
  value,
  onSelect,
  ariaLabel,
}: {
  options: readonly ChipOption<T>[];
  value: T;
  onSelect: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {options.map(({ value: optionValue, label, icon: Icon }) => {
        const isActive = optionValue === value;
        return (
          <button
            key={optionValue}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(optionValue)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              isActive
                ? 'bg-gakit-maroon text-white'
                : 'bg-canvas-light text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, ChevronDown } from 'lucide-react';

export interface FilterDropdownOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export function FilterDropdown<T extends string>({
  value,
  onSelect,
  options,
  triggerLabel,
  triggerIcon,
  size = 'md',
}: {
  value: T;
  onSelect: (value: T) => void;
  options: FilterDropdownOption<T>[];
  triggerLabel: string;
  triggerIcon: ReactNode;
  size?: 'sm' | 'md';
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 192 });
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !buttonRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const width = Math.max(rect.width, 192);
      setMenuPos({
        top: rect.bottom + 4,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        width,
      });
    }
    setOpen(true);
  };

  const isSm = size === 'sm';

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 outline-none transition-colors hover:bg-canvas-light ${
          isSm ? 'px-2.5 py-1 text-xs' : 'px-3 py-2 text-sm'
        }`}
      >
        <span className="flex min-w-0 items-center gap-1.5 truncate">
          {triggerIcon}
          <span className="truncate">{triggerLabel}</span>
        </span>
        <ChevronDown className={`shrink-0 text-slate-400 transition-transform ${isSm ? 'h-3.5 w-3.5' : 'h-4 w-4'} ${open ? 'rotate-180' : ''}`} />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, width: menuPos.width }}
            className="z-[1400] max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onSelect(option.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 text-left font-medium hover:bg-canvas-light ${
                    isSm ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-sm'
                  } ${index > 0 ? 'border-t border-slate-100' : ''} ${isSelected ? 'bg-canvas-light text-gakit-maroon' : 'text-slate-700'}`}
                >
                  {option.icon}
                  <span className="flex-1 text-left">{option.label}</span>
                  {isSelected && <CheckCircle2 className={`shrink-0 text-gakit-maroon ${isSm ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}

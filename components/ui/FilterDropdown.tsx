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
}: {
  value: T;
  onSelect: (value: T) => void;
  options: FilterDropdownOption<T>[];
  triggerLabel: string;
  triggerIcon: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
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
      const width = 192;
      setMenuPos({
        top: rect.bottom + 4,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      });
    }
    setOpen(true);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-canvas-grey bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none hover:bg-canvas-light"
      >
        <span className="flex items-center gap-2">
          {triggerIcon}
          {triggerLabel}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, width: 192 }}
            className="z-[1400] overflow-hidden rounded-lg border border-canvas-grey bg-white py-1 shadow-lg"
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
                  className={`flex w-full items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-canvas-light ${index > 0 ? 'border-t border-canvas-grey' : ''} ${isSelected ? 'bg-canvas-light text-gakit-maroon' : 'text-slate-700'}`}
                >
                  {option.icon}
                  <span className="flex-1 text-left">{option.label}</span>
                  {isSelected && <CheckCircle2 className="w-4 h-4 shrink-0 text-gakit-maroon" />}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}

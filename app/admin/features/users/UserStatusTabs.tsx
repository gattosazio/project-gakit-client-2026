'use client';

import type { UserStatus, UserStatusCounts } from '@/types/admin';

const STATUS_TABS: Array<{ value: 'all' | UserStatus; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'suspended', label: 'Deactivated' },
];

export function UserStatusTabs({
  value,
  counts,
  busy = false,
  onChange,
}: {
  value: 'all' | UserStatus;
  counts: UserStatusCounts | null;
  busy?: boolean;
  onChange: (value: 'all' | UserStatus) => void;
}) {
  const total = counts ? counts.active + counts.pending + counts.suspended : null;

  return (
    <div
      role="group"
      aria-label="Filter users by status"
      aria-busy={busy || undefined}
      className="flex items-center gap-3 border-b border-slate-200 px-1.5"
    >
      <div className="flex min-w-0 items-center overflow-x-auto">
        {STATUS_TABS.map((tab) => {
          const active = value === tab.value;
          const count =
            counts === null ? null : tab.value === 'all' ? total : counts[tab.value];

          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => onChange(tab.value)}
              aria-pressed={active}
              className={`inline-flex h-10 shrink-0 items-center gap-2 border-b-2 px-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gakit-maroon/30 ${
                active
                  ? 'border-gakit-maroon text-gakit-maroon'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
              {count !== null && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                    active
                      ? 'bg-maroon-50 text-gakit-maroon'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

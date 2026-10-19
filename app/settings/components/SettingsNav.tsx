'use client';

export type SectionId = 'account' | 'security' | 'appearance' | 'developer';

const NAV_ITEMS = [
  { id: 'account', label: 'My Account' },
  { id: 'security', label: 'Security & Login' },
  { id: 'appearance', label: 'Appearance' },
] as const;

export function SettingsNav({ active, isAdmin = false }: { active: SectionId; isAdmin?: boolean }) {
  const items: ReadonlyArray<{ id: SectionId; label: string }> = isAdmin
    ? [...NAV_ITEMS, { id: 'developer', label: 'Developer tools' }] : NAV_ITEMS;

  return (
    <nav
      role="navigation"
      aria-label="Settings sections"
      className="rounded-2xl border border-canvas-grey bg-white p-2 shadow-sm md:p-1.5"
    >
      <ul className="flex flex-wrap gap-1 md:flex-col">
        {items.map((item) => {
          const isActive = active === item.id;
          return (
            <li key={item.id} className="w-full">
              <a
                href={`#${item.id}`}
                aria-current={isActive ? 'page' : undefined}
                className={`block rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-maroon-50 text-gakit-maroon'
                    : 'text-slate-600 hover:bg-canvas-light hover:text-slate-900'
                }`}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

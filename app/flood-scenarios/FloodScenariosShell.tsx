'use client';

import { PublicHeader } from '@/components/PublicHeader';
import type { AuthSnapshot } from '@/lib/auth/roles';
import { ScenariosTab } from './ScenariosTab';

/**
 * Flood scenarios is a standalone map surface, not a monitoring tab: it borrows
 * the public hazard map's full-bleed layout and floating pill header, with no
 * sidebar or bottom bar. The bento menu is the only way back to a portal.
 */
export function FloodScenariosShell({ initialAuth }: { initialAuth?: AuthSnapshot }) {
  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-canvas-grey">
      <PublicHeader
        initialAuth={initialAuth}
        showBentoMenu
        showSectionNav={false}
        showBottomNav={false}
      />
      <ScenariosTab active />
    </div>
  );
}

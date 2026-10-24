'use client';

import { PublicHeader } from '@/components/PublicHeader';
import { ScenarioDisplayPopover } from '@/components/header/ScenarioDisplayPopover';
import type { AuthSnapshot } from '@/lib/auth/roles';
import { ScenariosTab } from './ScenariosTab';

/**
 * Flood scenarios is a standalone map surface, not a monitoring tab: it borrows
 * the public hazard map's full-bleed layout and floating pill header, with no
 * sidebar or bottom bar. The header provides navigation back to the public map.
 */
export function FloodScenariosShell({ initialAuth }: { initialAuth?: AuthSnapshot }) {
  return (
    <div data-map-shell className="relative h-[100dvh] w-full overflow-hidden bg-canvas-grey">
      <PublicHeader
        initialAuth={initialAuth}
        showBentoMenu
        hideMobileAlertsAndMenu
        showAlerts={false}
        guideVariant="scenarios"
        showSectionNav={false}
        showBottomNav={false}
        extraAction={<ScenarioDisplayPopover />}
      />
      <ScenariosTab active />
    </div>
  );
}

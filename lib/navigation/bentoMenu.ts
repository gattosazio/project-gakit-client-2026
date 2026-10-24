/** Portal entries shared by the header, mobile and sidebar menus. */
export interface BentoTile {
  id: string;
  label: string;
  href: string;
  badge?: string;
  requiresAuth?: boolean;
  /** Tile is only offered to administrators (e.g. the admin portal entry). */
  requiresAdmin?: boolean;
}

import { ROLE_ADMIN, ROLE_STAFF, type StaffRole } from '@/lib/auth/roles';

export const monitoringBentoTiles: BentoTile[] = [
  {
    id: 'public-hazard-map',
    label: 'Hazard Map',
    href: '/',
  },
  {
    id: 'flood-scenarios',
    label: 'Flood Scenario Explorer',
    href: '/flood-scenarios',
    badge: 'BETA',
  },
  {
    id: 'monitoring-portal',
    label: 'Monitoring Portal',
    href: '/monitoring',
    requiresAuth: true,
  },
];

export const administrationBentoTile: BentoTile = {
  id: 'administration',
  label: 'Administration',
  href: '/admin',
  requiresAuth: true,
  requiresAdmin: true,
};

export const gakitAppTiles = monitoringBentoTiles;

/**
 * Guests get Login in the monitoring slot; signed-in staff get their portal.
 * The current portal's own tile is filtered out by `BentoMenu`.
 */
export function getBentoTilesForRole(role?: StaffRole | null): BentoTile[] {
  if (role === ROLE_ADMIN) {
    return [...monitoringBentoTiles, administrationBentoTile];
  }
  if (role === ROLE_STAFF) return monitoringBentoTiles;
  return monitoringBentoTiles.map(tile => tile.id === 'monitoring-portal'
    ? { id: 'login', label: 'Login', href: '/login' }
    : tile);
}




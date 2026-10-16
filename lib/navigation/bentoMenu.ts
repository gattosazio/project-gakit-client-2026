/**
 * Portal entries surfaced through the floating header bento menu. Every tile
 * renders a square mark from `iconSrc`; overwrite the placeholder file with the
 * finished artwork to go live, no code change needed.
 */
export interface BentoTile {
  id: string;
  label: string;
  href: string;
  iconSrc?: string;
  badge?: string;
  requiresAuth?: boolean;
  /** Tile is only offered to administrators (e.g. the admin portal entry). */
  requiresAdmin?: boolean;
}

/** Intrinsic size every bento mark is authored at. */
export const BENTO_MARK_SIZE = 48;

import { ROLE_ADMIN, ROLE_STAFF, type StaffRole } from '@/lib/auth/roles';

export const monitoringBentoTiles: BentoTile[] = [
  {
    id: 'public-hazard-map',
    label: 'Hazard Map',
    href: '/',
    iconSrc: '/images/bento-public-hazard-map.svg',
  },
  {
    id: 'flood-scenarios',
    label: 'Flood Scenarios',
    href: '/flood-scenarios',
    iconSrc: '/images/bento-flood-scenarios.svg',
    badge: 'BETA',
  },
  {
    id: 'monitoring-portal',
    label: 'Monitoring Portal',
    href: '/monitoring',
    iconSrc: '/images/bento-monitoring-portal.svg',
    requiresAuth: true,
  },
];

export const administrationBentoTile: BentoTile = {
  id: 'administration',
  label: 'Administration',
  href: '/admin',
  iconSrc: '/images/bento-administration.svg',
  requiresAuth: true,
  requiresAdmin: true,
};

export const gakitAppTiles = monitoringBentoTiles;

/**
 * Cross-portal launcher tiles. Everyone who can reach the launcher sees the
 * monitoring-side tiles; administrators additionally get the Administration
 * entry. The current portal's own tile is filtered out by `BentoMenu`.
 */
export function getBentoTilesForRole(role?: StaffRole | null): BentoTile[] {
  if (role === ROLE_ADMIN) {
    return [...monitoringBentoTiles, administrationBentoTile];
  }
  return monitoringBentoTiles;
}




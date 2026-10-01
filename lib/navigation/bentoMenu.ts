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

export const gakitAppTiles = monitoringBentoTiles;

export function getBentoTilesForRole(_role?: StaffRole | null): BentoTile[] {
  return monitoringBentoTiles;
}




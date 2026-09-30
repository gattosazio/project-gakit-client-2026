/**
 * Portal entries surfaced through the floating header bento menu. Every tile
 * renders a square mark from `iconSrc`; overwrite the placeholder file with the
 * finished artwork to go live, no code change needed.
 */
export interface BentoTile {
  id: string;
  label: string;
  href: string;
  iconSrc: string;
  /** Spans both grid columns as a full-width "home" row. Keep at most one. */
  wide?: boolean;
  badge?: string;
}

/** Intrinsic size every bento mark is authored at. */
export const BENTO_MARK_SIZE = 48;

export const monitoringBentoTiles: BentoTile[] = [
  {
    id: 'monitoring-portal',
    label: 'Monitoring Portal',
    href: '/monitoring',
    iconSrc: '/images/bento-monitoring-portal.svg',
    wide: true,
  },
  {
    id: 'flood-scenarios',
    label: 'Flood Scenarios',
    href: '/flood-scenarios',
    iconSrc: '/images/bento-flood-scenarios.svg',
    badge: 'BETA',
  },
  {
    id: 'public-hazard-map',
    label: 'Public Hazard Map',
    href: '/',
    iconSrc: '/images/bento-public-hazard-map.svg',
  },
];

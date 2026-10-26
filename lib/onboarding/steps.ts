export type TourPanel = 'weather' | 'layers' | 'reports';
export type TourPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center';

export interface ModalTourStep {
  id: string;
  title: string;
  body: string;
  target: string;
  placement: TourPlacement;
  spotlightPadding?: number;
  scrollBlock?: ScrollLogicalPosition;
}

export interface TourStep {
  id: string;
  title: string;
  body: string;
  /** Value of the target element's data-tour attribute; null docks the card. */
  target: string | null;
  panel: TourPanel | null;
  placement: TourPlacement;
  spotlightPadding?: number;
  scrollTarget?: boolean;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'search',
    title: 'Find any place in Iligan',
    body: 'Search a street, barangay, or landmark. The target button recenters the map on your current location.',
    target: 'search',
    panel: null,
    placement: 'bottom',
    spotlightPadding: 6,
  },
  {
    id: 'assess',
    title: 'Tap the map to assess a spot',
    body: 'Tap anywhere on the map to see mapped flood, landslide, and storm surge exposure, plus rainfall for that exact point.',
    target: null,
    panel: null,
    placement: 'center',
  },
  {
    id: 'layers',
    title: 'Turn on hazard layers',
    body: 'Open Layers to switch on Flood, Landslide, or Storm Surge. The color bands run from low to high exposure. Rainfall, satellite imagery, and typhoon tracks are further down the same panel.',
    target: 'layers-hazards',
    panel: 'layers',
    placement: 'right',
    spotlightPadding: 6,
    scrollTarget: true,
  },
  {
    id: 'simulation',
    title: 'Preview flooding (Beta)',
    body: 'Turn on Flood Simulation to see estimated flood depth from recent and forecast rainfall, then scrub the timeline at the bottom of the map.',
    target: 'flood-simulation',
    panel: 'layers',
    placement: 'right',
    spotlightPadding: 6,
    scrollTarget: true,
  },
  {
    id: 'weather',
    title: 'Check the forecast',
    body: 'The Weather Outlook shows current conditions and a five-day forecast for your selected area. Pair it with the Rainfall layer to see observed totals over the last 1 to 24 hours.',
    target: 'weather',
    panel: 'weather',
    placement: 'right',
    spotlightPadding: 6,
    scrollTarget: true,
  },
  {
    id: 'reports',
    title: 'See what residents are reporting',
    body: 'Flood Reports shows verified reports from the community. Click a report in this list, or any pin on the map, for its details.',
    target: 'reports',
    panel: 'reports',
    placement: 'right',
    spotlightPadding: 6,
    scrollTarget: true,
  },
  {
    id: 'report',
    title: 'Report flooding you can see',
    body: 'Pin the flooded spot, choose how deep the water is, and submit. Staff review every report before it appears publicly.',
    target: 'report',
    panel: 'reports',
    placement: 'top',
    spotlightPadding: 8,
  },
];

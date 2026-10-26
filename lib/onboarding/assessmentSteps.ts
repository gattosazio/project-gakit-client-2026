import type { TourPlacement } from './steps';

export interface AssessmentTourStep {
  id: string;
  title: string;
  body: string;
  /** Value of the target element's data-tour attribute. */
  target: string;
  placement: TourPlacement;
  spotlightPadding?: number;
  scrollBlock?: ScrollLogicalPosition;
}

export const ASSESSMENT_TOUR_STEPS: AssessmentTourStep[] = [
  {
    id: 'location',
    title: 'Your assessment location',
    body: 'Hazard maps and weather below are for this pinned point. To assess another place, close this and tap a different spot on the map.',
    target: 'assessment-location',
    placement: 'bottom',
    spotlightPadding: 6,
  },
  {
    id: 'hazards',
    title: 'Mapped hazards',
    body: 'Flood, landslide, and storm surge levels come from hazard maps. They show exposure, not live flooding — and “None mapped” does not guarantee safety.',
    target: 'assessment-hazards',
    placement: 'right',
    spotlightPadding: 6,
    scrollBlock: 'end',
  },
  {
    id: 'weather',
    title: 'Weather outlook',
    body: 'Rainfall and heat conditions are current weather, not a live flood forecast. Compare them with the mapped hazards and official advisories.',
    target: 'assessment-weather',
    placement: 'top',
    spotlightPadding: 6,
  },
];

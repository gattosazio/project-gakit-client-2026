import type { ModalTourStep } from './steps';

export const REPORT_TOUR_STEPS: ModalTourStep[] = [
  {
    id: 'location',
    title: 'Report location',
    body: 'Check that the pin marks where flooding was observed. Use Adjust to move it if needed.',
    target: 'report-location',
    placement: 'bottom',
    spotlightPadding: 6,
  },
  {
    id: 'depth',
    title: 'Estimated water depth',
    body: 'Choose a reference or enter an estimate in centimeters. Estimate from a safe place—never enter floodwater. A photo is optional.',
    target: 'report-depth',
    placement: 'top',
    spotlightPadding: 6,
    scrollBlock: 'end',
  },
];

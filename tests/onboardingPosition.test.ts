import { describe, expect, it } from 'vitest';

import { ASSESSMENT_TOUR_STEPS } from '@/lib/onboarding/assessmentSteps';
import { computeTourTooltipPosition } from '@/lib/onboarding/position';

const viewport = { width: 1000, height: 800 };
const tooltip = { width: 300, height: 180 };

describe('computeTourTooltipPosition', () => {
  it('centers the card when there is no target', () => {
    expect(
      computeTourTooltipPosition({ target: null, tooltip, viewport })
    ).toEqual({ top: 310, left: 350, placement: 'center' });
  });

  describe('assessment tour positioning', () => {
    it('scrolls mapped hazards to the end so the guide can sit above them', () => {
      const hazardsStep = ASSESSMENT_TOUR_STEPS.find((step) => step.id === 'hazards');

      expect(hazardsStep?.scrollBlock).toBe('end');
    });
  });

  it('prefers the requested side when it fits', () => {
    const result = computeTourTooltipPosition({
      target: { top: 100, left: 400, width: 200, height: 40 },
      tooltip,
      viewport,
      preferred: 'bottom',
      safeTop: 80,
    });

    expect(result).toEqual({ top: 154, left: 350, placement: 'bottom' });
  });

  it('flips to the side with the most room when the preferred side cannot fit', () => {
    const result = computeTourTooltipPosition({
      target: { top: 650, left: 400, width: 200, height: 40 },
      tooltip,
      viewport,
      preferred: 'bottom',
      safeTop: 80,
    });

    expect(result).toEqual({ top: 456, left: 350, placement: 'top' });
  });

  it('chooses the least obstructive side when no side has enough room', () => {
    const result = computeTourTooltipPosition({
      target: { top: 140, left: 24, width: 342, height: 230 },
      tooltip: { width: 340, height: 200 },
      viewport: { width: 390, height: 500 },
      preferred: 'right',
    });

    expect(result.placement).toBe('top');
    expect(result.top).toBe(12);
    expect(result.left).toBe(25);
  });

  it('keeps the card clear of a target aligned to the scroll container end', () => {
    const result = computeTourTooltipPosition({
      target: { top: 240, left: 24, width: 342, height: 230 },
      tooltip: { width: 340, height: 200 },
      viewport: { width: 390, height: 500 },
      preferred: 'right',
    });

    expect(result).toEqual({ top: 26, left: 25, placement: 'top' });
    expect(result.top + 200).toBeLessThanOrEqual(240);
  });

  it('places the card beside a left-side sidebar target', () => {
    const result = computeTourTooltipPosition({
      target: { top: 300, left: 16, width: 288, height: 80 },
      tooltip,
      viewport,
      preferred: 'right',
      safeTop: 80,
    });

    expect(result).toEqual({ top: 250, left: 318, placement: 'right' });
  });

  it('clamps the card inside the viewport margin', () => {
    const result = computeTourTooltipPosition({
      target: { top: 100, left: 0, width: 60, height: 40 },
      tooltip,
      viewport,
      preferred: 'bottom',
      safeTop: 80,
    });

    expect(result).toEqual({ top: 154, left: 12, placement: 'bottom' });
  });

  it('avoids the mobile bottom navigation safe area', () => {
    const result = computeTourTooltipPosition({
      target: { top: 700, left: 300, width: 88, height: 56 },
      tooltip: { width: 300, height: 200 },
      viewport: { width: 390, height: 844 },
      preferred: 'bottom',
      safeTop: 72,
      safeBottom: 96,
    });

    expect(result.placement).toBe('top');
    expect(result.top).toBeGreaterThanOrEqual(84);
    expect(result.left).toBeGreaterThanOrEqual(12);
    expect(result.left + 300).toBeLessThanOrEqual(378);
  });
});

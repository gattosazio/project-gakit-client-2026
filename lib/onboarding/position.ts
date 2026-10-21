import type { TourPlacement } from './steps';

export interface TourRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface TourTooltipSize {
  width: number;
  height: number;
}

export interface TourViewport {
  width: number;
  height: number;
}

export interface TourPositionInput {
  target: TourRect | null;
  tooltip: TourTooltipSize;
  viewport: TourViewport;
  preferred?: TourPlacement;
  gap?: number;
  margin?: number;
  /** Fixed HUD the card must not sit under, e.g. the header. */
  safeTop?: number;
  /** Fixed HUD the card must not sit under, e.g. the mobile bottom nav. */
  safeBottom?: number;
}

export interface TourTooltipPosition {
  top: number;
  left: number;
  placement: TourPlacement;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

/**
 * Places the tour card next to the highlighted control, flipping to whichever
 * side has the most room and clamping it inside the safe viewport area. Map
 * canvas and sidebar targets are often tall or near an edge, so this is kept as
 * a pure function with unit coverage instead of relying on CSS alone.
 */
export function computeTourTooltipPosition({
  target,
  tooltip,
  viewport,
  preferred = 'bottom',
  gap = 14,
  margin = 12,
  safeTop = 0,
  safeBottom = 0,
}: TourPositionInput): TourTooltipPosition {
  const maxLeft = viewport.width - tooltip.width - margin;
  const maxTop = viewport.height - safeBottom - tooltip.height - margin;
  const minTop = safeTop + margin;
  const minLeft = margin;

  if (!target || preferred === 'center') {
    return {
      top: clamp((viewport.height - tooltip.height) / 2, minTop, maxTop),
      left: clamp((viewport.width - tooltip.width) / 2, minLeft, maxLeft),
      placement: 'center',
    };
  }

  const targetBottom = target.top + target.height;
  const targetRight = target.left + target.width;
  const requiredWidth = tooltip.width + gap + margin;
  const requiredHeight = tooltip.height + gap + margin;

  const room: Record<Exclude<TourPlacement, 'center'>, number> = {
    top: target.top - safeTop,
    bottom: viewport.height - safeBottom - targetBottom,
    left: target.left,
    right: viewport.width - targetRight,
  };

  const fits = (placement: Exclude<TourPlacement, 'center'>) =>
    placement === 'top' || placement === 'bottom'
      ? room[placement] >= requiredHeight
      : room[placement] >= requiredWidth;

  const candidates: Array<Exclude<TourPlacement, 'center'>> = [
    preferred,
    'top',
    'bottom',
    'right',
    'left',
  ];

  let placement: TourPlacement | null = null;
  if (fits(preferred)) {
    placement = preferred;
  } else {
    const fitting = candidates.filter(fits);
    if (fitting.length > 0) {
      placement = fitting.reduce((best, candidate) =>
        room[candidate] > room[best] ? candidate : best
      );
    }
  }

  if (!placement) {
    return {
      top: clamp((viewport.height - tooltip.height) / 2, minTop, maxTop),
      left: clamp((viewport.width - tooltip.width) / 2, minLeft, maxLeft),
      placement: 'center',
    };
  }

  if (placement === 'top') {
    return {
      top: clamp(target.top - gap - tooltip.height, minTop, maxTop),
      left: clamp(
        target.left + target.width / 2 - tooltip.width / 2,
        minLeft,
        maxLeft
      ),
      placement,
    };
  }

  if (placement === 'bottom') {
    return {
      top: clamp(targetBottom + gap, minTop, maxTop),
      left: clamp(
        target.left + target.width / 2 - tooltip.width / 2,
        minLeft,
        maxLeft
      ),
      placement,
    };
  }

  if (placement === 'left') {
    return {
      top: clamp(
        target.top + target.height / 2 - tooltip.height / 2,
        minTop,
        maxTop
      ),
      left: clamp(target.left - gap - tooltip.width, minLeft, maxLeft),
      placement,
    };
  }

  return {
    top: clamp(
      target.top + target.height / 2 - tooltip.height / 2,
      minTop,
      maxTop
    ),
    left: clamp(targetRight + gap, minLeft, maxLeft),
    placement: 'right',
  };
}

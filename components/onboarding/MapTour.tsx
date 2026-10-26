'use client';

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Compass, MapPin, X } from 'lucide-react';
import { useModalA11y } from '@/hooks/useModalA11y';
import { computeTourTooltipPosition, type TourRect } from '@/lib/onboarding/position';
import { TOUR_STEPS } from '@/lib/onboarding/steps';

const emptySubscribe = () => () => {};

function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function rectFor(element: HTMLElement): TourRect {
  const rect = element.getBoundingClientRect();
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

function isRendered(element: HTMLElement): boolean {
  if (element.getClientRects().length === 0) return false;
  const style = window.getComputedStyle(element);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    Number(style.opacity) > 0
  );
}

/** Responsive layouts render duplicate controls; pick the one actually shown. */
function findTourTarget(name: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`);
  for (const node of nodes) {
    if (isRendered(node)) return node;
  }
  return null;
}

export function MapTour({
  isOpen,
  stepIndex,
  onStepChange,
  onClose,
  onFinish,
  onReport,
}: {
  isOpen: boolean;
  stepIndex: number;
  onStepChange: (index: number) => void;
  onClose: () => void;
  onFinish: () => void;
  onReport?: () => void;
}) {
  const mounted = useMounted();
  const active = isOpen && mounted;
  const step = TOUR_STEPS[stepIndex] ?? TOUR_STEPS[0];
  const bodyId = useId();
  const lastStep = stepIndex >= TOUR_STEPS.length - 1;

  const [targetRect, setTargetRect] = useState<TourRect | null>(null);
  const [tooltipSize, setTooltipSize] = useState({ width: 0, height: 0 });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  const targetRef = useRef<HTMLElement | null>(null);
  const observedRef = useRef<HTMLElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const hasRevealedRef = useRef(false);

  const panelRef = useModalA11y<HTMLDivElement>({
    enabled: active,
    initialFocus: true,
    lockScroll: false,
  });

  const measure = useCallback(() => {
    if (!active) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    setViewport((current) =>
      current.width === width && current.height === height ? current : { width, height }
    );

    if (!step.target) {
      targetRef.current = null;
      setTargetRect(null);
      return;
    }

    const element = findTourTarget(step.target);
    if (!element) {
      targetRef.current = null;
      setTargetRect(null);
      return;
    }

    if (!hasRevealedRef.current) {
      hasRevealedRef.current = true;
      if (step.scrollTarget) {
        element.scrollIntoView({
          block: 'nearest',
          inline: 'nearest',
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        });
      }
    }

    targetRef.current = element;
    if (observedRef.current !== element) {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current?.observe(element);
      observedRef.current = element;
    }
    setTargetRect(rectFor(element));
  }, [active, step.scrollTarget, step.target]);

  // The panel and card content animate open and the sidebar scrolls, so poll
  // briefly and then rely on scroll/resize observation for the final position.
  useEffect(() => {
    if (!active) return;
    hasRevealedRef.current = false;
    const frame = window.requestAnimationFrame(measure);
    const timers = [60, 180, 360, 650, 1000].map((delay) =>
      window.setTimeout(measure, delay)
    );
    return () => {
      window.cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [active, stepIndex, measure]);

  useEffect(() => {
    if (!active) return;
    const onViewportChange = () => measure();
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    const observer = new ResizeObserver(onViewportChange);
    resizeObserverRef.current = observer;
    if (targetRef.current) {
      observer.observe(targetRef.current);
      observedRef.current = targetRef.current;
    }
    return () => {
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
      observer.disconnect();
      if (resizeObserverRef.current === observer) resizeObserverRef.current = null;
      observedRef.current = null;
    };
  }, [active, measure]);

  // New step content can wrap differently; measure it after layout before paint.
  useLayoutEffect(() => {
    if (!active) return;
    const element = panelRef.current;
    if (!element) return;
    setViewport({ width: window.innerWidth, height: window.innerHeight });
    const rect = element.getBoundingClientRect();
    setTooltipSize((current) =>
      Math.abs(current.width - rect.width) < 1 && Math.abs(current.height - rect.height) < 1
        ? current
        : { width: rect.width, height: rect.height }
    );
  }, [active, stepIndex, targetRect, panelRef]);

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      // Arrow keys are handled by the focused panel first; avoid duplicating
      // the same step change at the document level.
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (lastStep) onFinish();
        else onStepChange(stepIndex + 1);
      } else if (event.key === 'ArrowLeft' && stepIndex > 0) {
        event.preventDefault();
        onStepChange(stepIndex - 1);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [active, lastStep, onClose, onFinish, onStepChange, stepIndex]);

  useEffect(() => {
    if (!active) return;
    const element = panelRef.current;
    if (!element) return;
    const frame = window.requestAnimationFrame(() => element.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [active, stepIndex, panelRef]);

  if (!active) return null;

  const isMobile = viewport.width > 0 && viewport.width < 768;
  const safeTop = isMobile ? 72 : 80;
  const safeBottom = isMobile ? 96 : 16;
  const position = computeTourTooltipPosition({
    target: targetRect,
    tooltip: tooltipSize,
    viewport,
    preferred: step.placement,
    gap: 14,
    margin: 12,
    safeTop,
    safeBottom,
  });
  const measured = viewport.width > 0 && tooltipSize.width > 0;
  const padding = step.spotlightPadding ?? 6;
  const spotlight = targetRect
    ? {
        top: targetRect.top - padding,
        left: targetRect.left - padding,
        width: targetRect.width + padding * 2,
        height: targetRect.height + padding * 2,
      }
    : null;

  return createPortal(
    <>
      <div
        className={`fixed inset-0 z-[1700] ${spotlight ? '' : 'bg-slate-950/55 backdrop-blur-[1px]'}`}
        aria-hidden="true"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      />

      {spotlight && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[1701] rounded-2xl transition-[top,left,width,height] duration-200 ease-out motion-reduce:transition-none"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            boxShadow:
              '0 0 0 3px rgba(122, 0, 25, 0.95), 0 0 0 5px rgba(255,255,255,0.92), 0 0 0 9999px rgba(15,23,42,0.58)',
          }}
        />
      )}

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Map tour step ${stepIndex + 1}: ${step.title}`}
        aria-describedby={bodyId}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
          if (event.key === 'ArrowLeft' && stepIndex > 0) {
            event.preventDefault();
            onStepChange(stepIndex - 1);
          } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            if (lastStep) onFinish();
            else onStepChange(stepIndex + 1);
          }
        }}
        className="fixed z-[1710] max-h-[calc(100dvh-12rem)] w-[min(21.5rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain rounded-2xl bg-white p-4 text-left shadow-2xl ring-1 ring-slate-900/10 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-gakit-maroon md:max-h-[calc(100dvh-7rem)]"
        style={{
          top: position.top,
          left: position.left,
          visibility: measured ? 'visible' : 'hidden',
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-gakit-maroon">
            <Compass className="h-3.5 w-3.5" aria-hidden />
            <p className="text-[10px] font-bold uppercase tracking-[0.16em]">Map tour</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close map tour"
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>

        <p className="sr-only" aria-live="polite">
          Step {stepIndex + 1} of {TOUR_STEPS.length}: {step.title}
        </p>
        <h3 className="mt-2.5 text-base font-bold leading-5 text-slate-900">{step.title}</h3>
        <p id={bodyId} className="mt-1.5 text-xs leading-5 text-slate-600" aria-live="polite">
          {step.body}
        </p>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-1.5" aria-label={`Step ${stepIndex + 1} of ${TOUR_STEPS.length}`}>
            {TOUR_STEPS.map((tourStep, index) => (
              <span
                key={tourStep.id}
                aria-hidden
                className={`h-1.5 rounded-full transition-all duration-200 motion-reduce:transition-none ${
                  index === stepIndex
                    ? 'w-4 bg-gakit-maroon'
                    : index < stepIndex
                      ? 'w-1.5 bg-maroon-200'
                      : 'w-1.5 bg-slate-200'
                }`}
              />
            ))}
            <span className="ml-1 text-[10px] font-semibold tabular-nums text-slate-400">
              {stepIndex + 1}/{TOUR_STEPS.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={() => onStepChange(stepIndex - 1)}
                aria-label="Previous tour step"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
            <button
              type="button"
              onClick={lastStep ? onFinish : () => onStepChange(stepIndex + 1)}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-gakit-maroon px-3 text-xs font-bold text-white transition-colors hover:bg-maroon-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon focus-visible:ring-offset-2 active:scale-[0.98]"
            >
              {lastStep ? 'Start exploring' : 'Next'}
              {!lastStep}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

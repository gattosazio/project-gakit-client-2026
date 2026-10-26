'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowLeft, ArrowRight, Compass, X } from 'lucide-react';
import { ASSESSMENT_TOUR_STEPS } from '@/lib/onboarding/assessmentSteps';
import { computeTourTooltipPosition, type TourRect, type TourViewport } from '@/lib/onboarding/position';

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

function findTourTarget(name: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`);
  for (const node of nodes) {
    if (isRendered(node)) return node;
  }
  return null;
}

interface HazardAssessmentTourProps {
  isActive: boolean;
  stepIndex: number;
  onStepChange: (index: number) => void;
  onClose: () => void;
  onFinish: () => void;
}

export function HazardAssessmentTour({
  isActive,
  stepIndex,
  onStepChange,
  onClose,
  onFinish,
}: HazardAssessmentTourProps) {
  const mounted = useMounted();
  const active = isActive && mounted;
  const step = ASSESSMENT_TOUR_STEPS[stepIndex] ?? ASSESSMENT_TOUR_STEPS[0];
  const lastStep = stepIndex >= ASSESSMENT_TOUR_STEPS.length - 1;
  const bodyId = useId();

  const [targetRect, setTargetRect] = useState<TourRect | null>(null);
  const [tooltipSize, setTooltipSize] = useState({ width: 0, height: 0 });
  const [viewport, setViewport] = useState<TourViewport>({ width: 0, height: 0 });

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const observedRef = useRef<HTMLElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const hasRevealedRef = useRef(false);
  const measureRef = useRef<() => void>(() => {});

  const measure = useCallback(() => {
    if (!active) return;

    const overlay = overlayRef.current;
    if (!overlay) return;
    const overlayRect = overlay.getBoundingClientRect();
    setViewport({ width: overlayRect.width, height: overlayRect.height });

    if (!step.target) {
      setTargetRect(null);
      return;
    }

    const element = findTourTarget(step.target);
    if (!element) {
      setTargetRect(null);
      return;
    }

    if (!hasRevealedRef.current) {
      hasRevealedRef.current = true;
      element.scrollIntoView({
        block: step.scrollBlock ?? 'nearest',
        inline: 'nearest',
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      });
    }

    targetRef.current = element;
    if (observedRef.current !== element) {
      resizeObserverRef.current?.disconnect();
      const observer = new ResizeObserver(() => measureRef.current());
      resizeObserverRef.current = observer;
      observer.observe(element);
      observedRef.current = element;
    }

    const rect = rectFor(element);
    setTargetRect({
      top: rect.top - overlayRect.top,
      left: rect.left - overlayRect.left,
      width: rect.width,
      height: rect.height,
    });
  }, [active, step.scrollBlock, step.target]);

  useEffect(() => {
    measureRef.current = measure;
  }, [measure]);

  useEffect(() => {
    if (!active) return;
    hasRevealedRef.current = false;
    const frame = window.requestAnimationFrame(measure);
    const timers = [60, 180, 360, 650, 1000].map((delay) => window.setTimeout(measure, delay));
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
      if (resizeObserverRef.current === observer) {
        resizeObserverRef.current = null;
      }
      observedRef.current = null;
    };
  }, [active, measure]);

  useLayoutEffect(() => {
    if (!active) return;
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    setTooltipSize((current) =>
      Math.abs(current.width - rect.width) < 1 && Math.abs(current.height - rect.height) < 1
        ? current
        : { width: rect.width, height: rect.height }
    );
  }, [active, stepIndex, targetRect, tooltipSize]);

  useEffect(() => {
    if (!active) return;
    const frame = window.requestAnimationFrame(() => cardRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [active, stepIndex]);

  if (!active) return null;

  const position = computeTourTooltipPosition({
    target: targetRect,
    tooltip: tooltipSize,
    viewport,
    preferred: step.placement,
    gap: 14,
    margin: 12,
    safeTop: 0,
    safeBottom: 0,
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

  return (
    <div
      ref={overlayRef}
      className={`absolute inset-0 z-40 ${spotlight ? '' : 'bg-slate-950/55 backdrop-blur-[1px]'}`}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {spotlight && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-2xl transition-[top,left,width,height] duration-200 ease-out motion-reduce:transition-none"
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
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Hazard assessment tour step ${stepIndex + 1}: ${step.title}`}
        aria-describedby={bodyId}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            event.stopPropagation();
            if (lastStep) onFinish();
            else onStepChange(stepIndex + 1);
          } else if (event.key === 'ArrowLeft' && stepIndex > 0) {
            event.preventDefault();
            event.stopPropagation();
            onStepChange(stepIndex - 1);
          }
        }}
        className="absolute z-50 overflow-y-auto overscroll-contain rounded-2xl bg-white p-4 text-left shadow-2xl ring-1 ring-slate-900/10 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-gakit-maroon"
        style={{
          top: position.top,
          left: position.left,
          visibility: measured ? 'visible' : 'hidden',
          width: 'min(21.5rem, calc(100% - 1.5rem))',
          maxHeight: 'calc(100% - 1.5rem)',
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-gakit-maroon">
            <Compass className="h-3.5 w-3.5" aria-hidden />
            <p className="text-[10px] font-bold uppercase tracking-[0.16em]">Assessment tour</p>
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
              aria-label="Close assessment tour"
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>

        <p className="sr-only" aria-live="polite">
          Step {stepIndex + 1} of {ASSESSMENT_TOUR_STEPS.length}: {step.title}
        </p>
        <h3 className="mt-2.5 text-base font-bold leading-5 text-slate-900">{step.title}</h3>
        <p id={bodyId} className="mt-1.5 text-xs leading-5 text-slate-600" aria-live="polite">
          {step.body}
        </p>

        {lastStep ? (
          <button
            type="button"
            onClick={onFinish}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-maroon-200 bg-maroon-50/60 px-3 py-2.5 text-xs font-bold text-gakit-maroon transition-colors hover:bg-maroon-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon focus-visible:ring-offset-2"
          >
            Got it.
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onStepChange(stepIndex + 1)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-maroon-200 bg-maroon-50/60 px-3 py-2.5 text-xs font-bold text-gakit-maroon transition-colors hover:bg-maroon-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon focus-visible:ring-offset-2"
          >
            Next
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        )}

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-1.5" aria-label={`Step ${stepIndex + 1} of ${ASSESSMENT_TOUR_STEPS.length}`}>
            {ASSESSMENT_TOUR_STEPS.map((tourStep, index) => (
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
              {stepIndex + 1}/{ASSESSMENT_TOUR_STEPS.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={() => onStepChange(stepIndex - 1)}
                aria-label="Previous assessment tour step"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

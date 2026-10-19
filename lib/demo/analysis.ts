import type { ScenarioData, ScenarioFrame } from '@/types/scenario';
import type { DemoReportResult } from './reports';
import type { FloodDepthGrid } from '@/lib/map/floodDepthHover';

export interface DemoAnalysisPatch {
  bounds: { left: number; right: number; top: number; bottom: number };
  baselineRaster: string;
  correctedRaster: string;
  baselineDepth?: FloodDepthGrid;
  correctedDepth?: FloodDepthGrid;
}

export interface DemoAnalysisResult {
  synthetic: true;
  terrainBounds: DemoAnalysisPatch['bounds'];
  reports: DemoReportResult[];
  patches: DemoAnalysisPatch[];
  contextPatches?: DemoAnalysisPatch[];
  reportUpdateCount: number;
  changedCells: number;
  addedWetAreaM2: number;
  removedWetAreaM2: number;
  maxDepthChangeM: number;
  storageChangeM3: number;
  baselineWetAreaM2: number;
  correctedWetAreaM2: number;
  reportEffects: { reportId: string; reason: string; baselineDepthM: number | null; correctedDepthM: number | null;
    appliedAt?: string; currentDepthM?: number; acceptedDepthRangeM?: [number, number]; depthUncertaintyAssumed?: boolean }[];
  observationOnlyGroups: number;
  outsideDomainReportIds: string[];
  flowState?: {
    method: 'local_inertial';
    at: string;
    startedAt: string;
    budgets: { baseline: DemoWaterBudget; corrected: DemoWaterBudget }[];
    domainExpansions?: number;
    artificialBoundaryDifferenceM3?: number;
  };
}

export interface DemoFlowProgress {
  at: string;
  startedAt: string;
  targetAt: string;
  domainExpansions: number;
}

export interface DemoAnalysisPending {
  synthetic: true;
  pending: true;
  progress: DemoFlowProgress;
}

export interface DemoWaterBudget {
  initialM3: number;
  runoffM3: number;
  boundaryNetM3: number;
  reportAdjustmentM3: number;
  domainExtensionM3?: number;
  storedM3: number;
  balanceErrorM3: number;
}

export function demoEffectLabel(reason: string): string {
  const labels: Record<string, string> = {
    applied: 'Local depth updated',
    already_consistent: 'Depth already within the reported range',
    carried_forward: 'Applied earlier · included in the current estimate',
    applied_limited: 'Local depth updated · smaller surrounding area',
    applied_shallow: 'Depth updated · below the 20 cm map limit',
    applied_limited_shallow: 'Depth updated · below the 20 cm map limit',
    outside_terrain: 'Outside model coverage · pin only',
    no_numeric_depth: 'No depth given · pin only',
    older_than_15_minutes: 'Over 15 minutes old · replay to see its effect',
    measurement_precision_unknown: 'Depth or location too uncertain to update',
    conflicting_depths: 'Conflicting depths · update held',
    depth_variation_requires_review: 'Conflicting depths · update held',
    limited_by_observation_uncertainty: 'Depth or location uncertain · reduced influence',
    unusable_terrain: 'Ground data unavailable · pin only',
    not_selected: 'Not used for a depth update',
    superseded_source: 'Newer nearby report from this person used',
    superseded_at_location: 'Newer observation at this location used',
    shared_sources: 'Supporting reports already used in a nearby update',
    report_rejected: 'Rejected · no depth update',
    awaiting_validation: 'Pending · no depth update',
  };
  return labels[reason] ?? 'Not used for a depth update';
}

/** Resume completed work chunks promptly; back off when another request owns the worker. */
export async function retryBusyDemoAnalysis<T>(request: () => Promise<T | DemoAnalysisPending>, signal: AbortSignal,
  maxRetries = 3, onProgress?: (progress: DemoFlowProgress) => void): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted();
    let waitMs = 25;
    try {
      const result = await request();
      if (!result || typeof result !== 'object' || !('pending' in result) || result.pending !== true) return result as T;
      onProgress?.((result as DemoAnalysisPending).progress);
      if (attempt >= maxRetries) throw new Error('Flood update took too long. Try again to continue the saved replay.');
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'Demo analysis is busy; retry shortly' || attempt >= maxRetries) throw error;
      waitMs = Math.min(1000, 250 * 2 ** attempt);
    }
    await new Promise<void>((resolve, reject) => {
      const cancel = () => { clearTimeout(timer); reject(signal.reason); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, waitMs);
      signal.addEventListener('abort', cancel, { once: true });
      if (signal.aborted) cancel();
    });
  }
}

/** A hung fetch, auth lookup or image decode must not leave the workspace loading forever. */
export async function withDemoDeadline<T>(operation: (signal: AbortSignal) => Promise<T>, parent: AbortSignal,
  timeoutMs = 180_000): Promise<T> {
  parent.throwIfAborted();
  const controller = new AbortController();
  const cancel = () => controller.abort(parent.reason);
  parent.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => controller.abort(new Error('Flood update timed out. Try again to continue the saved replay.')), timeoutMs);
  let rejectAbort: () => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(controller.signal.reason);
    controller.signal.addEventListener('abort', rejectAbort, { once: true });
  });
  try {
    return await Promise.race([Promise.resolve().then(() => operation(controller.signal)), aborted]);
  } finally {
    clearTimeout(timer);
    parent.removeEventListener('abort', cancel);
    controller.signal.removeEventListener('abort', rejectAbort);
  }
}

export function demoRainfall(frame?: ScenarioFrame): number | null {
  const rain = frame?.effective_rainfall_mm ?? frame?.cum_rain_mm;
  return typeof rain === 'number' && Number.isFinite(rain) && rain >= 0 ? rain : null;
}

export function patchRectangle(bounds: ScenarioData['bounds'], patch: DemoAnalysisPatch['bounds'], width: number, height: number) {
  const [left, top] = bounds[0];
  const [right, bottom] = bounds[2];
  return [(patch.left - left) / (right - left) * width, (top - patch.top) / (top - bottom) * height,
    (patch.right - patch.left) / (right - left) * width, (patch.top - patch.bottom) / (top - bottom) * height] as const;
}

async function loadImage(uri: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = uri;
  await image.decode();
  return image;
}

/** Replace patches, including transparent dry cells, so shrinking the extent is visible. */
export async function compositeDemoRasters(frame: ScenarioFrame, bounds: ScenarioData['bounds'], patches: DemoAnalysisPatch[]) {
  if (patches.length === 0) return { baseline: frame.raster_uri, corrected: frame.raster_uri };
  const original = await loadImage(frame.raster_uri);
  const canvas = document.createElement('canvas');
  canvas.width = original.naturalWidth;
  canvas.height = original.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Demo raster rendering unavailable');
  context.imageSmoothingEnabled = false;
  const images = await Promise.all(patches.map(async patch => ({ patch,
    baseline: await loadImage(patch.baselineRaster), corrected: await loadImage(patch.correctedRaster),
  })));
  const render = (view: 'baseline' | 'corrected') => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(original, 0, 0);
    for (const { patch, ...image } of images) {
      const rectangle = patchRectangle(bounds, patch.bounds, canvas.width, canvas.height);
      context.clearRect(...rectangle);
      context.drawImage(image[view], ...rectangle);
    }
    return canvas.toDataURL('image/png');
  };
  return { baseline: render('baseline'), corrected: render('corrected') };
}

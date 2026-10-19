'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowLeft, RotateCcw, FlaskConical, MapPin } from 'lucide-react';
import { apiRequest } from '@/lib/backend/http';
import { setDemoEnabled, useDemoEnabled } from '@/lib/demo/settings';
import { currentDemoReports, demoClock, demoTime, visibleDemoReports, type DemoReportInput, type DemoReportResult } from '@/lib/demo/reports';
import { compositeDemoRasters, demoRainfall, retryBusyDemoAnalysis, withDemoDeadline, type DemoAnalysisPending, type DemoAnalysisResult, type DemoFlowProgress } from '@/lib/demo/analysis';
import { SCENARIO_PRESETS, type ScenarioData, type ScenarioFrame } from '@/types/scenario';
import { DEPTH_PRESETS } from '@/lib/reports/depthReferences';
import { TimelinePlayer } from '@/app/flood-scenarios/components/TimelinePlayer';
import { ScenarioDisplayPopover } from '@/components/header/ScenarioDisplayPopover';
import { DemoReportCard } from './DemoReportCard';
import { DemoBehaviors } from './DemoBehaviors';
import type { DemoBehavior } from '@/lib/demo/behaviors';

const ScenarioMap = dynamic(() => import('@/app/flood-scenarios/components/ScenarioMap').then(module => module.ScenarioMap), { ssr: false });
const PRESETS = SCENARIO_PRESETS.filter(preset => preset.type !== 'live' && preset.dataFile);
const inputClass = 'h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800';
const actionClass = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50';
const EMPTY_RESULTS: DemoReportResult[] = [];
const EMPTY_FRAMES: ScenarioFrame[] = [];
const subscribeHydration = () => () => {};

interface PreparedDemoAnalysis {
  key: string;
  preset: string;
  minutes: number;
  frameIndex: number;
  reports: DemoReportResult[];
  analysis?: DemoAnalysisResult;
  rasters?: { baseline: string; corrected: string };
  error?: string;
}

function cacheDemoView(previous: { prepared: PreparedDemoAnalysis; bytes: number }[], prepared: PreparedDemoAnalysis) {
  const bytes = JSON.stringify(prepared).length * 2;
  const next = [...previous.filter(item => item.prepared.key !== prepared.key), { prepared, bytes }];
  while (next.length > 3 || next.reduce((sum, item) => sum + item.bytes, 0) > 32 * 1024 * 1024) next.shift();
  return next;
}

function demoInputs(reports: DemoReportInput[], frames: ScenarioFrame[], at: number, knownAt: number) {
  return visibleDemoReports(reports, at, knownAt).map(report => ({
    ...report,
    depthMethod: report.depthCm != null && report.depthMethod === 'category' ? 'estimated' as const : report.depthMethod,
    rainAtObservationMm: demoRainfall(frames[Math.floor((Date.parse(report.observedAt) - Date.parse(demoTime(0))) / 3_600_000)]),
  }));
}

function demoRequestKey(runId: string, preset: string, frames: ScenarioFrame[], at: number, knownAt: number, approveFixtures: boolean, reports: DemoReportInput[]) {
  const currentIndex = Math.min(Math.floor(at / 60), Math.max(0, frames.length - 1));
  const rainMm = demoRainfall(frames[currentIndex]);
  if (rainMm === null) return null;
  const stormHistory = frames.map((item, index) => ({ at: demoTime(index * 60), hourlyRainMm: item.hourly_rain_mm, modelRainMm: demoRainfall(item) }));
  return JSON.stringify({ runId, stormHistory, preset, currentIndex, simulationTime: demoTime(at), knowledgeTime: demoTime(knownAt), approveFixtures, rainMm, reports });
}

async function prepareDemoAnalysis(key: string, data: ScenarioData, signal: AbortSignal, onProgress?: (value: DemoFlowProgress) => void): Promise<PreparedDemoAnalysis> {
  const { preset, runId, stormHistory, simulationTime, knowledgeTime, approveFixtures, rainMm, reports, currentIndex: frameIndex } = JSON.parse(key);
  return withDemoDeadline(async signal => {
    const result = await retryBusyDemoAnalysis<DemoAnalysisResult>(() => withDemoDeadline(requestSignal =>
      apiRequest<DemoAnalysisResult | DemoAnalysisPending>('/api/v1/admin/demo/analysis', {
        method: 'POST', signal: requestSignal, body: JSON.stringify({ runId, stormHistory, simulationTime, knowledgeTime, approveFixtures, rainMm, reports }),
      }), signal, 20_000), signal, 120, onProgress);
    signal.throwIfAborted();
    const rasters = await compositeDemoRasters(data.frames[frameIndex], data.bounds, [...(result.contextPatches ?? []), ...result.patches]);
    signal.throwIfAborted();
    return { key, preset, minutes: (Date.parse(simulationTime) - Date.parse(demoTime(0))) / 60_000, frameIndex, reports: result.reports, analysis: result, rasters };
  }, signal);
}

export function DemoWorkspace() {
  const enabled = useDemoEnabled();
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const [preset, setPreset] = useState('pagasa_orange');
  const [runId, setRunId] = useState(() => crypto.randomUUID());
  const [scenario, setScenario] = useState<{ id: string; data?: ScenarioData; error?: string } | null>(null);
  const [minutes, setMinutes] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [approveFixtures, setApproveFixtures] = useState(false);
  const [inspectionMinutes, setInspectionMinutes] = useState<number | null>(null);
  const [observationTime, setObservationTime] = useState<'now' | 'earlier'>('now');
  const [earlierMinutes, setEarlierMinutes] = useState(0);
  const [manual, setManual] = useState<DemoReportInput[]>([]);
  const preloads = useRef(new Map<string, { signature: string; runId: string; data: ScenarioData; prepared: PreparedDemoAnalysis }>());
  const preloadController = useRef<AbortController | null>(null);
  const [preloadBusyId, setPreloadBusyId] = useState<string | null>(null);
  const [preloadStatuses, setPreloadStatuses] = useState<Record<string, { signature: string; ready: boolean }>>({});
  const [preloadError, setPreloadError] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<PreparedDemoAnalysis | null>(null);
  const [readyViews, setReadyViews] = useState<{ prepared: PreparedDemoAnalysis; bytes: number }[]>([]);
  const [lastReady, setLastReady] = useState<PreparedDemoAnalysis | null>(null);
  const [flowProgress, setFlowProgress] = useState<{ key: string; value: DemoFlowProgress } | null>(null);
  const [retry, setRetry] = useState(0);
  const [reporter, setReporter] = useState(7);
  const [depthCategory, setDepthCategory] = useState('knee');
  const [exactDepth, setExactDepth] = useState('');
  const [poorGps, setPoorGps] = useState(false);
  const [manualLocation, setManualLocation] = useState(false);
  const [measured, setMeasured] = useState(true);
  const [view, setView] = useState<'baseline' | 'corrected'>('corrected');
  const [location, setLocation] = useState({ latitude: 8.2312, longitude: 124.247 });
  const [focus, setFocus] = useState<{ latitude: number; longitude: number }>();
  const [reportsHidden, setReportsHidden] = useState(false);
  const data = scenario?.id === preset ? scenario.data : undefined;
  const frames = data?.frames ?? EMPTY_FRAMES;
  const maxMinutes = Math.max(0, frames.length - 1) * 60;
  const analysisMinutes = inspectionMinutes ?? minutes;
  const currentIndex = Math.min(Math.floor(analysisMinutes / 60), Math.max(0, frames.length - 1));
  const isPlaying = enabled && playing && inspectionMinutes === null && minutes < maxMinutes;
  const playerFrames = useMemo(() => frames.map((frame, index) => ({ ...frame, display_time: demoClock(index * 60) })), [frames]);
  useEffect(() => () => { preloadController.current?.abort(); }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const selected = PRESETS.find(item => item.id === preset);
    if (!selected) return;
    void fetch(selected.dataFile, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Stored scenario unavailable');
      return await response.json() as ScenarioData;
    }).then(value => {
      if (!controller.signal.aborted) setScenario({ id: preset, data: value });
    }).catch(error => {
      if (!controller.signal.aborted) setScenario({ id: preset, error: String(error) });
    });
    return () => controller.abort();
  }, [enabled, preset]);

  const inputs = useMemo(() => demoInputs(manual, frames, analysisMinutes, minutes), [manual, frames, analysisMinutes, minutes]);
  const requestKey = useMemo(() => demoRequestKey(runId, preset, frames, analysisMinutes, minutes, approveFixtures, inputs), [runId, preset, frames, analysisMinutes, minutes, approveFixtures, inputs]);
  const assessed = assessment?.key === requestKey ? assessment : readyViews.find(item => item.prepared.key === requestKey)?.prepared ?? null;
  const analysisPending = enabled && requestKey !== null && !assessed;

  // Wait for each analysis before advancing; no abandoned inference queue during fast playback.
  useEffect(() => {
    if (!isPlaying || analysisPending || assessed?.error) return;
    const timer = setInterval(() => setMinutes(value => Math.min(maxMinutes, value + 5)), 1000 / speed);
    return () => clearInterval(timer);
  }, [isPlaying, speed, maxMinutes, analysisPending, assessed?.error]);

  // Send original events and forcing. Server checkpoints carry numeric water and
  // flow; edits, removals and rewinds replay those inputs rather than PNG colors.
  useEffect(() => {
    if (!enabled || requestKey === null || !data || assessed?.key === requestKey) return;
    const controller = new AbortController();
    const { preset: requestedPreset, simulationTime, currentIndex: frameIndex } = JSON.parse(requestKey);
    const requestedMinutes = (Date.parse(simulationTime) - Date.parse(demoTime(0))) / 60_000;
    void prepareDemoAnalysis(requestKey, data, controller.signal, value => {
      if (!controller.signal.aborted) setFlowProgress({ key: requestKey, value });
    }).then(result => {
      if (!controller.signal.aborted) { setAssessment(result); setLastReady(result); setReadyViews(value => cacheDemoView(value, result)); }
    }).catch(error => {
      if (!controller.signal.aborted) setAssessment({ key: requestKey, preset: requestedPreset, minutes: requestedMinutes, frameIndex, reports: [], error: error instanceof Error ? error.message : 'Demo analysis unavailable' });
    });
    return () => controller.abort();
  }, [enabled, requestKey, retry, data, assessed?.key]);

  // Keep a labeled prior result while advancing. Rewind/reset/scenario changes discard it.
  const previousReady = [lastReady, ...readyViews.map(item => item.prepared)].filter((item): item is PreparedDemoAnalysis => item !== null && item.preset === preset && item.minutes <= analysisMinutes)
    .sort((a, b) => b.minutes - a.minutes)[0];
  const displayed = assessed?.analysis ? assessed : ((analysisPending || assessed?.error) ? previousReady ?? null : null);
  const results = displayed?.reports ?? EMPTY_RESULTS;
  const mapReports = displayed?.reports ?? EMPTY_RESULTS;
  const displayedMinutes = displayed?.minutes ?? analysisMinutes;
  const currentReports = useMemo(() => currentDemoReports(mapReports, displayedMinutes), [mapReports, displayedMinutes]);
  const analysis = displayed?.analysis;
  const progress = flowProgress?.key === requestKey ? flowProgress.value : null;
  const frame = frames[displayed?.frameIndex ?? currentIndex];
  const displayFrame = frame && displayed?.rasters ? { ...frame, raster_uri: displayed.rasters[view], depth_raster_uri: frame.raster_uri } : frame;
  const depthPatches = useMemo(() => [
    ...(displayed?.analysis?.contextPatches ?? []), ...(displayed?.analysis?.patches ?? []),
  ].flatMap(patch => {
    const grid = view === 'baseline' ? patch.baselineDepth : patch.correctedDepth;
    return grid ? [{ bounds: patch.bounds, grid, label: view === 'baseline' ? 'Baseline simulated depth' : 'Report-analysis simulated depth' }] : [];
  }), [displayed?.analysis, view]);
  const reset = () => {
    setRunId(crypto.randomUUID());
    setReadyViews([]);
    setPlaying(false); setMinutes(0); setInspectionMinutes(null); setObservationTime('now'); setEarlierMinutes(0); setManual([]); setAssessment(null); setLastReady(null); setFlowProgress(null); setRetry(value => value + 1);
  };
  const invalidateBehavior = (id: string) => {
    preloads.current.delete(id);
    setPreloadStatuses(value => { const next = { ...value }; delete next[id]; return next; });
    // A save or delete may replace the inputs of the behavior currently being prepared.
    preloadController.current?.abort(); preloadController.current = null; setPreloadBusyId(null);
    setPreloadError(null);
  };
  const preloadBehavior = async (behavior: DemoBehavior) => {
    if (preloadController.current) return;
    const controller = new AbortController(); preloadController.current = controller;
    setPreloadBusyId(behavior.id); setPreloadError(null);
    try {
      const selected = PRESETS.find(item => item.id === behavior.preset)!;
      const scenarioData = await withDemoDeadline(async signal => {
        if (scenario?.id === behavior.preset && scenario.data) return scenario.data;
        const response = await fetch(selected.dataFile, { signal });
        if (!response.ok) throw new Error('Stored storm unavailable.');
        return await response.json() as ScenarioData;
      }, controller.signal, 20_000);
      const at = behavior.inspectionMinutes ?? behavior.minutes;
      if (behavior.minutes > (scenarioData.frames.length - 1) * 60) throw new Error('Saved time is outside this storm.');
      const preparedRunId = crypto.randomUUID();
      const key = demoRequestKey(preparedRunId, behavior.preset, scenarioData.frames, at, behavior.minutes, behavior.approveFixtures,
        demoInputs(behavior.reports, scenarioData.frames, at, behavior.minutes));
      if (!key) throw new Error('Rainfall is unavailable for the saved time.');
      const prepared = await prepareDemoAnalysis(key, scenarioData, controller.signal);
      controller.signal.throwIfAborted();
      const signature = JSON.stringify(behavior);
      preloads.current.set(behavior.id, { signature, runId: preparedRunId, data: scenarioData, prepared });
      setPreloadStatuses(value => ({ ...value, [behavior.id]: { signature, ready: true } }));
    } catch (error) {
      if (!controller.signal.aborted) setPreloadError(`Could not preload “${behavior.name}”: ${error instanceof Error ? error.message : 'Try again.'}`);
    } finally {
      if (preloadController.current === controller) { preloadController.current = null; setPreloadBusyId(null); }
    }
  };
  const loadBehavior = (behavior: DemoBehavior) => {
    const cached = preloads.current.get(behavior.id);
    const ready = cached?.signature === JSON.stringify(behavior) ? cached : undefined;
    setPlaying(false); setPreset(behavior.preset); setMinutes(behavior.minutes); setInspectionMinutes(behavior.inspectionMinutes);
    setManual(behavior.reports.map(report => ({ ...report }))); setApproveFixtures(behavior.approveFixtures);
    setLocation({ ...behavior.location }); setFocus({ ...behavior.location }); setView('corrected'); setReportsHidden(false);
    setObservationTime('now'); setEarlierMinutes(0); setFlowProgress(null);
    setRunId(ready?.runId ?? crypto.randomUUID()); setAssessment(ready?.prepared ?? null); setLastReady(ready?.prepared ?? null);
    setReadyViews(ready ? cacheDemoView([], ready.prepared) : []);
    if (ready) setScenario({ id: behavior.preset, data: ready.data });
    setRetry(value => value + 1);
  };
  const addReport = (event: React.FormEvent) => {
    event.preventDefault();
    const exact = exactDepth.trim();
    const presetDepth = DEPTH_PRESETS.find(item => item.code === depthCategory)?.cm
      ?? (depthCategory === 'overhead' ? 190 : null);
    const cm = exact ? Number(exact) : presetDepth;
    if (cm !== null && (!Number.isInteger(cm) || cm < 1 || cm > 999)) return;
    if (manual.length >= 50) return;
    const observedMinutes = observationTime === 'earlier' ? Math.max(0, Math.min(minutes, earlierMinutes)) : minutes;
    setPlaying(false);
    setInspectionMinutes(observedMinutes < minutes ? observedMinutes : null);
    setFocus({ ...location });
    setManual(value => [...value, { id: crypto.randomUUID(), reporter, ...location, depthCm: cm,
      observedAt: demoTime(observedMinutes), submittedAt: demoTime(minutes), gpsAccuracyM: poorGps ? 150 : 10, blocked: false,
      locationSource: manualLocation ? 'manual' : 'gps',
      depthMethod: cm === null ? 'category' : exact && measured ? 'measured' : 'estimated',
      depthUncertaintyCm: exact && measured ? 10 : null }]);
  };

  if (!hydrated) return <main role="status" className="min-h-screen bg-slate-50 p-6 text-sm text-slate-600">Opening demo workspace…</main>;
  if (!enabled) return <main className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6">
    <h1 className="text-xl font-bold text-slate-900">Demo mode is off</h1>
    <p className="my-3 text-sm text-slate-600">Choose a storm, add reports, and see how water depth and flood coverage change.</p>
    <button type="button" onClick={() => setDemoEnabled(true)} className="rounded-lg bg-gakit-maroon px-4 py-2 text-sm font-semibold text-white">Start storm demo</button>
  </div></main>;

  return <main className="min-h-screen bg-slate-50 text-slate-800">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 md:px-6">
      <div className="flex items-center gap-3"><Link href="/settings#developer" aria-label="Back to developer tools"><ArrowLeft className="h-5 w-5" /></Link>
        <span className="rounded-md bg-amber-200 px-2 py-1 text-xs font-bold">DEMO</span><h1 className="font-bold">Live storm & report response</h1></div>
      <div className="flex items-center gap-2"><span className="text-xs font-semibold tabular-nums">{demoClock(minutes)}</span>
        <button type="button" className={actionClass} onClick={() => { reset(); setDemoEnabled(false); }}>Exit demo</button></div>
    </header>
    <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:p-6">
      <section className="min-w-0 space-y-3">
        <p className="text-sm text-slate-600">Choose a storm, add reports, and compare the flood response. Demo data stays in this workspace.</p>
        <div className="flex flex-wrap items-center gap-2"><FlaskConical className="h-4 w-4 text-amber-600" />
          <label className="sr-only" htmlFor="demo-storm">Storm scenario</label>
          <select id="demo-storm" className={`${inputClass} max-w-sm`} value={preset} onChange={event => { reset(); setPreset(event.target.value); }}>
            {PRESETS.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <button type="button" className={actionClass} onClick={reset}><RotateCcw className="mr-1 inline h-3.5 w-3.5" />Reset demo</button>
          <button type="button" className={actionClass} aria-pressed={reportsHidden} onClick={() => setReportsHidden(value => !value)}>{reportsHidden ? 'Show reports' : 'Hide reports'}</button>
          <div className="flex gap-1" role="group" aria-label="Demo flood comparison">
            <button type="button" aria-pressed={view === 'baseline'} className={`${actionClass} ${view === 'baseline' ? 'border-gakit-maroon text-gakit-maroon' : ''}`} onClick={() => setView('baseline')}>Without reports</button>
            <button type="button" aria-pressed={view === 'corrected'} className={`${actionClass} ${view === 'corrected' ? 'border-gakit-maroon text-gakit-maroon' : ''}`} onClick={() => setView('corrected')}>With reports</button>
          </div>
          <ScenarioDisplayPopover compact />
        </div>
        <div className="relative h-[48vh] min-h-80 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 lg:h-[60vh]">
          {data ? <ScenarioMap scenarioId={`demo:${preset}:${view}`} bounds={data.bounds} currentFrame={displayFrame}
            demoReports={currentReports} demoReportPinsHidden={reportsHidden} onDemoLocationPick={setLocation} demoDraftLocation={location} demoFocus={focus} demoTerrainBounds={displayed?.analysis?.terrainBounds} depthPatches={depthPatches} />
            : <div role="status" className="flex h-full items-center justify-center text-sm">{scenario?.id === preset && scenario.error ? scenario.error : 'Loading storm…'}</div>}
          <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-amber-100 px-2 py-1 text-xs font-bold text-amber-950">{inspectionMinutes !== null ? 'Historical replay' : 'Synthetic storm'} · {demoClock(displayedMinutes)}</div>
          {analysisPending && <div role="status" className="absolute bottom-3 left-3 rounded-lg bg-white/95 px-3 py-2 text-xs shadow">
            {progress ? `Routing water · calculated through ${demoClock((Date.parse(progress.at) - Date.parse(demoTime(0))) / 60_000)}` : 'Updating flood map…'}
            {displayed && ` Showing ${demoClock(displayed.minutes)}.`}
          </div>}
          {assessed?.error && <div role="alert" className="absolute bottom-3 left-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 shadow">Update paused.{displayed && ` Showing ${demoClock(displayed.minutes)}.`} See the message below to retry.</div>}
        </div>
        {inspectionMinutes !== null && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <p>Reviewing {demoClock(inspectionMinutes)} with reports received by {demoClock(minutes)}. Current storm levels stay unchanged.</p>
          <button type="button" className={actionClass} onClick={() => setInspectionMinutes(null)}>Back to current time · {demoClock(minutes)}</button>
        </div>}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          <span>Rain this hour: <strong>{frame?.hourly_rain_mm?.toFixed(1) ?? '—'} mm</strong></span>
          <span>Rain used by model: <strong>{demoRainfall(frame)?.toFixed(1) ?? '—'} mm</strong></span>
          <span>Hourly flood maps · checks every 5 demo minutes</span>
        </div>
        {analysis && <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
          <span className="text-slate-500">With vs without reports · same time</span>
          <span><strong>{analysis.reportUpdateCount}</strong> reports applied</span>
          <span><strong>+{analysis.addedWetAreaM2.toLocaleString(undefined, { maximumFractionDigits: 0 })} m²</strong> more flooded</span>
          <span><strong>−{analysis.removedWetAreaM2.toLocaleString(undefined, { maximumFractionDigits: 0 })} m²</strong> less flooded</span>
          <span>Depth change up to <strong>{Math.round(analysis.maxDepthChangeM * 100)} cm</strong></span>
          <span>Water volume change <strong>{analysis.storageChangeM3 > 0 ? '+' : ''}{Math.round(analysis.storageChangeM3).toLocaleString()} m³</strong></span>
          {analysis.reportUpdateCount > 0 && <span>Local area (without → with): <strong>{Math.round(analysis.baselineWetAreaM2).toLocaleString()} → {Math.round(analysis.correctedWetAreaM2).toLocaleString()} m²</strong></span>}
          {analysis.observationOnlyGroups > 0 && <span>{analysis.observationOnlyGroups} reports with no depth update</span>}
          {analysis.outsideDomainReportIds.length > 0 && <span className="text-amber-700">{analysis.outsideDomainReportIds.length} outside model coverage</span>}
          {analysis.flowState && <span className="font-semibold text-sky-700">Water carries forward</span>}
        </div>}
        {frames.length > 0 && <TimelinePlayer className="relative w-full" frames={playerFrames} currentIndex={currentIndex}
          onIndexChange={index => { setPlaying(false); setInspectionMinutes(null); setMinutes(index * 60); }} isPlaying={isPlaying}
          onTogglePlay={() => { setInspectionMinutes(null); if (minutes >= maxMinutes) { setMinutes(0); setPlaying(true); } else setPlaying(value => !value); }}
          playbackSpeed={speed} onToggleSpeed={() => setSpeed(value => value === 4 ? 1 : value * 2)} onReset={reset}
          status={`${demoClock(minutes)} · ${analysisPending ? 'Updating map' : '1 second = 5 demo minutes at 1×'}`} />}
        <p className="text-xs text-slate-500">Area counts water at least 20 cm deep. Depth can change without expanding the outline.</p>
        <details className="text-xs leading-5 text-slate-500">
          <summary className="cursor-pointer font-medium">How updates work</summary>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            <li>Accepted readings adjust water once at their observation time. Water then keeps moving between steps.</li>
            <li>Depth at the pin follows the report’s measurement or estimated range. Nearby influence reaches up to 100 m; estimates and manual pins cover less ground.</li>
            <li>Area totals compare the local runs with and without reports at the same time, not the previous hour. Only water at least 20 cm deep counts.</li>
            <li>Rainfall adds runoff; water moves with the terrain. Pools can remain where there is no outlet.</li>
            <li>The routing area expands before report effects reach a local edge. Sea outflow is tracked separately; flood timing remains experimental.</li>
          </ul>
        </details>
      </section>
      <aside className="space-y-3">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <label className="block text-xs font-medium">Report handling<select className={`${inputClass} mt-1`} value={approveFixtures ? 'approved' : 'policy'} onChange={event => { setPlaying(false); setApproveFixtures(event.target.value === 'approved'); }}>
            <option value="policy">Check reports (default)</option>
            <option value="approved">Auto-approve (skip checks)</option>
          </select></label>
          <p role="status" className={`mb-3 mt-2 rounded-lg p-2 text-xs leading-5 ${approveFixtures ? 'bg-amber-50 text-amber-800' : 'bg-slate-50 text-slate-600'}`}>{approveFixtures
            ? 'Demo reports skip validation. The live report setting stays unchanged.'
            : 'Reports use the normal validation engine. One report can be accepted when storm and location checks support it.'}</p>
        </section>
        <DemoBehaviors snapshot={{ preset, minutes, inspectionMinutes, approveFixtures, reports: manual, location }}
          statuses={preloadStatuses} busyId={preloadBusyId} error={preloadError}
          onLoad={loadBehavior} onPreload={behavior => void preloadBehavior(behavior)} onChange={invalidateBehavior} />
        <form onSubmit={addReport} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-bold">Submit a demo report</h2>
          <p className="text-xs text-slate-500">Playback pauses after submission so you can inspect the change.</p>
          <label className="block text-xs font-medium">Observed at<select className={`${inputClass} mt-1`} value={observationTime} onChange={event => setObservationTime(event.target.value as 'now' | 'earlier')}>
            <option value="now">Now · {demoClock(minutes)}</option>
            <option value="earlier">Earlier</option>
          </select></label>
          {observationTime === 'earlier' && <label className="block text-xs font-medium">Minute since storm start · {demoClock(Math.min(minutes, earlierMinutes))}<input className={`${inputClass} mt-1`} type="number" min={0} max={minutes} step={1} value={Math.min(minutes, earlierMinutes)} onChange={event => setEarlierMinutes(Math.max(0, Math.min(minutes, Number(event.target.value) || 0)))} /></label>}
          <label className="block text-xs font-medium">Demo reporter<select className={`${inputClass} mt-1`} value={reporter} onChange={event => setReporter(Number(event.target.value))}>
            {Array.from({ length: 12 }, (_, index) => <option key={index} value={index + 1}>Demo reporter {index + 1}</option>)}
          </select></label>
          <label className="block text-xs font-medium">Depth estimate<select className={`${inputClass} mt-1`} value={depthCategory} onChange={event => setDepthCategory(event.target.value)}>
            <option value="none">No estimate</option>
            {DEPTH_PRESETS.map(item => <option key={item.code} value={item.code}>{item.shortLabel} deep · about {item.cm} cm</option>)}
            <option value="overhead">Overhead · about 190 cm</option>
          </select></label>
          <label className="block text-xs font-medium">Exact depth in cm <span className="font-normal text-slate-500">(optional; overrides category)</span>
            <input className={`${inputClass} mt-1`} type="number" min={1} max={999} step={1} value={exactDepth} onChange={event => setExactDepth(event.target.value)} placeholder="e.g. 45" />
          </label>
          {exactDepth.trim() && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={measured} onChange={event => setMeasured(event.target.checked)} />Measured with demo ruler (±10 cm)</label>}
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={manualLocation} onChange={event => setManualLocation(event.target.checked)} />Manual location (no GPS)</label>
          {!manualLocation && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={poorGps} onChange={event => setPoorGps(event.target.checked)} />Low GPS accuracy</label>}
          <p className="text-xs text-slate-500"><MapPin className="mr-1 inline h-3 w-3" />{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)} · Click map to move pin</p>
          <button type="submit" disabled={manual.length >= 50} className="w-full rounded-lg bg-gakit-maroon px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Add demo report</button>
        </form>
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-bold">Demo reports <span className="font-normal text-slate-500">({inputs.length})</span></h2>
          {!approveFixtures && inputs.length > 1 && new Set(inputs.map(input => input.reporter)).size === 1 && <p className="mt-2 text-xs leading-5 text-amber-700">Same reporter · nearby repeats count once. Separate locations remain usable.</p>}
          {!assessed && <p role="status" className="mt-2 text-xs text-slate-500">Checking reports…</p>}
          {assessed?.error && <div role="alert" className="mt-2 text-xs text-red-700">{assessed.error}
            <button type="button" className={`${actionClass} mt-2`} onClick={() => { setAssessment(null); setRetry(value => value + 1); }}>Try again</button>
          </div>}
          <div className="mt-3 max-h-96 space-y-2 overflow-y-auto">{[...results].reverse().map(report => {
            const effect = analysis?.reportEffects.find(item => item.reportId === report.id);
            const observedMinutes = (Date.parse(report.observedAt) - Date.parse(demoTime(0))) / 60_000;
            return <DemoReportCard key={report.id} report={report} effect={effect} minutes={minutes} analysisMinutes={analysisMinutes}
              onReplay={() => { setPlaying(false); setInspectionMinutes(observedMinutes); setFocus({ latitude: report.latitude, longitude: report.longitude }); }}
              onRemove={manual.some(input => input.id === report.id) ? () => { setPlaying(false); setManual(value => value.filter(input => input.id !== report.id)); } : undefined} />;
          })}</div>
        </section>
      </aside>
    </div>
  </main>;
}

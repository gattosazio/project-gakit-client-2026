'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { BEHAVIORS_EVENT, BEHAVIORS_KEY, behaviorSchema, readDemoBehaviors, fetchDemoBehaviors, saveDemoBehavior, deleteDemoBehavior, type DemoBehavior, type DemoBehaviorSnapshot } from '@/lib/demo/behaviors';
import { demoClock } from '@/lib/demo/reports';
import { SCENARIO_PRESETS } from '@/types/scenario';

const subscribe = (listener: () => void) => {
  window.addEventListener(BEHAVIORS_EVENT, listener);
  window.addEventListener('storage', listener);
  return () => { window.removeEventListener(BEHAVIORS_EVENT, listener); window.removeEventListener('storage', listener); };
};
const read = () => { try { return localStorage.getItem(BEHAVIORS_KEY); } catch { return null; } };
const buttonClass = 'rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50';

interface Props {
  snapshot: DemoBehaviorSnapshot;
  statuses: Record<string, { signature: string; ready: boolean }>;
  busyId: string | null;
  error: string | null;
  onLoad: (behavior: DemoBehavior) => void;
  onPreload: (behavior: DemoBehavior) => void;
  onChange: (id: string) => void;
}

export function DemoBehaviors({ snapshot, statuses, busyId, error: preloadError, onLoad, onPreload, onChange }: Props) {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const browserBehaviors = useMemo(() => readDemoBehaviors(raw), [raw]);
  const [behaviors, setBehaviors] = useState<DemoBehavior[]>([]);
  const [loading, setLoading] = useState(true);
  const [writing, setWriting] = useState(false);
  const [name, setName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = async () => {
    try {
      const saved = await fetchDemoBehaviors();
      setBehaviors(saved); setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not load saved behaviors.');
    } finally { setLoading(false); }
  };
  useEffect(() => {
    const controller = new AbortController();
    void fetchDemoBehaviors(controller.signal).then(saved => {
      if (!controller.signal.aborted) { setBehaviors(saved); setLoading(false); }
    }).catch(error => {
      if (!controller.signal.aborted) { setError(error instanceof Error ? error.message : 'Could not load saved behaviors.'); setLoading(false); }
    });
    return () => controller.abort();
  }, []);
  const storeResult = (saved: DemoBehavior) => {
    setBehaviors(value => [saved, ...value.filter(item => item.id !== saved.id)]);
    onChange(saved.id);
  };
  const save = async () => {
    if (loading || writing) return;
    const existing = behaviors.find(item => item.name.toLowerCase() === name.trim().toLowerCase());
    const id = existing?.id ?? crypto.randomUUID();
    if (!behaviorSchema.safeParse({ ...snapshot, id, name, savedAt: new Date().toISOString() }).success) {
      setError('Add at least one report and enter a name before saving.'); return;
    }
    setWriting(true); setError(null); setMessage(null);
    try {
      storeResult(await saveDemoBehavior(id, name.trim(), snapshot)); setName('');
      setMessage(existing ? 'Behavior updated in the shared library.' : 'Behavior saved to the shared library.');
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save this behavior.'); }
    finally { setWriting(false); }
  };
  const importBrowserBehaviors = async () => {
    setWriting(true); setError(null); setMessage(null);
    try {
      for (const behavior of browserBehaviors) {
        const { id, name, savedAt: _savedAt, ...snapshot } = behavior;
        storeResult(await saveDemoBehavior(id, name, snapshot));
        // Remove only confirmed imports; a failed batch can safely resume later.
        localStorage.setItem(BEHAVIORS_KEY, JSON.stringify(readDemoBehaviors(read()).filter(item => item.id !== id)));
        window.dispatchEvent(new Event(BEHAVIORS_EVENT));
      }
      setMessage('Browser saves imported to the shared library.');
    } catch (error) { setError(error instanceof Error ? error.message : 'Import paused. Remaining browser saves are still available.'); }
    finally { setWriting(false); }
  };
  return <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
    <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-bold">Saved behaviors</h2>
      <button type="button" className={buttonClass} disabled={loading || writing} onClick={() => { setLoading(true); void refresh(); }}>Refresh</button></div>
    <p className="text-xs leading-5 text-slate-500">Save a scene to the shared admin library. Storm, timing and report settings are available on your other devices.</p>
    <form className="flex gap-2" onSubmit={event => {
      event.preventDefault();
      void save();
    }}>
      <input aria-label="Behavior name" maxLength={80} value={name} onChange={event => { setName(event.target.value); setMessage(null); setError(null); }}
        placeholder="e.g. Water spreads near the edge" className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 px-2 text-sm" />
      <button type="submit" disabled={loading || writing || !snapshot.reports.length || !name.trim()} className={buttonClass}>{writing ? 'Saving…' : 'Save'}</button>
    </form>
    <p className="text-[11px] text-slate-500">The same name updates the shared scene. Loading replaces the current demo reports.</p>
    {browserBehaviors.length > 0 && <button type="button" className={buttonClass} disabled={loading || writing} onClick={() => void importBrowserBehaviors()}>Import browser saves ({browserBehaviors.length})</button>}
    {message && <p role="status" className="text-xs text-emerald-700">{message}</p>}
    {(error || preloadError) && <p role="alert" className="text-xs text-amber-700">{error || preloadError}</p>}
    {loading && <p role="status" className="text-xs text-slate-500">Loading saved behaviors…</p>}
    {!loading && !error && !behaviors.length && <p className="text-xs text-slate-500">No saved behaviors yet.</p>}
    <div className="max-h-72 space-y-2 overflow-y-auto">{behaviors.map(behavior => {
      const ready = statuses[behavior.id]?.signature === JSON.stringify(behavior) && statuses[behavior.id].ready;
      const busy = busyId === behavior.id;
      const storm = SCENARIO_PRESETS.find(item => item.id === behavior.preset)?.name;
      return <div key={behavior.id} className="rounded-lg border border-slate-200 p-2">
        <h3 className="break-words text-xs font-semibold">{behavior.name}</h3>
        <p className="mt-1 text-[11px] text-slate-500">{storm} · {demoClock(behavior.inspectionMinutes ?? behavior.minutes)} · {behavior.reports.length} reports</p>
        {behavior.approveFixtures && <p className="text-[11px] text-amber-700">Auto-approve saved</p>}
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className={buttonClass} disabled={loading || writing || busy} onClick={() => { setMessage(null); onLoad(behavior); }}>Load<span className="sr-only"> {behavior.name}</span></button>
          <button type="button" className={buttonClass} disabled={loading || writing || busyId !== null || ready} onClick={() => onPreload(behavior)}>{busy ? 'Preloading…' : ready ? 'Ready' : 'Preload'}<span className="sr-only"> {behavior.name}</span></button>
          <button type="button" className={`${buttonClass} ml-auto`} disabled={loading || writing} onClick={async () => {
            setWriting(true); setError(null); setMessage(null);
            try {
              await deleteDemoBehavior(behavior.id);
              setBehaviors(value => value.filter(item => item.id !== behavior.id));
              onChange(behavior.id); setMessage('Behavior deleted from the shared library.');
            } catch (error) { setError(error instanceof Error ? error.message : 'Could not delete this behavior.'); }
            finally { setWriting(false); }
          }}>Delete<span className="sr-only"> {behavior.name}</span></button>
        </div>
      </div>;
    })}</div>
    {behaviors.length > 0 && <p className="text-[11px] text-slate-500">Preload prepares the saved scene for instant loading. Later timeline steps calculate as usual. Preloads clear on refresh.</p>}
  </section>;
}

'use client';

import { useState } from 'react';
import { MapPinned } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Spinner } from '@/components/ui/Spinner';

export type OnboardingLocationStatus =
  | 'idle' | 'checking' | 'locating' | 'ready' | 'outside' | 'denied' | 'unsupported' | 'error';

export function OnboardingWelcome({ isOpen, status, onContinue }: {
  isOpen: boolean;
  status: OnboardingLocationStatus;
  onContinue: (useLocation: boolean) => void | Promise<void>;
}) {
  const [useLocation, setUseLocation] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [policy, setPolicy] = useState<'privacy' | 'terms' | null>(null);
  const busy = status === 'locating' || status === 'checking';
  const locationUnavailable = status === 'denied' || status === 'unsupported';

  return (
    <Dialog isOpen={isOpen} onClose={() => {}} ariaLabel="Welcome to GAKIT" maxWidthClass="max-w-md"
      panelClassName="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden p-0">
      <div className="flex shrink-0 items-center gap-2.5 border-b border-slate-100 px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-maroon-50 text-gakit-maroon">
          <MapPinned className="h-5 w-5" aria-hidden="true" />
        </span>
        <h2 className="font-heading text-base font-bold text-slate-900">Welcome to GAKIT</h2>
      </div>
      <div className="min-h-0 space-y-3 overflow-y-auto overscroll-contain px-5 py-4 text-xs leading-5 text-slate-600">
        <p>A community hazard map for Iligan City. Official warnings and evacuation instructions come from local authorities.</p>
        <div className="space-y-2">
          <p><strong className="font-semibold text-slate-800">What we collect:</strong> Reports you submit, including the location, water depth, notes, and optional photos. Map and welcome choices are saved in this browser.</p>
          <p><strong className="font-semibold text-slate-800">Your location:</strong> Shared only with your permission to center the map. Reports include the report location you choose.</p>
          <p><strong className="font-semibold text-slate-800">No account needed:</strong> You can report without signing in. A browser identifier helps manage your submissions; signed-in reports may be linked to your account.</p>
          <p><strong className="font-semibold text-slate-800">Who sees it:</strong> Authorized staff can review submissions. Public reports do not display personal contact details.</p>
        </div>
        <fieldset disabled={busy} className="space-y-1.5 border-t border-slate-100 pt-3">
          <legend className="pt-3 text-xs font-semibold text-slate-900">Use your location on the map?</legend>
          {[
            { value: true, text: 'Yes, move the map to where I am.' },
            { value: false, text: 'Not now. I will find my place myself.' },
          ].map(option => <label key={String(option.value)} className={`flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 ${useLocation === option.value ? 'border-maroon-200 bg-maroon-50/50' : 'border-slate-200'} ${option.value && locationUnavailable ? 'cursor-not-allowed opacity-50' : ''}`}>
            <input type="radio" name="welcome-location" checked={useLocation === option.value}
              disabled={option.value && locationUnavailable} onChange={() => setUseLocation(option.value)}
              className="h-4 w-4 shrink-0 accent-[#7a0019]" />
            <span>{option.text}</span>
          </label>)}
        </fieldset>
        <p className="text-[11px] leading-4 text-slate-500">
          {locationUnavailable ? 'Location access is unavailable. You can still choose a place on the map.' : 'You can use your location later from the search bar. Clear browser data to reset this choice.'}
        </p>
        {policy && <section aria-label={policy === 'privacy' ? 'Privacy notice' : 'Terms of use'} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
          <h3 className="mb-1 font-semibold text-slate-800">{policy === 'privacy' ? 'Privacy notice' : 'Terms of use'}</h3>
          <p>{policy === 'privacy'
            ? 'Submitted reports and photos are stored for assessment. Report locations and assessment results can appear publicly. A browser identifier and your display choices are kept on this device. Signed-in reports may be associated with your account.'
            : 'Use this map for information and preparedness. It does not replace official advisories or emergency services. Submit accurate reports and only photos you have permission to share. Hazard layers, forecasts, and flood estimates may be incomplete or delayed.'}</p>
        </section>}
        <label className="flex cursor-pointer items-start gap-2.5 border-t border-slate-100 pt-3">
          <input type="checkbox" checked={agreed} disabled={busy} onChange={event => setAgreed(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#7a0019]" />
          <span>I have read the{' '}
            <button type="button" onClick={event => { event.preventDefault(); setPolicy(policy === 'privacy' ? null : 'privacy'); }} className="font-medium text-gakit-maroon underline underline-offset-2">Privacy notice</button>
            {' '}and{' '}
            <button type="button" onClick={event => { event.preventDefault(); setPolicy(policy === 'terms' ? null : 'terms'); }} className="font-medium text-gakit-maroon underline underline-offset-2">Terms of use</button>, and I agree to them.
          </span>
        </label>
      </div>
      <div className="shrink-0 border-t border-slate-100 px-5 py-3">
        <button type="button" disabled={!agreed || busy} onClick={() => void onContinue(useLocation && !locationUnavailable)}
          className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-gakit-maroon px-4 text-xs font-semibold text-white transition-colors hover:bg-maroon-800 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon focus-visible:ring-offset-2">
          {status === 'locating' && <Spinner label="Locating your position" />}
          Continue
        </button>
      </div>
    </Dialog>
  );
}

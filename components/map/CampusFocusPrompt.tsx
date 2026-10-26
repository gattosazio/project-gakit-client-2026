'use client';

import { Focus, X } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';

export function CampusFocusPrompt({ isOpen, onEnable, onGoTo, onClose }: {
  isOpen: boolean;
  onEnable: () => void;
  onGoTo: () => void;
  onClose: () => void;
}) {
  return <Dialog isOpen={isOpen} onClose={onClose} ariaLabel="Focus on MSU-IIT">
    <div className="flex items-start justify-between gap-4">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-maroon-50 text-gakit-maroon"><Focus className="h-6 w-6" aria-hidden="true" /></div>
      <button type="button" onClick={onClose} aria-label="Close campus focus prompt" className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
    </div>
    <h2 className="mt-4 text-lg font-bold text-slate-900">Focus on MSU-IIT?</h2>
    <p className="mt-2 text-sm leading-relaxed text-slate-600">Explore the campus in satellite view with its reports highlighted and the surrounding map dimmed.</p>
    <div className="mt-5 flex flex-col gap-2">
      <button type="button" onClick={onEnable} className="min-h-11 rounded-xl bg-gakit-maroon px-4 text-sm font-semibold text-white hover:bg-maroon-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon focus-visible:ring-offset-2">Enable focus view</button>
      <button type="button" onClick={onGoTo} className="min-h-11 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200">Go to this location</button>
    </div>
  </Dialog>;
}

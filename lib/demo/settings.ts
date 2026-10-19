'use client';

import { useSyncExternalStore } from 'react';

const KEY = 'gakit.demo.enabled';
const EVENT = 'gakit-demo-preference';
const read = () => {
  try { return typeof window !== 'undefined' && sessionStorage.getItem(KEY) === 'true'; }
  catch { return false; }
};
const subscribe = (listener: () => void) => {
  window.addEventListener(EVENT, listener);
  window.addEventListener('storage', listener);
  return () => { window.removeEventListener(EVENT, listener); window.removeEventListener('storage', listener); };
};

export function setDemoEnabled(enabled: boolean) {
  try { sessionStorage.setItem(KEY, String(enabled)); }
  catch { return; }
  window.dispatchEvent(new Event(EVENT));
}

/** Presentation preference only; the server independently requires admin authorization. */
export function useDemoEnabled() {
  return useSyncExternalStore(subscribe, read, () => false);
}

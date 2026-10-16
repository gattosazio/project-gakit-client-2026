import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { weatherPlayback } from '@/lib/weather/animationPlayback';

let now: number;
let width: number;
let paused: boolean;
let frames: Map<number, FrameRequestCallback>;
let media: EventTarget & { matches: boolean };
let doc: EventTarget & { visibilityState: string };
let intersection: (entries: Partial<IntersectionObserverEntry>[]) => void;
let disconnected: ReturnType<typeof vi.fn>;
const element = { getBoundingClientRect: () => ({ width, height: 90 }) } as unknown as HTMLElement;

beforeEach(() => {
  now = 0; width = 320; paused = false; frames = new Map();
  media = Object.assign(new EventTarget(), { matches: false });
  doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  disconnected = vi.fn();
  let id = 0;
  vi.stubGlobal('document', doc);
  vi.stubGlobal('window', { matchMedia: () => media });
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++id, callback); return id; });
  vi.stubGlobal('cancelAnimationFrame', (value: number) => { frames.delete(value); });
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: typeof intersection) { intersection = callback; }
    observe() {}
    disconnect = disconnected;
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const show = (visible: boolean) => intersection([{ target: element, isIntersecting: visible, intersectionRatio: visible ? 1 : 0 }]);
function nextFrame(milliseconds = 16) {
  now += milliseconds;
  const queued = [...frames];
  frames.clear();
  for (const [, callback] of queued) callback(now);
}
function setup() {
  const draw = vi.fn();
  const reducedMotion = vi.fn();
  const playback = weatherPlayback(element, { draw, reducedMotion, paused: () => paused });
  return { draw, reducedMotion, ...playback };
}

it('starts only when the scene enters the viewport and retains one uncapped RAF chain', () => {
  const animation = setup();
  expect(frames.size).toBe(0);
  show(true);
  animation.refresh(); animation.refresh();
  expect(frames.size).toBe(1);
  nextFrame(8); nextFrame(8); nextFrame(8);
  expect(animation.draw).toHaveBeenCalledTimes(3);
  expect(frames.size).toBe(1);
  animation.dispose();
});

it('cancels work off-screen and resumes without fast-forwarding the scene', () => {
  const animation = setup(); show(true); nextFrame();
  show(false);
  expect(frames.size).toBe(0);
  now += 60_000;
  show(true); nextFrame();
  expect(animation.draw).toHaveBeenLastCalledWith(0.016);
  animation.dispose();
});

it('pauses behind a modal and resumes the same loop when it closes', () => {
  const animation = setup(); show(true); nextFrame();
  paused = true; animation.refresh();
  expect(frames.size).toBe(0);
  paused = false; animation.refresh(); nextFrame();
  expect(animation.draw).toHaveBeenCalledTimes(2);
  animation.dispose();
});

it('stops for hidden tabs and zero-sized cards', () => {
  const animation = setup(); show(true);
  doc.visibilityState = 'hidden'; doc.dispatchEvent(new Event('visibilitychange'));
  expect(frames.size).toBe(0);
  doc.visibilityState = 'visible'; doc.dispatchEvent(new Event('visibilitychange'));
  expect(frames.size).toBe(1);
  width = 0; animation.refresh();
  expect(frames.size).toBe(0);
  animation.dispose();
});

it('responds to reduced-motion changes with a static frame', () => {
  const animation = setup(); show(true);
  media.matches = true; media.dispatchEvent(new Event('change'));
  expect(frames.size).toBe(0);
  expect(animation.draw).toHaveBeenLastCalledWith(0);
  expect(animation.reducedMotion).toHaveBeenLastCalledWith(true);
  media.matches = false; media.dispatchEvent(new Event('change'));
  expect(frames.size).toBe(1);
  animation.dispose();
});

it('cleans up observers, callbacks, and listeners on unmount', () => {
  const animation = setup(); show(true); animation.dispose();
  expect(disconnected).toHaveBeenCalledOnce();
  expect(frames.size).toBe(0);
  media.dispatchEvent(new Event('change'));
  doc.dispatchEvent(new Event('visibilitychange'));
  show(true);
  expect(frames.size).toBe(0);
  expect(animation.draw).not.toHaveBeenCalled();
});

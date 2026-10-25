'use client';

import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';

/** Move only the card's DOM transform; no state updates or map work per frame. */
export function useDraggableCard() {
  const panelRef = useRef<HTMLElement>(null);
  const position = useRef({ x: 0, y: 0 });
  const drag = useRef<{ pointer: number; x: number; y: number; left: number; top: number; maxX: number; maxY: number } | null>(null);
  const frame = useRef<number | null>(null);
  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);
  const paint = () => { if (panelRef.current) panelRef.current.style.transform = `translate3d(${position.current.x}px,${position.current.y}px,0)`; frame.current = null; };
  const bounds = () => {
    if (!panelRef.current) return null;
    const panel = panelRef.current.getBoundingClientRect();
    const parent = panelRef.current.parentElement!.getBoundingClientRect();
    return { left: panel.left - parent.left - position.current.x, top: panel.top - parent.top - position.current.y,
      maxX: parent.width - panel.width - 12, maxY: parent.height - panel.height - 100 };
  };
  const start = (event: PointerEvent<HTMLButtonElement>) => {
    const area = bounds();
    if (event.button !== 0 || !area) return;
    drag.current = { ...area, pointer: event.pointerId, x: event.clientX - position.current.x, y: event.clientY - position.current.y };
    event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault();
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const active = drag.current;
    if (!active || event.pointerId !== active.pointer) return;
    position.current = { x: Math.min(active.maxX - active.left, Math.max(12 - active.left, event.clientX - active.x)),
      y: Math.min(active.maxY - active.top, Math.max(80 - active.top, event.clientY - active.y)) };
    if (frame.current === null) frame.current = requestAnimationFrame(paint);
  };
  const keyMove = (event: KeyboardEvent<HTMLButtonElement>) => {
    const delta = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] }[event.key];
    const area = bounds();
    if (!delta || !area) return;
    event.preventDefault();
    position.current = { x: Math.min(area.maxX - area.left, Math.max(12 - area.left, position.current.x + delta[0])),
      y: Math.min(area.maxY - area.top, Math.max(80 - area.top, position.current.y + delta[1])) };
    paint();
  };
  return { panelRef, start, move, keyMove, end: () => { drag.current = null; } };
}

/** An inert, short-lived copy of the outgoing view, kept only in this document. */
export function captureRouteSnapshot(content: HTMLElement, host: HTMLElement): void {
  const snapshot = content.cloneNode(true) as HTMLElement;
  snapshot.inert = true;
  snapshot.setAttribute('aria-hidden', 'true');
  const originals = [content, ...content.querySelectorAll<HTMLElement>('*')];
  const copies = [snapshot, ...snapshot.querySelectorAll<HTMLElement>('*')];
  const ids = new Map<string, string>();

  originals.forEach((original, index) => {
    const copy = copies[index];
    if (copy.id) {
      const id = `route-snapshot-${index}`;
      ids.set(copy.id, id);
      copy.id = id;
    }
    copy.removeAttribute('autofocus');
    if (original instanceof HTMLInputElement && copy instanceof HTMLInputElement) {
      copy.value = original.type === 'password' ? '' : original.value;
      copy.checked = original.checked;
    }
    if (original instanceof HTMLCanvasElement && copy instanceof HTMLCanvasElement) {
      try { copy.getContext('2d')?.drawImage(original, 0, 0); } catch { /* A protected canvas may not be copied. */ }
    }
  });
  // Keep SVG clips local to the copy and avoid duplicate live-page element IDs.
  copies.forEach(copy => {
    for (const attribute of [...copy.attributes]) {
      const value = attribute.value.replace(/url\(#([^)]+)\)/g, (match, id: string) =>
        ids.has(id) ? `url(#${ids.get(id)})` : match);
      if (value !== attribute.value) copy.setAttribute(attribute.name, value);
      if ((attribute.name === 'href' || attribute.name === 'xlink:href') && attribute.value.startsWith('#')) {
        const target = ids.get(attribute.value.slice(1));
        if (target) copy.setAttribute(attribute.name, `#${target}`);
      }
    }
  });
  snapshot.querySelectorAll('script, iframe').forEach(element => element.remove());
  host.append(snapshot);
  // Scroll offsets can only be restored once the copy participates in layout.
  originals.forEach((original, index) => {
    copies[index].scrollTop = original.scrollTop;
    copies[index].scrollLeft = original.scrollLeft;
  });
}

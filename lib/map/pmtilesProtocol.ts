import type { Protocol } from 'pmtiles';

// The pmtiles:// protocol handler is shared by every map surface and must be
// registered exactly once per page load. Callers must await this before a map
// is given any pmtiles:// source: MapLibre resolves protocols when a request is
// made, and for an unregistered scheme it falls back to fetching the pmtiles://
// URL itself — an AJAXError with status 0, and the tile never loads.
let protocolPromise: Promise<Protocol> | null = null;

export const ensurePmtilesProtocol = (maplibregl: any): Promise<Protocol> => {
  if (!protocolPromise) {
    protocolPromise = (async () => {
      const pmtiles = await import('pmtiles');
      const protocol = new pmtiles.Protocol();
      maplibregl.addProtocol('pmtiles', protocol.tile);
      return protocol;
    })().catch((error: unknown) => {
      // Don't cache a failed registration so the next style load can retry.
      protocolPromise = null;
      throw error;
    });
  }
  return protocolPromise;
};

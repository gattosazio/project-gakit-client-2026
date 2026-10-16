import { afterEach, describe, expect, it, vi } from 'vitest';

// Fresh module registry per test so the single-flight guard (module state) is
// exercised from scratch.
const loadHelper = async () => {
  vi.resetModules();
  return import('@/lib/map/pmtilesProtocol');
};

const mockPmtiles = () =>
  vi.doMock('pmtiles', () => ({
    Protocol: class {
      tile = () => {};
    },
  }));

afterEach(() => {
  vi.doUnmock('pmtiles');
  vi.resetModules();
});

describe('ensurePmtilesProtocol', () => {
  it('registers the pmtiles protocol once and shares the handler', async () => {
    mockPmtiles();
    const { ensurePmtilesProtocol } = await loadHelper();
    const maplibregl = { addProtocol: vi.fn() };

    const [first, second] = await Promise.all([
      ensurePmtilesProtocol(maplibregl),
      ensurePmtilesProtocol(maplibregl),
    ]);
    const third = await ensurePmtilesProtocol(maplibregl);

    expect(maplibregl.addProtocol).toHaveBeenCalledTimes(1);
    expect(maplibregl.addProtocol).toHaveBeenCalledWith('pmtiles', expect.any(Function));
    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it('retries after a failed registration', async () => {
    mockPmtiles();
    const { ensurePmtilesProtocol } = await loadHelper();
    const maplibregl = {
      addProtocol: vi.fn<(name: string, handler: unknown) => void>(),
    };

    maplibregl.addProtocol.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    await expect(ensurePmtilesProtocol(maplibregl)).rejects.toThrow('boom');

    await expect(ensurePmtilesProtocol(maplibregl)).resolves.toBeDefined();
    expect(maplibregl.addProtocol).toHaveBeenCalledTimes(2);
  });
});

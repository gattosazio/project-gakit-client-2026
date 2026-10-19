import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ScenarioData } from '@/types/scenario';

const directory = path.resolve(process.cwd(), 'public/data/scenarios');
const names = readdirSync(directory).filter(name => name.endsWith('.json'));

function hasNumericDepth(uri: string): boolean {
  const bytes = Buffer.from(uri.split(',')[1], 'base64');
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const size = bytes.readUInt32BE(offset);
    if (offset + size + 12 > bytes.length) return false;
    if (bytes.toString('ascii', offset + 4, offset + 8) === 'gdEP') {
      return size > 12 && bytes.toString('ascii', offset + 8, offset + 12) === 'GDK1';
    }
    offset += size + 12;
  }
  return false;
}

describe('bundled illustrative scenario integrity', () => {
  it.each(names)('%s has consistent rainfall and does not claim hydraulic validation', name => {
    const data = JSON.parse(readFileSync(path.join(directory, name), 'utf8')) as ScenarioData;
    expect(data.scenario_contract).toBe('static-illustration-v1');
    expect(data.is_calibrated).toBe(false);
    expect(data.official_total_mm).toBeNull();
    expect(data.model_notice).toContain('not been independently validated');
    expect(data.frames).toHaveLength(data.total_frames);
    let cents = 0;
    data.frames.forEach((frame, index) => {
      expect(frame.hour_index).toBe(index);
      expect(frame.hourly_rain_mm).toBeGreaterThanOrEqual(0);
      cents += Math.round(frame.hourly_rain_mm! * 100);
      expect(frame.cum_rain_mm).toBe(cents / 100);
      expect(frame.raster_uri).toMatch(/^data:image\/png;base64,/);
      expect(hasNumericDepth(frame.raster_uri), `${name} frame ${index} needs numeric depths`).toBe(true);
      expect(frame.q_peak_m3s).toBeNull();
    });
    expect(data.total_rainfall_mm).toBe(cents / 100);
  });
});

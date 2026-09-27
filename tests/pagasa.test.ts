import { describe, expect, it } from 'vitest';
import {
  hazardSummary,
  isPagasaAlert,
  otherProvinceCount,
  pagasaSubtitle,
  parseLocalTowns,
  shortTitle,
  timingShort,
} from '@/lib/weather/pagasa';
import type { WeatherAlert } from '@/types/weather';

const DESCRIPTION =
  'Thunderstorm Advisory No. 2 #MINPRSD\n' +
  'Issued at 02:00 PM 27 September 2026\n\n' +
  'Moderate to occasionally heavy rainshowers with lightning and strong winds are expected over ' +
  '#ZamboangaDelNorte(Gutalac, Baliguian), #ZamboangaCity, ' +
  '#LanaoDelNorte(Lala, Baroy, Tubod, Salvador, IliganCity, Matungao, Linamon, Baloi, Tagoloan, Pantar) ' +
  'within the next 1-2 hours.\n\n' +
  'The above conditions are being experienced in #ZamboangaSibugay(Titay, Ipil), ' +
  '#LanaoDelNorte(Kolambugan, Maigo, Kauswagan, Bacolod, Munai, Tangcal, Magsaysay, PoonaPiagapo, PantaoRagat), ' +
  '#Bukidnon(Talakag), #SultanKudarat(Isulan) and #TawiTawi(Mapun) which may persist within 1-2 hours.\n\n' +
  'All are advised to take precautionary measures against flash floods and landslides.';

function makeAlert(): WeatherAlert {
  return {
    id: 'pagasa-2',
    alertType: 'thunderstorm',
    severity: 'warning',
    validFrom: '2026-09-27T14:00:00+08:00',
    validTo: '2026-09-27T16:00:00+08:00',
    createdAt: '2026-09-27T14:00:00+08:00',
    data: {
      title: 'Thunderstorm Advisory No. 2 — DOST-PAGASA (Iligan & LDN)',
      description: DESCRIPTION,
      rawText: DESCRIPTION,
      source: 'DOST-PAGASA MINPRSD',
      bulletinNumber: 2,
      affectedAreas: [
        'LanaoDelNorte(Lala, Baroy, Tubod, Salvador, IliganCity, Matungao, Linamon, Baloi, Tagoloan, Pantar)',
        'LanaoDelNorte(Kolambugan, Maigo, Kauswagan, Bacolod, Munai, Tangcal, Magsaysay, PoonaPiagapo, PantaoRagat)',
      ],
    },
  } as WeatherAlert;
}

describe('shortTitle', () => {
  it('strips the redundant source and area suffix', () => {
    expect(shortTitle(makeAlert())).toBe('Thunderstorm Advisory No. 2');
  });
});

describe('parseLocalTowns', () => {
  it('expands both LDN tokens into readable towns with Iligan first', () => {
    const towns = parseLocalTowns(makeAlert());
    expect(towns).toHaveLength(19);
    expect(towns[0]).toBe('Iligan City');
    expect(towns).toContain('Poona Piagapo');
    expect(towns).toContain('Pantao Ragat');
  });
});

describe('hazardSummary', () => {
  it('keeps the verbatim hazard sentence and drops province hashtags', () => {
    const summary = hazardSummary(makeAlert());
    expect(summary).toContain('Moderate to occasionally heavy rainshowers with lightning');
    expect(summary).not.toContain('#');
  });

  it('drops the bulletin header and leftover comma runs', () => {
    const summary = hazardSummary(makeAlert());
    expect(summary).not.toContain('Issued at');
    expect(summary).not.toContain('No 2 Issued');
    expect(summary).not.toMatch(/,\s*,/);
    expect(summary).toContain('are expected within the next 1-2 hours.');
  });

  it('cleans an "over, and within" remnant', () => {
    const alert = {
      id: 'pagasa-7',
      alertType: 'thunderstorm',
      severity: 'warning',
      validFrom: '',
      validTo: '',
      createdAt: '',
      data: {
        title: 'Thunderstorm Advisory No. 7',
        description:
          'Light to Moderate to Occasionally Heavy rainshowers with lightning and strong winds ' +
          'are expected over #LanaoDelNorte(SultanNagaDimaporo), and within the next 1-2 hours.',
        rawText: '',
        source: 'DOST-PAGASA MINPRSD',
        affectedAreas: ['LanaoDelNorte(SultanNagaDimaporo)'],
      },
    } as WeatherAlert;
    const summary = hazardSummary(alert);
    expect(summary).not.toContain('over,');
    expect(summary).toContain('are expected within the next 1-2 hours.');
    expect(parseLocalTowns(alert)).toEqual(['Sultan Naga Dimaporo']);
  });

  it('notes already-occurring conditions', () => {
    expect(hazardSummary(makeAlert())).toContain(
      'Already occurring in some areas. May persist 1\u20132 hrs.'
    );
  });

  it('summarizes a heavy-rain warning without the color header', () => {
    const alert = {
      id: 'pagasa-hr',
      alertType: 'heavy_rain',
      severity: 'warning',
      validFrom: '',
      validTo: '',
      createdAt: '',
      data: {
        title: 'Heavy Rain Alert (Orange Warning)',
        description:
          'Heavy Rainfall Warning No. 04 #MINPRSD\nIssued at 11:00 AM 05 September 2026\n\n' +
          'ORANGE WARNING: #LanaoDelNorte(IliganCity, Bacolod). Flooding is THREATENING in low-lying areas.',
        rawText: '',
        source: 'DOST-PAGASA MINPRSD',
        affectedAreas: ['LanaoDelNorte(IliganCity, Bacolod)'],
      },
    } as WeatherAlert;
    expect(hazardSummary(alert)).toBe('Flooding is THREATENING in low-lying areas.');
  });
});

describe('timingShort', () => {
  it('condenses the validity window', () => {
    expect(timingShort(makeAlert())).toBe('next 1–2 hrs');
  });
});

describe('pagasaSubtitle', () => {
  it('gives hazard plus concrete expiry, no places', () => {
    const subtitle = pagasaSubtitle(makeAlert());
    expect(subtitle).toBe(
      'Moderate to heavy rainshowers with lightning and strong winds · until 04:00 PM'
    );
    expect(subtitle).not.toContain('Iligan');
  });
});

describe('otherProvinceCount', () => {
  it('counts provinces outside our area', () => {
    expect(otherProvinceCount(makeAlert())).toBeGreaterThan(3);
  });
});

describe('isPagasaAlert', () => {
  it('matches thunderstorm advisories but not the daily digest', () => {
    expect(isPagasaAlert(makeAlert())).toBe(true);
    expect(
      isPagasaAlert({ alertType: 'daily_digest', data: null } as unknown as WeatherAlert)
    ).toBe(false);
  });
});

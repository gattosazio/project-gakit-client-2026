const OPEN_METEO_URL = 'https://open-meteo.com/';
const PAGASA_MINPRSD_URL = 'https://bagong.pagasa.dost.gov.ph/regional-forecast/minprsd';

interface WeatherAttributionProps {
  source?: string | null;
  className?: string;
}

/**
 * Data attribution link:
 * - DOST-PAGASA MINPRSD for official regional advisories / warnings
 * - Open-Meteo (ECMWF) for numerical forecast data and daily digest
 */
export function WeatherAttribution({ source, className = '' }: WeatherAttributionProps) {
  const isPagasa = source === 'DOST-PAGASA MINPRSD' || source === 'DOST-PAGASA';

  if (isPagasa) {
    return (
      <a
        href={PAGASA_MINPRSD_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-block text-[10px] text-slate-400 hover:text-gakit-maroon hover:underline ${className}`}
        title="Official advisory by DOST-PAGASA Mindanao PRSD"
      >
        Source: DOST-PAGASA MINPRSD
      </a>
    );
  }

  return (
    <a
      href={OPEN_METEO_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-block text-[10px] text-slate-400 hover:text-gakit-maroon hover:underline ${className}`}
      title="Weather data by Open-Meteo.com — ECMWF model"
    >
      © Open-Meteo (ECMWF)
    </a>
  );
}

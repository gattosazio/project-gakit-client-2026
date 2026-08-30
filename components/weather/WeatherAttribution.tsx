const OPEN_METEO_URL = 'https://open-meteo.com/';

/**
 * Required attribution for Open-Meteo's free API tier (CC BY 4.0 data).
 * Forecasts come from their best_match blend, which leans on ECMWF
 * models for the Philippines.
 */
export function WeatherAttribution({ className = '' }: { className?: string }) {
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

'use client';

import { useScenarioDisplay } from '@/lib/map/scenarioDisplayStore';

export function ScenarioDepthLegend() {
  const { focusRoads } = useScenarioDisplay();
  return (
    <div role="region" aria-label="Map depth legend"
      className="hidden border-t border-slate-100 pt-2 md:block">
      <p className="mb-2 text-[11px] font-semibold text-slate-600">{focusRoads ? 'Estimated road depth' : 'Estimated depth'}</p>
      <div className="grid grid-cols-3 gap-0.5 text-center text-[10px] leading-4 tabular-nums text-slate-500">
        {[
          { color: '#EAB308', label: '< 0.5 m' },
          { color: '#F97316', label: '0.5–1.5 m' },
          { color: '#DC2626', label: '> 1.5 m' },
        ].map(({ color, label }) => <div key={label} className="flex flex-col gap-1 first:[&>span]:rounded-l-full last:[&>span]:rounded-r-full">
          <span aria-hidden="true" className="h-1" style={{ backgroundColor: color }} />{label}
        </div>)}
      </div>
    </div>
  );
}

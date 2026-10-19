'use client';

import { toast } from 'react-toastify';
import { Switch } from '@/components/ui/Switch';
import {
  scenarioDisplayStore,
  useScenarioDisplay,
} from '@/lib/map/scenarioDisplayStore';

const RENDER_MODES = [
  { value: 'linear', label: 'Smooth' },
  { value: 'nearest', label: 'Nearest' },
] as const;

export function DisplayPreferencesSection() {
  const prefs = useScenarioDisplay();

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-slate-700">Flood scenario shading</p>
        <p className="mt-0.5 text-xs text-slate-500">
          How flood scenario layers are interpolated on the map.
        </p>
        <div
          role="radiogroup"
          aria-label="Flood scenario shading"
          className="mt-2 inline-flex rounded-lg border border-canvas-grey bg-canvas-light p-1"
        >
          {RENDER_MODES.map((mode) => {
            const active = prefs.renderMode === mode.value;
            return (
              <button
                key={mode.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => scenarioDisplayStore.setRenderMode(mode.value)}
                className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${
                  active
                    ? 'bg-white text-gakit-maroon shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>

      <Switch
        label="3D terrain"
        description="Show terrain elevation beneath the scenario layer."
        checked={prefs.mode === '3d'}
        onChange={(enabled) => scenarioDisplayStore.setMode(enabled ? '3d' : '2d')}
      />
      <Switch
        label="3D buildings"
        description="Show building footprints in the scenario view."
        checked={prefs.enableBuildings}
        onChange={scenarioDisplayStore.setEnableBuildings}
      />
      <Switch
        label="Road network"
        description="Highlight the Iligan road network in the scenario view."
        checked={prefs.enableRoads}
        onChange={scenarioDisplayStore.setEnableRoads}
      />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            scenarioDisplayStore.reset();
            toast.success('Display settings reset');
          }}
          className="text-sm font-semibold text-slate-500 hover:text-gakit-maroon"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
}

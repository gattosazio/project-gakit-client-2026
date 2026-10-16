'use client';

import { MapDisplayPopover } from './MapDisplayPopover';
import { scenarioDisplayStore, useScenarioDisplay } from '@/lib/map/scenarioDisplayStore';

export function ScenarioDisplayPopover({ className = '' }: { className?: string }) {
  const { basemap, mode, enableBuildings, renderMode } = useScenarioDisplay();
  return <MapDisplayPopover basemap={basemap} mode={mode} showBuildings={enableBuildings} className={className}
    onBasemapChange={scenarioDisplayStore.setBasemap} onModeChange={scenarioDisplayStore.setMode}
    smoothPolygons={renderMode === 'linear'} onSmoothingChange={smooth => scenarioDisplayStore.setRenderMode(smooth ? 'linear' : 'nearest')}
    onBuildingsChange={scenarioDisplayStore.setEnableBuildings} />;
}

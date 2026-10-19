'use client';

import { MapDisplayPopover } from './MapDisplayPopover';
import { scenarioDisplayStore, useScenarioDisplay } from '@/lib/map/scenarioDisplayStore';

export function ScenarioDisplayPopover({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  const { basemap, mode, enableBuildings, enableRoads, renderMode, focusRoads } = useScenarioDisplay();
  return <MapDisplayPopover basemap={basemap} mode={mode} showBuildings={enableBuildings} showRoads={enableRoads} className={className}
    onBasemapChange={scenarioDisplayStore.setBasemap} onModeChange={scenarioDisplayStore.setMode}
    smoothPolygons={renderMode === 'linear'} onSmoothingChange={smooth => scenarioDisplayStore.setRenderMode(smooth ? 'linear' : 'nearest')}
    onBuildingsChange={scenarioDisplayStore.setEnableBuildings} onRoadsChange={scenarioDisplayStore.setEnableRoads}
    compact={compact} focusRoads={focusRoads} onFocusRoadsChange={scenarioDisplayStore.setFocusRoads} />;
}

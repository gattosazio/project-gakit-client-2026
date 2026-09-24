'use client';

import React, { useState } from 'react';
import { Layers, ChevronUp, ChevronDown } from 'lucide-react';

interface DepthLegendProps {
  presetType?: 'historical' | 'design_storm';
}

export function DepthLegend({ presetType = 'historical' }: DepthLegendProps) {
  const [collapsed, setCollapsed] = useState(false);
  const isStatic = presetType === 'design_storm';

  // Physical color mappings matching the pipeline raster generation
  const colors = isStatic
    ? {
        low: '#06B6D4',   // Cyan: < 0.5m
        med: '#3B82F6',   // Blue: 0.5 - 1.5m
        high: '#1E3A8A',  // Navy: > 1.5m
      }
    : {
        low: '#EAB308',   // Yellow: < 0.5m
        med: '#F97316',   // Orange: 0.5 - 1.5m
        high: '#DC2626',  // Red: > 1.5m
      };

  const gradient = `linear-gradient(to right, ${colors.low} 0%, ${colors.med} 50%, ${colors.high} 100%)`;

  return (
    <div className="hud-card pointer-events-auto shadow-lg text-slate-800 transition-all duration-200">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 px-2.5 pt-2 pb-1.5 border-b border-slate-100">
        <div className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-gakit-maroon shrink-0" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
            Water Depth
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium text-slate-400">
            {isStatic ? 'DOST-NOAH' : 'LiDAR 10m'}
          </span>
          <button
            type="button"
            onClick={() => setCollapsed((p) => !p)}
            className="sm:hidden text-slate-400 hover:text-slate-700 p-0.5"
            title={collapsed ? 'Expand legend' : 'Collapse legend'}
          >
            {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Legend Body */}
      {!collapsed && (
        <div className="p-2.5 pt-2 flex flex-col gap-1.5 min-w-[210px]">
          {/* Continuous gradient track */}
          <div
            className="h-2 w-full rounded-full shadow-inner"
            style={{ background: gradient }}
          />

          {/* Depth interval ticks and labels */}
          <div className="flex justify-between text-[10px] font-bold text-slate-700">
            <span>&lt; 0.5 m</span>
            <span>0.5 – 1.5 m</span>
            <span>&gt; 1.5 m</span>
          </div>

          <div className="flex justify-between text-[9px] text-slate-400 font-medium">
            <span>Low Hazard</span>
            <span>Medium</span>
            <span>High Hazard</span>
          </div>
        </div>
      )}
    </div>
  );
}

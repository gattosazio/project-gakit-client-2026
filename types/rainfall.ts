export interface RainfallFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    precip_mm: number;
  };
}

export interface RainfallResponse {
  type: 'FeatureCollection';
  properties: {
    source: string;
    observedAt: string;
    accumulationHours: number;
  };
  features: RainfallFeature[];
}

export interface RainfallGridFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  properties: {
    precip_mm: number;
  };
}

export interface RainfallGrid {
  type: 'FeatureCollection';
  features: RainfallGridFeature[];
}

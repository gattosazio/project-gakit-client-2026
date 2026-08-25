import type { FloodDepthCode } from '@/types/report';

export type FloodReference = 'adult' | 'motorcycle' | 'sedan' | 'suv' | 'jeepney' | 'bus';

export interface FloodReferenceLevel {
  depth: FloodDepthCode;
  label: string;
  waterLevel: number;
}

export interface FloodReferenceProfile {
  id: FloodReference;
  label: string;
  description: string;
  levels: FloodReferenceLevel[];
}

export const FLOOD_REFERENCE_PROFILES: FloodReferenceProfile[] = [
  {
    id: 'adult',
    label: 'Adult person',
    description: 'Use a standing adult as the reference.',
    levels: [
      { depth: 'ankle', label: 'Ankle level', waterLevel: 0.14 },
      { depth: 'knee', label: 'Knee level', waterLevel: 0.39 },
      { depth: 'waist', label: 'Waist level', waterLevel: 0.62 },
      { depth: 'head', label: 'Head level', waterLevel: 0.91 },
      { depth: 'overhead', label: 'Above head', waterLevel: 1 },
    ],
  },
  {
    id: 'motorcycle',
    label: 'Motorcycle',
    description: 'Compare the waterline against a typical motorcycle.',
    levels: [
      { depth: 'ankle', label: 'Tire axle', waterLevel: 0.2 },
      { depth: 'knee', label: 'Engine level', waterLevel: 0.36 },
      { depth: 'waist', label: 'Seat level', waterLevel: 0.57 },
      { depth: 'head', label: 'Above handlebars', waterLevel: 0.82 },
      { depth: 'overhead', label: 'Motorcycle submerged', waterLevel: 1 },
    ],
  },
  {
    id: 'sedan',
    label: 'Sedan',
    description: 'Compare the waterline against a typical sedan.',
    levels: [
      { depth: 'ankle', label: 'Wheel axle', waterLevel: 0.18 },
      { depth: 'knee', label: 'Bumper level', waterLevel: 0.3 },
      { depth: 'waist', label: 'Door-handle level', waterLevel: 0.52 },
      { depth: 'head', label: 'Roof level', waterLevel: 0.8 },
      { depth: 'overhead', label: 'Sedan submerged', waterLevel: 1 },
    ],
  },
  {
    id: 'suv',
    label: 'SUV',
    description: 'Compare the waterline against a typical SUV.',
    levels: [
      { depth: 'ankle', label: 'Wheel axle', waterLevel: 0.2 },
      { depth: 'knee', label: 'Bumper level', waterLevel: 0.34 },
      { depth: 'waist', label: 'Door-handle level', waterLevel: 0.57 },
      { depth: 'head', label: 'Roof level', waterLevel: 0.84 },
      { depth: 'overhead', label: 'SUV submerged', waterLevel: 1 },
    ],
  },
  {
    id: 'jeepney',
    label: 'Jeepney',
    description: 'Compare the waterline against a typical jeepney.',
    levels: [
      { depth: 'ankle', label: 'Wheel axle', waterLevel: 0.2 },
      { depth: 'knee', label: 'Entry step', waterLevel: 0.32 },
      { depth: 'waist', label: 'Passenger floor', waterLevel: 0.48 },
      { depth: 'head', label: 'Window level', waterLevel: 0.72 },
      { depth: 'overhead', label: 'Jeepney submerged', waterLevel: 1 },
    ],
  },
  {
    id: 'bus',
    label: 'Bus',
    description: 'Compare the waterline against a typical bus.',
    levels: [
      { depth: 'ankle', label: 'Wheel axle', waterLevel: 0.18 },
      { depth: 'knee', label: 'First step', waterLevel: 0.28 },
      { depth: 'waist', label: 'Passenger floor', waterLevel: 0.43 },
      { depth: 'head', label: 'Window level', waterLevel: 0.68 },
      { depth: 'overhead', label: 'Bus submerged', waterLevel: 1 },
    ],
  },
];

function ReferenceShape({ reference }: { reference: FloodReference }) {
  if (reference === 'adult') {
    return (
      <g fill="currentColor">
        <circle cx="100" cy="28" r="16" />
        <rect x="80" y="48" width="40" height="74" rx="12" />
        <rect x="59" y="55" width="17" height="62" rx="8" />
        <rect x="124" y="55" width="17" height="62" rx="8" />
        <rect x="82" y="118" width="16" height="72" rx="8" />
        <rect x="102" y="118" width="16" height="72" rx="8" />
      </g>
    );
  }

  if (reference === 'motorcycle') {
    return (
      <g fill="currentColor" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="58" cy="157" r="24" fill="none" />
        <circle cx="148" cy="157" r="24" fill="none" />
        <path d="M58 157 90 100h35l23 57M90 100l31 12 24-35M122 77h35" fill="none" />
        <path d="M84 100h37l-13-22H91z" stroke="none" />
      </g>
    );
  }

  if (reference === 'bus') {
    return (
      <g fill="currentColor">
        <rect x="32" y="38" width="136" height="124" rx="13" />
        <rect x="43" y="55" width="46" height="35" rx="4" fill="white" fillOpacity="0.75" />
        <rect x="97" y="55" width="57" height="35" rx="4" fill="white" fillOpacity="0.75" />
        <rect x="42" y="102" width="112" height="13" rx="4" fill="white" fillOpacity="0.35" />
        <circle cx="67" cy="162" r="19" fill="#475569" />
        <circle cx="137" cy="162" r="19" fill="#475569" />
      </g>
    );
  }

  const isSuv = reference === 'suv';
  const isJeepney = reference === 'jeepney';
  const bodyY = isSuv ? 77 : isJeepney ? 65 : 94;
  const bodyHeight = isSuv ? 67 : isJeepney ? 79 : 50;
  const roofY = isSuv ? 48 : isJeepney ? 39 : 67;
  const roofHeight = isSuv ? 43 : isJeepney ? 52 : 42;

  return (
    <g fill="currentColor">
      <path d={`M27 ${bodyY + bodyHeight}V${bodyY + 17}h29l24 ${roofY - bodyY + 17}h56l27 ${bodyY - roofY - 17}h18v${bodyHeight - 17}z`} />
      <rect x="76" y={roofY} width={isJeepney ? 74 : 55} height={roofHeight} rx="9" />
      <rect x="84" y={roofY + 9} width="23" height={roofHeight - 18} rx="3" fill="white" fillOpacity="0.75" />
      <rect x="113" y={roofY + 9} width="25" height={roofHeight - 18} rx="3" fill="white" fillOpacity="0.75" />
      <circle cx="65" cy="158" r="21" fill="#475569" />
      <circle cx="143" cy="158" r="21" fill="#475569" />
    </g>
  );
}

export function FloodReferenceIllustration({
  reference,
  waterLevel,
  label,
}: {
  reference: FloodReference;
  waterLevel: number;
  label: string;
}) {
  const waterY = 205 - Math.min(waterLevel, 1) * 185;

  return (
    <svg viewBox="0 0 200 210" className="h-52 w-full text-slate-400" role="img" aria-label={`${label} flood-depth reference`}>
      <ReferenceShape reference={reference} />
      <rect x="0" y={waterY} width="200" height={210 - waterY} fill="#38bdf8" fillOpacity="0.38" />
      <path d={`M0 ${waterY}H200`} stroke="#0284c7" strokeWidth="3" />
      <path d={`M0 ${waterY + 7}H200`} stroke="#7dd3fc" strokeWidth="2" strokeDasharray="5 5" />
    </svg>
  );
}

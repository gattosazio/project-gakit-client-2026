'use client';

const DOT_SIZES = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 10,
} as const;

const DOTS = 3;

export type SpinnerSize = keyof typeof DOT_SIZES;

export function Spinner({
  size = 'sm',
  className = '',
  iconClassName = '',
}: {
  size?: SpinnerSize;
  className?: string;
  iconClassName?: string;
}) {
  const dotSize = DOT_SIZES[size];
  const gap = Math.max(3, Math.round(dotSize * 0.6));
  const colorClass = iconClassName || 'bg-gakit-maroon';

  return (
    <span className={`inline-flex items-center ${className}`}>
      <span className="gakit-dots" role="status" aria-label="Loading" style={{ gap: `${gap}px` }}>
        {Array.from({ length: DOTS }).map((_, index) => (
          <span
            key={index}
            className={`gakit-dot ${colorClass}`}
            style={{
              width: `${dotSize}px`,
              height: `${dotSize}px`,
              animationDelay: `${index * 0.16}s`,
            }}
          />
        ))}
      </span>
    </span>
  );
}

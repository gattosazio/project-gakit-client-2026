import { writeFileSync } from 'node:fs';

// Abstract floodwater contours: decorative artwork, not geographic data.
const W = 1600;
const H = 1200;
const fmt = n => n.toFixed(1);
const paths = [];

// A diagonal current folds into two broad eddies. Tight lines at the banks
// open into calm channels, like water moving across a shallow floodplain.
for (let i = 0; i < 58; i++) {
  const t = i / 57;
  const y = -360 + t * 1770;
  const bend = 100 + 210 * Math.sin(t * Math.PI);
  const d = `M-160,${fmt(y + 170)} C170,${fmt(y + 290)} 260,${fmt(y - bend)} 610,${fmt(y - 60)} S1030,${fmt(y + 360)} 1300,${fmt(y + 80)} S1510,${fmt(y - 140)} 1770,${fmt(y - 40)}`;
  paths.push(`<path d="${d}" stroke-width="${i % 7 === 0 ? 1.8 : 0.8}" opacity="${i % 7 === 0 ? 0.48 : 0.23}"/>`);
}

const eddies = [];
for (const [cx, cy, rx, ry, angle, count] of [
  [1310, 140, 460, 235, -28, 26],
  [130, 1040, 560, 280, -25, 30],
]) {
  const rings = [];
  for (let i = 0; i < count; i++) {
    const s = 0.12 + (i / (count - 1)) ** 1.35 * 0.88;
    const pts = [];
    for (let j = 0; j <= 160; j++) {
      const a = j / 160 * Math.PI * 2;
      const ripple = 1 + 0.09 * Math.sin(a * 3 + s * 2) + 0.035 * Math.sin(a * 5);
      const x = rx * s * Math.cos(a) * ripple + s * s * 70 * Math.sin(a * 2);
      const y = ry * s * Math.sin(a) * ripple;
      pts.push(`${fmt(x)},${fmt(y)}`);
    }
    rings.push(`<path d="M${pts.join('L')}Z" stroke-width="${i % 6 === 0 ? 1.7 : 0.8}" opacity="${i % 6 === 0 ? 0.6 : 0.34}"/>`);
  }
  eddies.push(`<g transform="translate(${cx} ${cy}) rotate(${angle})">${rings.join('')}</g>`);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" fill="none">
<desc>Abstract flowing water contours and nested floodwater eddies.</desc>
<defs>
 <radialGradient id="quiet"><stop offset="0" stop-color="white" stop-opacity="0.12"/><stop offset="0.65" stop-color="white" stop-opacity="0.45"/><stop offset="1" stop-color="white"/></radialGradient>
 <mask id="flow"><rect width="1600" height="1200" fill="url(#quiet)"/><ellipse cx="1310" cy="140" rx="460" ry="235" transform="rotate(-28 1310 140)" fill="black"/><ellipse cx="130" cy="1040" rx="560" ry="280" transform="rotate(-25 130 1040)" fill="black"/></mask>
</defs>
<g stroke="#200007" stroke-linecap="round" stroke-linejoin="round">
 <g mask="url(#flow)">${paths.join('')}</g>
 ${eddies.join('')}
</g>
</svg>`;

writeFileSync(new URL('../public/images/backgrounds/about-topography.svg', import.meta.url), svg);

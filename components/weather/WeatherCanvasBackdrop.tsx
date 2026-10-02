'use client';

import { useEffect, useRef } from 'react';
import { isDaytimeInManila } from '@/lib/weather/weatherCodes';

interface WeatherCanvasBackdropProps {
  conditionCode: number;
  observedAt?: string;
  className?: string;
}

// ─── Atmospheric Entities ─────────────────────────────────────────────────────

interface DustMote {
  x: number;
  y: number;
  radius: number;
  speed: number;
  phase: number;
  swayFreq: number;
  baseAlpha: number;
}

interface Star {
  x: number;
  y: number;
  radius: number;
  colorType: 'white' | 'blue' | 'amber';
  baseAlpha: number;
  twinkleFreq: number;
  twinklePhase: number;
}

interface Meteor {
  active: boolean;
  startX: number;
  startY: number;
  progress: number;
  speed: number;
  length: number;
  angle: number;
  nextSpawnTime: number;
}

interface CloudInstance {
  x: number;
  relY: number;
  scale: number;
  speed: number;
  spriteIndex: number;
}

interface Raindrop {
  x: number;
  y: number;
  length: number;
  speed: number;
  width: number;
  alpha: number;
  layer: 'near' | 'far';
}

interface RainSplash {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  radius: number;
  life: number;
  maxLife: number;
}

interface LightningState {
  isFlashing: boolean;
  timer: number;
  nextStrikeTime: number;
  duration: number;
  intensity: number;
  epicenterX: number;
}

function pseudoRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Generates an authentic volumetric cloud sprite on an offscreen canvas
 * using multi-layered Gaussian vapor puffs (the industry standard technique).
 *
 * Supports daytime overcast (textured slate midtones with silver-white crests),
 * daytime fair-weather cumulus, and nocturnal silver-slate clouds.
 */
function createVolumetricCloudSprite(
  width: number,
  height: number,
  isDaytime: boolean,
  isOvercast: boolean,
  seed: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // 36 overlapping Gaussian aerosol puffs clustered organically across the width
  const puffCount = 36;

  for (let i = 0; i < puffCount; i++) {
    const cat = i < 16 ? 'core' : i < 28 ? 'crest' : 'flank';

    let px = 0;
    let py = 0;
    let r = 0;

    if (cat === 'core') {
      px = width * (0.08 + pseudoRandom(i * 13 + seed) * 0.84);
      py = height * (0.50 + pseudoRandom(i * 17 + seed) * 0.18);
      r = height * (0.36 + pseudoRandom(i * 23 + seed) * 0.14);
    } else if (cat === 'crest') {
      px = width * (0.12 + pseudoRandom(i * 29 + seed) * 0.76);
      py = height * (0.32 + pseudoRandom(i * 31 + seed) * 0.16);
      r = height * (0.28 + pseudoRandom(i * 37 + seed) * 0.12);
    } else {
      px = width * (0.04 + pseudoRandom(i * 41 + seed) * 0.92);
      py = height * (0.60 + pseudoRandom(i * 43 + seed) * 0.18);
      r = height * (0.22 + pseudoRandom(i * 47 + seed) * 0.10);
    }

    const grad = ctx.createRadialGradient(px, py - r * 0.15, 0, px, py, r);

    if (isOvercast && isDaytime) {
      // Daytime Overcast: Luminous pearl-white billows with delicate cool silver shading
      if (cat === 'crest') {
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.88)');
        grad.addColorStop(0.5, 'rgba(248, 250, 252, 0.50)');
        grad.addColorStop(1, 'rgba(241, 245, 249, 0)');
      } else if (cat === 'core') {
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.78)');
        grad.addColorStop(0.5, 'rgba(241, 245, 249, 0.45)');
        grad.addColorStop(1, 'rgba(226, 232, 240, 0)');
      } else {
        grad.addColorStop(0, 'rgba(226, 232, 240, 0.55)');
        grad.addColorStop(0.55, 'rgba(203, 213, 225, 0.22)');
        grad.addColorStop(1, 'rgba(203, 213, 225, 0)');
      }
    } else if (!isOvercast && isDaytime) {
      // Daytime Fair-weather Cumulus: Luminous sunny white billows with soft silver underside
      if (cat === 'crest') {
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
        grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.55)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      } else if (cat === 'core') {
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.82)');
        grad.addColorStop(0.55, 'rgba(248, 250, 252, 0.45)');
        grad.addColorStop(1, 'rgba(241, 245, 249, 0)');
      } else {
        grad.addColorStop(0, 'rgba(226, 232, 240, 0.48)');
        grad.addColorStop(0.55, 'rgba(203, 213, 225, 0.18)');
        grad.addColorStop(1, 'rgba(203, 213, 225, 0)');
      }
    } else {
      // Nocturnal Clouds: Moonlight silver-indigo crests with translucent midnight slate body
      if (cat === 'crest') {
        grad.addColorStop(0, 'rgba(224, 231, 255, 0.50)');
        grad.addColorStop(0.5, 'rgba(199, 210, 254, 0.22)');
        grad.addColorStop(1, 'rgba(148, 163, 184, 0)');
      } else if (cat === 'core') {
        grad.addColorStop(0, 'rgba(71, 85, 105, 0.40)');
        grad.addColorStop(0.55, 'rgba(51, 65, 85, 0.20)');
        grad.addColorStop(1, 'rgba(30, 41, 59, 0)');
      } else {
        grad.addColorStop(0, 'rgba(30, 41, 59, 0.35)');
        grad.addColorStop(0.55, 'rgba(15, 23, 42, 0.15)');
        grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      }
    }

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

/**
 * WeatherCanvasBackdrop: Master Photometric Atmospheric Simulation Engine
 *
 * Implements high-fidelity, realistic atmospheric rendering across all conditions:
 * - Clear Day: Rayleigh scattering, photometric solar corona, breathing god rays, Brownian dust motes.
 * - Clear Night: Astronomical multi-magnitude starfield with scintillation, crescent moon with earthshine halo, meteors.
 * - Mainly Clear: Sun/Moon sky with procedural volumetric cumulus cloud masses.
 * - Overcast: Multi-tier continuous stratocumulus cloud deck built from volumetric aerosol vapor sprites,
 *   gliding with calm horizontal wind currents (NO water ripples or sine waves);
 *   features a glowing veiled sun and solar halo by day, and a veiled moon with lunar halo by night (NO STARS).
 * - Rain & Showers: Dual-plane precipitation with wind vector slant, velocity motion blur, and bottom splash mists.
 * - Thunderstorm: Ominous tropospheric storm sky, heavy rain, and authentic 5-stage sheet lightning.
 */
export function WeatherCanvasBackdrop({
  conditionCode,
  observedAt,
  className = '',
}: WeatherCanvasBackdropProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Weather classification
  const isThunder = conditionCode >= 95 && conditionCode <= 99;
  const isRain =
    (conditionCode >= 51 && conditionCode <= 67) ||
    (conditionCode >= 80 && conditionCode <= 86);
  const isOvercast = conditionCode === 3;
  const isClearOrPartly =
    conditionCode === 0 || conditionCode === 1 || conditionCode === 2;
  const isPartly = conditionCode === 1 || conditionCode === 2;
  const isDaytime = isDaytimeInManila(observedAt ?? new Date().toISOString());

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animId: number | null = null;
    let width = 0;
    let height = 0;
    let lastTime = performance.now();
    let totalTime = 0;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ─── Pre-render Volumetric Cloud Sprites ─────────────────────────────────────
    // Cloud sprites with appropriate shading based on condition and daytime/nighttime
    const cloudSprites = [
      createVolumetricCloudSprite(320, 48, isDaytime, isOvercast, 101),
      createVolumetricCloudSprite(280, 44, isDaytime, isOvercast, 203),
      createVolumetricCloudSprite(240, 40, isDaytime, isOvercast, 307),
    ];

    // ─── Atmospheric Entity Instances ───────────────────────────────────────────

    // 1. Dust Motes (Clear Day)
    const dustMotes: DustMote[] = Array.from({ length: 16 }, (_, i) => ({
      x: pseudoRandom(i * 13 + 1) * 600,
      y: pseudoRandom(i * 17 + 2) * 120,
      radius: 0.75 + pseudoRandom(i * 23 + 3) * 0.9,
      speed: 7 + pseudoRandom(i * 31 + 4) * 12,
      phase: pseudoRandom(i * 37 + 5) * Math.PI * 2,
      swayFreq: 0.5 + pseudoRandom(i * 41 + 6) * 0.7,
      baseAlpha: 0.35 + pseudoRandom(i * 47 + 7) * 0.4,
    }));

    // 2. Stars (Clear Night)
    const stars: Star[] = Array.from({ length: 38 }, (_, i) => {
      const typeRoll = pseudoRandom(i * 7 + 1);
      const colorType: 'white' | 'blue' | 'amber' =
        typeRoll < 0.75 ? 'white' : typeRoll < 0.9 ? 'blue' : 'amber';
      const magRoll = pseudoRandom(i * 11 + 2);
      const radius = magRoll < 0.65 ? 0.6 + magRoll * 0.35 : magRoll < 0.88 ? 0.95 + (magRoll - 0.65) * 0.6 : 1.4;
      return {
        x: pseudoRandom(i * 19 + 3),
        y: pseudoRandom(i * 29 + 4) * 0.85,
        radius,
        colorType,
        baseAlpha: 0.35 + pseudoRandom(i * 31 + 5) * 0.55,
        twinkleFreq: 1.2 + pseudoRandom(i * 43 + 6) * 2.0,
        twinklePhase: pseudoRandom(i * 53 + 7) * Math.PI * 2,
      };
    });

    // 3. Meteor (Clear Night)
    const meteor: Meteor = {
      active: false,
      startX: 0,
      startY: 0,
      progress: 0,
      speed: 1.9,
      length: 60,
      angle: -0.55,
      nextSpawnTime: 5.0,
    };

    // 4. Partly Cloudy / Mainly Clear: 3 Drifting Cumulus Clouds
    // Positioned gracefully in the lower-mid atmosphere so the moon & sun remain unobstructed
    const partlyClouds: CloudInstance[] = [
      { x: 40, relY: 0.42, scale: 0.70, speed: 2.4, spriteIndex: 0 },
      { x: 280, relY: 0.48, scale: 0.80, speed: 3.0, spriteIndex: 1 },
      { x: 500, relY: 0.40, scale: 0.65, speed: 2.2, spriteIndex: 2 },
    ];

    // 5. Overcast Cloud Deck: Harmonized Horizontal Stratocumulus Blanket
    // Synchronized drift speed and locked spacing ensure the cloud canopy rolls cohesively
    // as an authentic, unbroken atmospheric ceiling without scattering or clumping.
    const OVERCAST_DECK_STEP = 240;
    const OVERCAST_DECK_COUNT = 5;
    const OVERCAST_TOTAL_SPAN = OVERCAST_DECK_STEP * OVERCAST_DECK_COUNT; // 1200px
    const OVERCAST_SPEED = 1.1; // Harmonized gentle drift speed (px/s)

    // Layer 1: Upper Stratocumulus Ceiling (Deep, broad canopy)
    const overcastUpperClouds: CloudInstance[] = Array.from(
      { length: OVERCAST_DECK_COUNT },
      (_, i) => ({
        x: i * OVERCAST_DECK_STEP - 80,
        relY: 0.28 + (i % 2) * 0.03, // Shifted down to fill the taller canvas (0.28 - 0.31)
        scale: 1.35 + (i % 3) * 0.08,
        speed: OVERCAST_SPEED,
        spriteIndex: i % 3,
      })
    );

    // Layer 2: Rolling Underside (Adds gentle billow texture across celestial mid-sky)
    const overcastLowerClouds: CloudInstance[] = Array.from(
      { length: OVERCAST_DECK_COUNT },
      (_, i) => ({
        x: i * OVERCAST_DECK_STEP + 40,
        relY: 0.40 + (i % 2) * 0.04, // Shifted down alongside upper deck (0.40 - 0.44)
        scale: 1.15 + (i % 2) * 0.10,
        speed: OVERCAST_SPEED,
        spriteIndex: (i + 1) % 3,
      })
    );

    // 6. Rain Drops & Splashes
    const raindrops: Raindrop[] = Array.from({ length: 50 }, (_, i) => {
      const isFar = i < 28;
      return {
        x: pseudoRandom(i * 19 + 1) * 800,
        y: pseudoRandom(i * 23 + 2) * 140 - 20,
        length: isFar ? 12 + pseudoRandom(i * 7) * 6 : 24 + pseudoRandom(i * 11) * 14,
        speed: isFar ? 260 + pseudoRandom(i * 13) * 60 : 420 + pseudoRandom(i * 17) * 100,
        width: isFar ? 1.0 : 1.5,
        alpha: isFar ? 0.3 + pseudoRandom(i * 29) * 0.2 : 0.6 + pseudoRandom(i * 31) * 0.3,
        layer: isFar ? 'far' : 'near',
      };
    });

    const rainSplashes: RainSplash[] = [];

    // 7. Lightning State
    const lightning: LightningState = {
      isFlashing: false,
      timer: 0,
      nextStrikeTime: 5.0,
      duration: 0.38,
      intensity: 0,
      epicenterX: 300,
    };

    // ─── Sizing & HiDPI Setup ───────────────────────────────────────────────────

    function updateSize() {
      if (!container || !canvas || !ctx) return;
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      width = rect.width;
      height = rect.height;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }

    const resizeObserver = new ResizeObserver(() => {
      updateSize();
      if (prefersReducedMotion) {
        drawFrame(0.016);
      }
    });
    resizeObserver.observe(container);
    updateSize();

    // ─── Weather Condition Renderers ────────────────────────────────────────────

    // ─── Weather Condition Renderers ────────────────────────────────────────────

    // Shared celestial coordinate focal point: positioned safely in the upper-mid sky
    // (horizontally clear of "Iligan City" on left and "Open Weather Forecast" on right)
    const celestialRelX = 0.58;
    const celestialRelY = 0.28;
    const celestialR = 9;

    /**
     * Unified Sun Renderer (Daytime: Clear, Mainly Clear, and Overcast)
     */
    function drawSun(
      sunX: number,
      sunY: number,
      sunR: number,
      isOvercastScene: boolean,
      time: number
    ) {
      if (!ctx) return;

      // 1. Soft Volumetric God Rays (Clear & Mainly Clear Day only)
      if (!isOvercastScene) {
        const rays = [
          { angle: 2.15, spread: 0.24, phase: 0.0, speed: 0.6 },
          { angle: 2.50, spread: 0.28, phase: 1.5, speed: 0.8 },
          { angle: 2.85, spread: 0.22, phase: 2.9, speed: 0.55 },
          { angle: 3.20, spread: 0.30, phase: 4.2, speed: 0.75 },
        ];
        const rayReach = Math.max(width, height) * 1.5;

        for (const ray of rays) {
          const sway = Math.sin(time * ray.speed * 0.3 + ray.phase) * 0.03;
          const currentAngle = ray.angle + sway;
          const alphaOsc = 0.55 + 0.45 * Math.sin(time * ray.speed + ray.phase);
          const rayAlpha = 0.07 * alphaOsc;

          const a1 = currentAngle - ray.spread * 0.5;
          const a2 = currentAngle + ray.spread * 0.5;

          const rayGrad = ctx.createRadialGradient(sunX, sunY, sunR, sunX, sunY, rayReach);
          rayGrad.addColorStop(0, `rgba(254, 240, 138, ${rayAlpha * 1.4})`);
          rayGrad.addColorStop(0.4, `rgba(253, 224, 71, ${rayAlpha * 0.7})`);
          rayGrad.addColorStop(1, 'rgba(252, 211, 77, 0)');

          ctx.fillStyle = rayGrad;
          ctx.beginPath();
          ctx.moveTo(sunX, sunY);
          ctx.lineTo(sunX + Math.cos(a1) * rayReach, sunY + Math.sin(a1) * rayReach);
          ctx.lineTo(sunX + Math.cos(a2) * rayReach, sunY + Math.sin(a2) * rayReach);
          ctx.closePath();
          ctx.fill();
        }
      }

      // 2. Solar Corona Halo
      const haloR = isOvercastScene ? 55 : 65;
      const coronaGrad = ctx.createRadialGradient(sunX, sunY, sunR * 0.3, sunX, sunY, haloR);
      if (isOvercastScene) {
        coronaGrad.addColorStop(0, 'rgba(254, 243, 199, 0.70)');
        coronaGrad.addColorStop(0.35, 'rgba(253, 230, 138, 0.30)');
        coronaGrad.addColorStop(0.75, 'rgba(254, 243, 199, 0.08)');
        coronaGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      } else {
        coronaGrad.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
        coronaGrad.addColorStop(0.18, 'rgba(254, 240, 138, 0.45)');
        coronaGrad.addColorStop(0.50, 'rgba(253, 224, 71, 0.15)');
        coronaGrad.addColorStop(1, 'rgba(251, 191, 36, 0)');
      }
      ctx.fillStyle = coronaGrad;
      ctx.beginPath();
      ctx.arc(sunX, sunY, haloR, 0, Math.PI * 2);
      ctx.fill();

      // 3. Solar Disc (Luminous photometric sun orb)
      ctx.save();
      ctx.fillStyle = isOvercastScene ? 'rgba(255, 254, 240, 0.88)' : '#ffffff';
      ctx.shadowColor = 'rgba(253, 224, 71, 0.90)';
      ctx.shadowBlur = isOvercastScene ? 10 : 14;
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    /**
     * Unified Moon Renderer (Nighttime: Clear, Mainly Clear, and Overcast)
     * Renders an authentic waxing crescent moon with earthshine disk across ALL nocturnal scenes.
     */
    function drawMoon(
      moonX: number,
      moonY: number,
      moonR: number,
      isOvercastScene: boolean
    ) {
      if (!ctx) return;

      // 1. Lunar Aura
      const auraR = isOvercastScene ? 50 : 42;
      const moonAura = ctx.createRadialGradient(moonX, moonY, 2, moonX, moonY, auraR);
      if (isOvercastScene) {
        moonAura.addColorStop(0, 'rgba(224, 231, 255, 0.45)');
        moonAura.addColorStop(0.40, 'rgba(199, 210, 254, 0.20)');
        moonAura.addColorStop(0.75, 'rgba(148, 163, 184, 0.06)');
        moonAura.addColorStop(1, 'rgba(15, 23, 42, 0)');
      } else {
        moonAura.addColorStop(0, 'rgba(224, 231, 255, 0.32)');
        moonAura.addColorStop(0.40, 'rgba(199, 210, 254, 0.12)');
        moonAura.addColorStop(1, 'rgba(199, 210, 254, 0)');
      }
      ctx.fillStyle = moonAura;
      ctx.beginPath();
      ctx.arc(moonX, moonY, auraR, 0, Math.PI * 2);
      ctx.fill();

      // 2. Earthshine (faint unlit lunar disk)
      ctx.fillStyle = isOvercastScene ? 'rgba(148, 163, 184, 0.10)' : 'rgba(148, 163, 184, 0.18)';
      ctx.beginPath();
      ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
      ctx.fill();

      // 3. Waxing Crescent Moon Arc (IDENTICAL shape across Clear, Mainly Clear, and Overcast)
      ctx.save();
      ctx.beginPath();
      ctx.arc(moonX, moonY, moonR, -Math.PI / 2, Math.PI / 2, false);
      ctx.arc(moonX - moonR * 0.45, moonY, moonR * 0.95, Math.PI / 2, -Math.PI / 2, true);
      ctx.closePath();

      const moonGrad = ctx.createLinearGradient(moonX - moonR, moonY - moonR, moonX + moonR, moonY + moonR);
      moonGrad.addColorStop(0, '#ffffff');
      moonGrad.addColorStop(0.7, '#e0e7ff');
      moonGrad.addColorStop(1, '#c7d2fe');
      ctx.fillStyle = moonGrad;
      ctx.shadowColor = 'rgba(224, 231, 255, 0.85)';
      ctx.shadowBlur = isOvercastScene ? 6 : 8;
      ctx.fill();
      ctx.restore();
    }

    /**
     * Unified Starfield Renderer (Clear Night and Overcast Night)
     * Renders twinkling multi-magnitude stars with atmospheric scintillation and bloom.
     */
    function drawStarfield(
      time: number,
      moonX: number,
      moonY: number,
      alphaMultiplier = 1.0
    ) {
      if (!ctx || width === 0 || height === 0) return;

      for (const star of stars) {
        const starX = star.x * width;
        const starY = star.y * height;

        const distToMoon = Math.hypot(starX - moonX, starY - moonY);
        if (distToMoon < 22) continue;

        const scint = prefersReducedMotion
          ? 1
          : 0.65 + 0.35 * Math.sin(time * star.twinkleFreq + star.twinklePhase);
        const alpha = star.baseAlpha * scint * alphaMultiplier;

        let color = `rgba(255, 255, 255, ${alpha})`;
        if (star.colorType === 'blue') color = `rgba(224, 242, 254, ${alpha})`;
        if (star.colorType === 'amber') color = `rgba(254, 243, 199, ${alpha})`;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(starX, starY, star.radius, 0, Math.PI * 2);
        ctx.fill();

        if (star.radius >= 1.2) {
          const bloom = ctx.createRadialGradient(starX, starY, 0, starX, starY, star.radius * 3.5);
          bloom.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.5})`);
          bloom.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = bloom;
          ctx.beginPath();
          ctx.arc(starX, starY, star.radius * 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    /**
     * Unified Atmospheric Particles Renderer (Day & Night)
     * Renders kinetic dust motes (by day) and luminous lunar vapor motes (by night).
     */
    function drawParticles(time: number, dt: number, isDay: boolean) {
      if (!ctx || width === 0 || height === 0) return;

      for (const mote of dustMotes) {
        if (!prefersReducedMotion) {
          mote.y -= mote.speed * dt;
          mote.x += Math.sin(time * mote.swayFreq + mote.phase) * 0.3;

          if (mote.y < -10) {
            mote.y = height + 10;
            mote.x = Math.random() * width;
          }
        }

        const alphaPulse = 0.7 + 0.3 * Math.sin(time * 1.5 + mote.phase);
        const currentAlpha = mote.baseAlpha * alphaPulse;

        const moteGrad = ctx.createRadialGradient(mote.x, mote.y, 0, mote.x, mote.y, mote.radius * 2.5);
        if (isDay) {
          moteGrad.addColorStop(0, `rgba(255, 255, 255, ${currentAlpha})`);
          moteGrad.addColorStop(0.4, `rgba(251, 191, 36, ${currentAlpha * 0.7})`);
          moteGrad.addColorStop(1, 'rgba(251, 191, 36, 0)');
        } else {
          moteGrad.addColorStop(0, `rgba(224, 231, 255, ${currentAlpha * 0.85})`);
          moteGrad.addColorStop(0.4, `rgba(165, 180, 252, ${currentAlpha * 0.5})`);
          moteGrad.addColorStop(1, 'rgba(99, 102, 241, 0)');
        }

        ctx.fillStyle = moteGrad;
        ctx.beginPath();
        ctx.arc(mote.x, mote.y, mote.radius * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    /**
     * 1. Clear Day / Mainly Clear Day
     */
    function renderClearDay(time: number, dt: number) {
      if (!ctx || width === 0 || height === 0) return;

      const sunX = width * celestialRelX;
      const sunY = height * celestialRelY;

      // Soft daylight sky wash (Identical day background tone)
      const skyGrad = ctx.createLinearGradient(0, 0, width, height);
      skyGrad.addColorStop(0, 'rgba(224, 242, 254, 0.35)');
      skyGrad.addColorStop(0.5, 'rgba(254, 243, 199, 0.22)');
      skyGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // Unified Sun (rays, corona, and photometric orb)
      drawSun(sunX, sunY, celestialR, false, time);

      // Mainly Clear: Volumetric Drifting Cumulus Clouds
      if (isPartly) {
        for (const cloud of partlyClouds) {
          if (!prefersReducedMotion) {
            cloud.x += cloud.speed * dt;
            const sprite = cloudSprites[cloud.spriteIndex] ?? cloudSprites[0];
            const scaledW = sprite.width * cloud.scale;
            if (cloud.x > width) {
              cloud.x = -scaledW;
            }
          }
          const sprite = cloudSprites[cloud.spriteIndex] ?? cloudSprites[0];
          const scaledW = sprite.width * cloud.scale;
          const scaledH = sprite.height * cloud.scale;
          ctx.drawImage(sprite, cloud.x, cloud.relY * height, scaledW, scaledH);
        }
      }

      // Microscopic Brownian Solar Dust Motes
      drawParticles(time, dt, true);
    }

    /**
     * 2. Clear Night / Mainly Clear Night
     */
    function renderClearNight(time: number, dt: number) {
      if (!ctx || width === 0 || height === 0) return;

      const moonX = width * celestialRelX;
      const moonY = height * celestialRelY;

      // Unified Crescent Moon
      drawMoon(moonX, moonY, celestialR, false);

      // Multi-Magnitude Starfield with Scintillation
      drawStarfield(time, moonX, moonY, 1.0);

      // Mainly Clear: Drifting Nocturnal Clouds
      if (isPartly) {
        for (const cloud of partlyClouds) {
          if (!prefersReducedMotion) {
            cloud.x += cloud.speed * dt;
            const sprite = cloudSprites[cloud.spriteIndex] ?? cloudSprites[0];
            const scaledW = sprite.width * cloud.scale;
            if (cloud.x > width) {
              cloud.x = -scaledW;
            }
          }
          const sprite = cloudSprites[cloud.spriteIndex] ?? cloudSprites[0];
          const scaledW = sprite.width * cloud.scale;
          const scaledH = sprite.height * cloud.scale;
          ctx.drawImage(sprite, cloud.x, cloud.relY * height, scaledW, scaledH);
        }
      }

      // Rare Meteor Streak (Shooting Star)
      if (!prefersReducedMotion) {
        if (!meteor.active && time >= meteor.nextSpawnTime) {
          meteor.active = true;
          meteor.startX = width * 0.2 + Math.random() * (width * 0.45);
          meteor.startY = height * 0.05 + Math.random() * (height * 0.3);
          meteor.progress = 0;
          meteor.length = 40 + Math.random() * 30;
          meteor.speed = 2.2 + Math.random() * 0.8;
          meteor.nextSpawnTime = time + 12 + Math.random() * 8;
        }

        if (meteor.active) {
          meteor.progress += meteor.speed * dt;
          if (meteor.progress >= 1.0) {
            meteor.active = false;
          } else {
            const headX = meteor.startX + Math.cos(meteor.angle) * meteor.progress * 130;
            const headY = meteor.startY + Math.sin(meteor.angle) * meteor.progress * 130;
            const tailX = headX - Math.cos(meteor.angle) * meteor.length;
            const tailY = headY - Math.sin(meteor.angle) * meteor.length;

            const meteorAlpha = Math.sin(meteor.progress * Math.PI) * 0.85;

            const meteorGrad = ctx.createLinearGradient(tailX, tailY, headX, headY);
            meteorGrad.addColorStop(0, 'rgba(165, 243, 252, 0)');
            meteorGrad.addColorStop(0.7, `rgba(165, 243, 252, ${meteorAlpha * 0.6})`);
            meteorGrad.addColorStop(1, `rgba(255, 255, 255, ${meteorAlpha})`);

            ctx.strokeStyle = meteorGrad;
            ctx.lineWidth = 1.4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(tailX, tailY);
            ctx.lineTo(headX, headY);
            ctx.stroke();
          }
        }
      }

      // Luminous Nocturnal Vapor Particles
      drawParticles(time, dt, false);
    }

    /**
     * 3. Overcast: Harmonized Horizontal Stratocumulus Blanket (Day & Night)
     * Continuous, cohesive cloud deck with synchronized horizontal drift.
     * Features consistent celestial placement (Sun by day, Crescent Moon by night),
     * identical background tones matching clear skies, soft starfield at night,
     * and living atmospheric particles across both day and night.
     */
    function renderOvercast(dt: number) {
      if (!ctx || width === 0 || height === 0) return;

      const celestialX = width * celestialRelX;
      const celestialY = height * celestialRelY;

      if (isDaytime) {
        // Soft daylight sky wash (Identical to Clear Day to maintain 100% background consistency)
        const skyGrad = ctx.createLinearGradient(0, 0, width, height);
        skyGrad.addColorStop(0, 'rgba(224, 242, 254, 0.35)');
        skyGrad.addColorStop(0.5, 'rgba(254, 243, 199, 0.22)');
        skyGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, width, height);

        // Veiled Sun behind clouds
        drawSun(celestialX, celestialY, celestialR, true, totalTime);
      } else {
        // Nocturnal: Transparent canvas preserves the exact midnight-indigo CSS card background.
        // Starfield peeking softly through the nocturnal overcast sky
        drawStarfield(totalTime, celestialX, celestialY, 0.85);

        // Veiled Crescent Moon behind clouds
        drawMoon(celestialX, celestialY, celestialR, true);
      }

      // Layer 1: Upper Stratocumulus Ceiling (Deep, broad canopy)
      ctx.save();
      ctx.globalAlpha = isDaytime ? 0.65 : 0.70;
      for (const cloud of overcastUpperClouds) {
        if (!prefersReducedMotion) {
          cloud.x += cloud.speed * dt;
          if (cloud.x > width + 100) {
            cloud.x -= OVERCAST_TOTAL_SPAN;
          }
        }
        const sprite = cloudSprites[cloud.spriteIndex] ?? cloudSprites[0];
        const scaledW = sprite.width * cloud.scale;
        const scaledH = sprite.height * cloud.scale;
        ctx.drawImage(sprite, cloud.x, cloud.relY * height, scaledW, scaledH);
      }
      ctx.restore();

      // Layer 2: Rolling Underside (Synchronized rolling billow base)
      ctx.save();
      ctx.globalAlpha = isDaytime ? 0.82 : 0.85;
      for (const cloud of overcastLowerClouds) {
        if (!prefersReducedMotion) {
          cloud.x += cloud.speed * dt;
          if (cloud.x > width + 100) {
            cloud.x -= OVERCAST_TOTAL_SPAN;
          }
        }
        const sprite = cloudSprites[cloud.spriteIndex] ?? cloudSprites[0];
        const scaledW = sprite.width * cloud.scale;
        const scaledH = sprite.height * cloud.scale;
        ctx.drawImage(sprite, cloud.x, cloud.relY * height, scaledW, scaledH);
      }
      ctx.restore();

      // Atmospheric Particles (Warm solar dust by day, silvery lunar vapor by night)
      drawParticles(totalTime, dt, isDaytime);
    }

    /**
     * 4. Rain & Showers: Dual-Plane Precipitation + Splashes
     */
    function renderRain(dt: number) {
      if (!ctx || width === 0 || height === 0) return;

      const angle = 0.24; // ~14 degrees wind slant
      const sinA = Math.sin(angle);
      const cosA = Math.cos(angle);

      for (const drop of raindrops) {
        if (!prefersReducedMotion) {
          drop.y += drop.speed * cosA * dt;
          drop.x -= drop.speed * sinA * dt;

          if (drop.y >= height) {
            if (drop.layer === 'near' && rainSplashes.length < 16) {
              rainSplashes.push({
                x: drop.x,
                y: height - 1,
                vx: (Math.random() - 0.5) * 22,
                vy: -14 - Math.random() * 18,
                alpha: 0.6,
                radius: 0.8 + Math.random() * 0.8,
                life: 0,
                maxLife: 0.22,
              });
            }

            drop.y = -drop.length - Math.random() * 20;
            drop.x = Math.random() * (width + 60);
          }
        }

        const tipX = drop.x;
        const tipY = drop.y + drop.length * cosA;
        const tailX = drop.x + drop.length * sinA;
        const tailY = drop.y;

        const dropGrad = ctx.createLinearGradient(tailX, tailY, tipX, tipY);
        dropGrad.addColorStop(0, 'rgba(186, 230, 253, 0)');
        dropGrad.addColorStop(0.6, `rgba(186, 230, 253, ${drop.alpha * 0.5})`);
        dropGrad.addColorStop(1, `rgba(224, 242, 254, ${drop.alpha})`);

        ctx.strokeStyle = dropGrad;
        ctx.lineWidth = drop.width;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();
      }

      if (!prefersReducedMotion) {
        for (let i = rainSplashes.length - 1; i >= 0; i--) {
          const splash = rainSplashes[i];
          splash.life += dt;
          if (splash.life >= splash.maxLife) {
            rainSplashes.splice(i, 1);
            continue;
          }

          splash.x += splash.vx * dt;
          splash.y += splash.vy * dt;
          splash.vy += 85 * dt;

          const progress = splash.life / splash.maxLife;
          const a = splash.alpha * (1 - progress);

          ctx.fillStyle = `rgba(186, 230, 253, ${a})`;
          ctx.beginPath();
          ctx.arc(splash.x, splash.y, splash.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    /**
     * 5. Thunderstorm: Ominous Troposphere + Multi-Stage Lightning + Heavy Rain
     */
    function renderThunderstorm(time: number, dt: number) {
      if (!ctx || width === 0 || height === 0) return;

      if (!prefersReducedMotion) {
        if (!lightning.isFlashing && time >= lightning.nextStrikeTime) {
          lightning.isFlashing = true;
          lightning.timer = 0;
          lightning.epicenterX = width * 0.25 + Math.random() * (width * 0.5);
          lightning.nextStrikeTime = time + 6.0 + Math.random() * 5.0;
        }

        if (lightning.isFlashing) {
          lightning.timer += dt;
          const t = lightning.timer;

          if (t < 0.04) {
            lightning.intensity = (t / 0.04) * 0.35;
          } else if (t < 0.07) {
            lightning.intensity = 0.1;
          } else if (t < 0.15) {
            lightning.intensity = 0.95;
          } else if (t < 0.21) {
            lightning.intensity = 0.65;
          } else if (t < lightning.duration) {
            const decayProgress = (t - 0.21) / (lightning.duration - 0.21);
            lightning.intensity = 0.65 * Math.exp(-decayProgress * 4.5);
          } else {
            lightning.isFlashing = false;
            lightning.intensity = 0;
          }
        }
      }

      // Base Ominous Storm Wash
      const stormGrad = ctx.createLinearGradient(0, 0, width, height);
      stormGrad.addColorStop(0, 'rgba(15, 23, 42, 0.18)');
      stormGrad.addColorStop(0.6, 'rgba(30, 27, 75, 0.12)');
      stormGrad.addColorStop(1, 'rgba(15, 23, 42, 0.04)');
      ctx.fillStyle = stormGrad;
      ctx.fillRect(0, 0, width, height);

      // Sheet Lightning Flash
      if (lightning.intensity > 0.01) {
        const epiX = lightning.epicenterX;
        const epiY = -height * 0.2;
        const flashR = Math.max(width, 400);

        const flashGrad = ctx.createRadialGradient(epiX, epiY, 10, epiX, epiY, flashR);
        flashGrad.addColorStop(0, `rgba(255, 255, 255, ${lightning.intensity * 0.6})`);
        flashGrad.addColorStop(0.3, `rgba(224, 231, 255, ${lightning.intensity * 0.4})`);
        flashGrad.addColorStop(0.65, `rgba(165, 180, 252, ${lightning.intensity * 0.2})`);
        flashGrad.addColorStop(1, 'rgba(99, 102, 241, 0)');

        ctx.fillStyle = flashGrad;
        ctx.fillRect(0, 0, width, height);
      }

      renderRain(dt);
    }

    // ─── Master Frame Dispatcher ────────────────────────────────────────────────

    function drawFrame(dt: number) {
      if (!ctx || width === 0 || height === 0) return;

      ctx.clearRect(0, 0, width, height);

      if (isThunder) {
        renderThunderstorm(totalTime, dt);
      } else if (isRain) {
        renderRain(dt);
      } else if (isOvercast) {
        renderOvercast(dt);
      } else if (isClearOrPartly) {
        if (isDaytime) {
          renderClearDay(totalTime, dt);
        } else {
          renderClearNight(totalTime, dt);
        }
      }
    }

    function animate(currentTime: number) {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.08);
      lastTime = currentTime;
      totalTime += dt;

      drawFrame(dt);

      if (!prefersReducedMotion) {
        animId = requestAnimationFrame(animate);
      }
    }

    if (prefersReducedMotion) {
      drawFrame(0.016);
    } else {
      animId = requestAnimationFrame(animate);
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        if (animId !== null) {
          cancelAnimationFrame(animId);
          animId = null;
        }
      } else if (!prefersReducedMotion && animId === null) {
        lastTime = performance.now();
        animId = requestAnimationFrame(animate);
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (animId !== null) {
        cancelAnimationFrame(animId);
      }
    };
  }, [
    conditionCode,
    isThunder,
    isRain,
    isOvercast,
    isClearOrPartly,
    isPartly,
    isDaytime,
  ]);

  return (
    <div
      ref={containerRef}
      className={`pointer-events-none absolute inset-0 overflow-hidden select-none z-0 ${className}`}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 block h-full w-full"
      />
    </div>
  );
}

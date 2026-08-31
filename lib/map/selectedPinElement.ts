/**
 * Factory function for creating the custom GAKIT matte droplet pin DOM element.
 */
export function createSelectedPinElement(): HTMLElement {
  const container = document.createElement('div');
  container.className =
    'gakit-selected-pin-container relative flex flex-col items-center pointer-events-none select-none';
  container.style.width = '28px';
  container.style.height = '38px';

  container.innerHTML = `
    <div class="relative flex flex-col items-center select-none pointer-events-none">
      <!-- Elevated Matte Pin Head with Drop-In Motion -->
      <div class="gakit-pin-drop relative z-10 flex h-9 w-7 items-start justify-center drop-shadow-[0_8px_16px_rgba(123,17,19,0.32)] drop-shadow-[0_2px_4px_rgba(15,23,42,0.18)]">
        <svg viewBox="0 0 28 36" class="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Matte Droplet Pin Body -->
          <path
            d="M14 0.75C6.96 0.75 1.25 6.46 1.25 13.5c0 9.2 12 21.05 12.35 21.38a0.6 0.6 0 0 0 0.8 0c0.35-0.33 12.35-12.18 12.35-21.38C26.75 6.46 21.04 0.75 14 0.75z"
            fill="#7B1113"
            stroke="#FFFFFF"
            stroke-width="1.75"
          />

          <!-- Pure White Center Target Disc -->
          <circle cx="14" cy="13.5" r="4.8" fill="#FFFFFF" />

          <!-- Center Maroon Precision Dot -->
          <circle cx="14" cy="13.5" r="2.4" fill="#7B1113" />
        </svg>
      </div>

      <!-- Ground Contact Shadow -->
      <div class="absolute -bottom-0.5 left-1/2 -translate-x-1/2 z-0 flex items-center justify-center pointer-events-none">
        <span class="h-1 w-3 -translate-y-1/2 rounded-full bg-slate-950/30 blur-[0.5px]"></span>
      </div>
    </div>
  `;

  return container;
}

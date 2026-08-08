'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';

export function PublicHeader() {
  const router = useRouter();

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-[1200] bg-white shadow-md border-b border-canvas-grey">
      <div className="h-16 px-4 md:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-0.05">
              <div className="flex h-8 w-20 items-center justify-center sm:h-9 sm:w-24 md:h-10 md:w-28 lg:h-20 lg:w-35">              <Image
                src="/images/gakit_logo2.svg"
                alt="GAKIT logo"
                width={160} 
                height={48}
                className="h-full w-full object-contain"
              />
            </div>
            <span className="hidden sm:block text-[11px] md:text-xs text-slate-600 font-medium leading-tight">
              Geohazard Assessment &amp;
              <br />
              Knowledge Integration Tool
            </span>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-1 text-sm font-semibold">
          <button
            onClick={() => scrollToSection('hazard-map')}
            className="px-3 py-2 text-slate-600 hover:text-gakit-maroon hover:bg-slate-50 rounded-lg transition-colors"
          >
            Hazard Map
          </button>
          <button
            onClick={() => scrollToSection('about')}
            className="px-3 py-2 text-slate-600 hover:text-gakit-maroon hover:bg-slate-50 rounded-lg transition-colors"
          >
            About
          </button>
          <button
            onClick={() => router.push('/login')}
            className="px-3 py-2 text-slate-600 hover:text-gakit-maroon hover:bg-slate-50 rounded-lg transition-colors"
          >
            Staff Portal
          </button>
        </nav>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-[1200] md:hidden bg-white border-t border-canvas-grey px-2 py-2 grid grid-cols-5 gap-1 text-xs font-semibold shadow-lg">
        <button
          onClick={() => scrollToSection('about')}
          className="py-2 text-slate-600 hover:text-gakit-maroon hover:bg-slate-50 rounded-lg transition-colors"
        >
          About
        </button>
        <button
          onClick={() => scrollToSection('hazard-map')}
          className="py-2 text-slate-600 hover:text-gakit-maroon hover:bg-slate-50 rounded-lg transition-colors"
        >
          Map
        </button>
        <button
          onClick={() => router.push('/login')}
          className="py-2 text-slate-600 hover:text-gakit-maroon hover:bg-slate-50 rounded-lg transition-colors"
        >
          Staff Portal
        </button>
      </nav>
    </header>
  );
}

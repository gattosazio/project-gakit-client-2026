'use client';

import { useRouter } from 'next/navigation';

export function PublicHeader() {
  const router = useRouter();

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-[1200] bg-gakit-maroon shadow-md border-b border-gakit-maroon">
      <div className="h-16 px-4 md:px-6 flex items-center justify-between">
        {/* Left: Project GAKIT */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
            <span className="text-gakit-maroon font-bold text-lg">GK</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-4xl md:text-4xl font-extrabold text-white leading-none">
              GAKIT
            </span>
            <span className="hidden sm:block text-[11px] md:text-xs text-white/80 font-medium leading-tight">
              Geohazard Assessment &amp;
              <br />
              Knowledge Integration Tool
            </span>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-1 text-sm font-semibold">
          <button
            onClick={() => scrollToSection('home')}
            className="px-3 py-2 text-white/90 hover:text-white hover:bg-white/15 rounded-lg transition-colors"
          >
            Home
          </button>
          <button
            onClick={() => scrollToSection('hazard-map')}
            className="px-3 py-2 text-white/90 hover:text-white hover:bg-white/15 rounded-lg transition-colors"
          >
            Hazard Map
          </button>
          <button
            onClick={() => scrollToSection('about')}
            className="px-3 py-2 text-white/90 hover:text-white hover:bg-white/15 rounded-lg transition-colors"
          >
            About
          </button>
          <button
            onClick={() => router.push('/login')}
            className="px-3 py-2 text-white/90 hover:text-white hover:bg-white/15 rounded-lg transition-colors"
          >
            Sign in
          </button>
        </nav>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-[1200] md:hidden bg-gakit-maroon border-t border-white/15 px-2 py-2 grid grid-cols-5 gap-1 text-xs font-semibold shadow-lg">
        <button
          onClick={() => scrollToSection('home')}
          className="py-2 text-white/90 hover:text-white hover:bg-white/15 rounded-lg transition-colors"
        >
          Home
        </button>
        <button
          onClick={() => scrollToSection('about')}
          className="py-2 text-white/90 hover:text-white hover:bg-white/15 rounded-lg transition-colors"
        >
          About
        </button>
        <button
          onClick={() => scrollToSection('hazard-map')}
          className="py-2 text-white/90 hover:text-white hover:bg-white/15 rounded-lg transition-colors"
        >
          Map
        </button>
        <button
          onClick={() => router.push('/login')}
          className="py-2 text-white/90 hover:text-white hover:bg-white/15 rounded-lg transition-colors"
        >
          Sign in
        </button>
      </nav>
    </header>
  );
}

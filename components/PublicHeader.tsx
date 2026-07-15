'use client';

import { useRouter } from 'next/navigation';

export function PublicHeader() {
  const router = useRouter();

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-[1200] bg-[#004aad] shadow-md border-b border-[#004aad]">
      <div className="h-16 px-4 md:px-6 flex items-center justify-between">
        {/* Left: Project GAKIT */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
            <span className="text-[#004aad] font-bold text-sm">GK</span>
          </div>
          <div>
            <div className="text-base md:text-lg font-bold text-white leading-tight">
              Project GAKIT
            </div>
            <div className="hidden sm:block text-xs text-white/80 font-medium">
              Geohazard Assessment & Knowledge Integration Tool
            </div>
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
            onClick={() => scrollToSection('about')}
            className="px-3 py-2 text-white/90 hover:text-white hover:bg-white/15 rounded-lg transition-colors"
          >
            About
          </button>
          <button
            onClick={() => scrollToSection('hazard-map')}
            className="px-3 py-2 text-white/90 hover:text-white hover:bg-white/15 rounded-lg transition-colors"
          >
            Hazard Map
          </button>
          <button
            onClick={() => router.push('/login')}
            className="px-3 py-2 text-white/90 hover:text-white hover:bg-white/15 rounded-lg transition-colors"
          >
            Sign in
          </button>
        </nav>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-[1200] md:hidden bg-[#004aad] border-t border-white/15 px-2 py-2 grid grid-cols-4 gap-1 text-xs font-semibold shadow-lg">
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

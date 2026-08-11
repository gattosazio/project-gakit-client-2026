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
      <div className="mx-auto flex h-16 items-center justify-center px-4 md:px-6">
        <div className="flex items-center justify-center gap-6 lg:gap-10">
          <button
            type="button"
            onClick={() => scrollToSection('hazard-map')}
            className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon focus-visible:ring-offset-2"
            aria-label="Go to the GAKIT hazard map"
          >
            <div className="flex h-10 w-24 items-center justify-center sm:w-28">
              <Image
                src="/images/gakit_logo2.svg"
                alt="GAKIT logo"
                width={160}
                height={48}
                className="h-full w-full object-contain"
              />
            </div>
            <span className="hidden text-left text-xs font-medium leading-tight text-slate-600 xl:block">
              Geohazard Assessment &amp;
              <br />
              Knowledge Integration Tool
            </span>
          </button>

          <nav className="hidden items-center gap-1 text-sm font-semibold md:flex">
            <button
              onClick={() => scrollToSection('about')}
              className="px-3 py-2 text-slate-600 hover:text-gakit-maroon hover:bg-slate-50 rounded-lg transition-colors"
            >
              About
            </button>
            <button
              onClick={() => router.push('/login')}
              className="rounded-full border border-maroon-800 bg-gakit-maroon px-5 py-2 text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-maroon-800 hover:shadow-md"
            >
              Login
            </button>
          </nav>
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-[1200] border-t border-canvas-grey bg-white px-2 py-2 text-xs font-semibold shadow-lg md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-2 gap-2">
          <button
            onClick={() => scrollToSection('about')}
            className="py-2 text-slate-600 hover:text-gakit-maroon hover:bg-slate-50 rounded-lg transition-colors"
          >
            About
          </button>
          <button
            onClick={() => router.push('/login')}
            className="rounded-lg bg-gakit-maroon py-2 text-white shadow-sm transition-colors hover:bg-maroon-800"
          >
            Login
          </button>
        </div>
      </nav>
    </header>
  );
}

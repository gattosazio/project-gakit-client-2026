'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function PublicHeader() {
  const router = useRouter();

  const handleLogin = () => {
    router.push('/login');
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-md border-b border-canvas-grey">
      <div className="h-16 px-6 flex items-center justify-between">
        {/* Left: Project GAKIT */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gakit-blue rounded-lg flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-sm">GK</span>
          </div>
          <div>
            <div className="text-lg font-bold text-slate-900 leading-tight">
              Project GAKIT
            </div>
            <div className="text-xs text-slate-600 font-medium">
              Geohazard Assessment & Knowledge Integration Tool
            </div>
          </div>
        </div>

        {/* Right: Login Button */}
        <button
          onClick={handleLogin}
          className="px-6 py-2 bg-gakit-blue hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 shadow-md"
        >
          Login
        </button>
      </div>
    </header>
  );
}

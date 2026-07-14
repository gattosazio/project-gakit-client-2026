'use client';

import { MapOff, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-canvas-grey flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center space-y-6">
        {/* 404 Icon */}
        <div className="flex justify-center">
          <div className="bg-amber-100 rounded-full p-4">
            <MapOff className="w-8 h-8 text-hazard-pending" />
          </div>
        </div>

        <div className="text-5xl font-bold text-hazard-pending">
          404
        </div>

        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Page Not Found
          </h1>
          <p className="text-slate-600">
            Sorry, we couldn't find the page you're looking for. The location might have moved or no longer exists.
          </p>
        </div>

        <button
          onClick={() => router.push('/')}
          className="w-full py-3 px-6 rounded-lg font-semibold text-white bg-gakit-blue hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <Home className="w-4 h-4" />
          Back to Home
        </button>

        <div className="pt-4 border-t border-canvas-grey">
          <p className="text-xs text-slate-500">
            If you believe this is a mistake, please contact support at support@gakit.ph
          </p>
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import 'react-toastify/dist/ReactToastify.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'GAKIT',
  description: 'Geohazard assessment and reporting tool',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* Warm up connections for the basemap so the map paints faster on first
            load: DNS/TLS for the tile + style hosts, and preload the style JSON
            so maplibre's fetch is served from cache. */}
        <link rel="preconnect" href="https://tiles.openfreemap.org" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://tiles.openfreemap.org" />
        <link rel="preconnect" href="https://api.maptiler.com" />
        <link rel="dns-prefetch" href="https://api.maptiler.com" />
        <link rel="dns-prefetch" href="https://nominatim.openstreetmap.org" />
        <link
          rel="preload"
          as="fetch"
          href="https://tiles.openfreemap.org/styles/bright"
          crossOrigin="anonymous"
        />
      </head>
      <body className="font-sans">
        {children}
        {/* ToastContainer will be added in a client component */}
      </body>
    </html>
  );
}

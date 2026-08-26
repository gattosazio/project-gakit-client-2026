import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import 'react-toastify/dist/ReactToastify.css';
import { ClientProviders } from './providers';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'GAKIT - Geohazard Assessment & Knowledge Integration Tool',
  description: 'Geohazard assessment & knowledge integration tool for geohazard risk management and decision support.',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '32x32' },
    ],
  },
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
        <ClientProviders />
      </body>
    </html>
  );
}

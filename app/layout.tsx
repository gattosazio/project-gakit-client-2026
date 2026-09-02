import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import 'react-toastify/dist/ReactToastify.css';
import { ClientProviders } from './providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
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
    <html lang="en" className={`${inter.variable} ${plusJakarta.variable}`}>
      <head>
        {/* Warm up connections for the basemap and terrain so the map paints faster on first load */}
        <link rel="preconnect" href="https://tiles.openfreemap.org" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://tiles.openfreemap.org" />
        <link rel="preconnect" href="https://tile.openstreetmap.org" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://tile.openstreetmap.org" />
        <link rel="preconnect" href="https://s3.amazonaws.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://s3.amazonaws.com" />
        <link rel="dns-prefetch" href="https://nominatim.openstreetmap.org" />
        <link
          rel="preload"
          as="fetch"
          href="https://tiles.openfreemap.org/styles/positron"
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

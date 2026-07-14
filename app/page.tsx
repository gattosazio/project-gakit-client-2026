'use client';

import { PublicViewPage } from './public-view/PublicViewPage';
import { ClientProviders } from './providers';

export default function Home() {
  return (
    <>
      <ClientProviders />
      <PublicViewPage />
    </>
  );
}

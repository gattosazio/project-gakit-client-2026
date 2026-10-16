'use client';

import React, { useEffect } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { RouteLoaderProvider } from '@/components/RouteLoader';
import { scenarioDisplayStore } from '@/lib/map/scenarioDisplayStore';

export function ClientProviders({ children }: { children?: React.ReactNode }) {
  // Restore persisted map-display preferences once, on the client, where
  // `localStorage` exists. Done here so the map honours them whichever route
  // the user lands on, not only after visiting Settings.
  useEffect(() => {
    scenarioDisplayStore.hydrate();
  }, []);

  return (
    <RouteLoaderProvider>
      {children}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </RouteLoaderProvider>
  );
}

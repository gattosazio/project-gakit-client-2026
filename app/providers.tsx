'use client';

import React from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { RouteLoaderProvider } from '@/components/RouteLoader';

export function ClientProviders({ children }: { children?: React.ReactNode }) {
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

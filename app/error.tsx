'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ErrorState';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to your error reporting service
    console.error('App Error:', error);
  }, [error]);

  return (
    <ErrorState
      title="Application Error"
      message="An unexpected error occurred in the application. Please try again."
      code="500"
      onRetry={reset}
      showHomeButton={true}
      showRetryButton={true}
    />
  );
}

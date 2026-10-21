export type GeolocationPermissionState =
  | 'granted'
  | 'prompt'
  | 'denied'
  | 'unsupported'
  | 'unknown';

export type GeolocationFailureCode =
  | 'unsupported'
  | 'denied'
  | 'timeout'
  | 'unavailable'
  | 'unknown';

export interface GeolocationFailure {
  code: GeolocationFailureCode;
  message: string;
  retryable: boolean;
}

export type GeolocationResult =
  | { ok: true; position: GeolocationPosition }
  | { ok: false; error: GeolocationFailure };

const DEFAULT_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 15000,
  maximumAge: 30000,
};

export function supportsGeolocation(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.geolocation);
}

/**
 * Reads the browser's geolocation permission without triggering a prompt.
 * Safari (and some embedded browsers) do not implement Permissions.query for
 * geolocation, so callers must treat `unknown` as "ask on the next gesture".
 */
export async function getGeolocationPermission(): Promise<GeolocationPermissionState> {
  if (!supportsGeolocation()) return 'unsupported';
  if (typeof navigator.permissions?.query !== 'function') return 'unknown';

  try {
    const status = await navigator.permissions.query({
      name: 'geolocation' as PermissionName,
    });
    return status.state as 'granted' | 'prompt' | 'denied';
  } catch {
    return 'unknown';
  }
}

function failureFor(error: GeolocationPositionError): GeolocationFailure {
  if (error.code === 1) {
    return {
      code: 'denied',
      message: 'To use your location, allow location access for this site.',
      retryable: false,
    };
  }
  if (error.code === 3) {
    return {
      code: 'timeout',
      message: 'Location request timed out. Please try again.',
      retryable: true,
    };
  }
  if (error.code === 2) {
    return {
      code: 'unavailable',
      message: "Couldn't get your location. Please try again.",
      retryable: true,
    };
  }
  return {
    code: 'unknown',
    message: "Couldn't get your location. Please try again.",
    retryable: true,
  };
}

/**
 * Requests one locating attempt, retrying transient failures once. Permission
 * errors are never retried because only a real user action can resolve them.
 */
export function requestCurrentPosition(
  options: PositionOptions = DEFAULT_OPTIONS
): Promise<GeolocationResult> {
  const attempt = (canRetry: boolean): Promise<GeolocationResult> =>
    new Promise((resolve) => {
      if (!supportsGeolocation()) {
        resolve({
          ok: false,
          error: {
            code: 'unsupported',
            message: 'Location sharing is not supported by this browser.',
            retryable: false,
          },
        });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ ok: true, position }),
        (error) => {
          const failure = failureFor(error);
          if (canRetry && failure.retryable) {
            void attempt(false).then(resolve);
            return;
          }
          resolve({ ok: false, error: failure });
        },
        options
      );
    });

  return attempt(true);
}

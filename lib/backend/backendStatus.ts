// Shared, module-level signal for backend reachability. The API request layer
// flips this to 'warming' when a retryable failure occurs (e.g. the free-tier
// server is cold-starting) and back to 'online' on the next successful request.
// UI components subscribe so they can show a "server is waking up" state
// without prop drilling through every component that talks to the backend.

export type BackendStatus = 'online' | 'warming';

let status: BackendStatus = 'online';
const listeners = new Set<() => void>();

export function getBackendStatus(): BackendStatus {
  return status;
}

export function subscribeBackendStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function markBackendWarming(): void {
  if (status === 'warming') return;
  status = 'warming';
  listeners.forEach((listener) => listener());
}

export function markBackendOnline(): void {
  if (status === 'online') return;
  status = 'online';
  listeners.forEach((listener) => listener());
}

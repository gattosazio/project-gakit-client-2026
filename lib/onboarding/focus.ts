/**
 * Move focus to an in-modal onboarding target without changing the form's
 * scroll position. The guide lives in the header, so dismissing or replaying it
 * must never jump the user to another part of the form.
 */
export function focusOnboardingTarget(element: HTMLElement | null): void {
  element?.focus({ preventScroll: true });
}

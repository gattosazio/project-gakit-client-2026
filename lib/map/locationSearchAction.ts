type LocationPromptMode = 'assessment' | 'report';

/** Global search pins a place; an explicit location picker completes its action. */
export function locationSearchAction({ mode, promptOpen, manualMode }: {
  mode: LocationPromptMode;
  promptOpen: boolean;
  manualMode: boolean;
}): LocationPromptMode | 'pin' {
  return promptOpen || manualMode || mode === 'report' ? mode : 'pin';
}

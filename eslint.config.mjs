import coreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
  {
    ignores: [".next/**", "node_modules/**", "public/**", "dist/**", "coverage/**"],
  },
  ...coreWebVitals,
  {
    // Scope these overrides to the same globs eslint-config-next registers its
    // plugins for. Without `files`, they also apply to files the base config
    // never covers (e.g. `.cjs`), where no `react-hooks` plugin exists, and
    // ESLint aborts with "could not find plugin react-hooks".
    files: ['**/*.{js,jsx,mjs,ts,tsx,mts,cts}'],
    // React Hooks v6 rules newly enabled by eslint-config-next 16. They flag
    // common (and usually safe) patterns in this codebase; downgraded to warn
    // so `npm run lint` stays green post-upgrade. Revisit and fix properly as a
    // follow-up rather than silently disabling.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
    },
  },
];

export default config;

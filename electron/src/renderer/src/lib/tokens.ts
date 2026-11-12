// lib/tokens.ts
// Puppy Omega One — dark theme tokens.
// Mirrors ant3869/electron-react-dark-starter src/renderer/src/lib/tokens.ts
// (central tokens object, components style from it, never hardcode colors).
// Ant's taste: polished, modern, dark-mode-first, relatively borderless,
// less excessively rounded — radius 8px, subtle 1px borders, orange accent.

export const tokens = {
  bg: {
    base: '#0b0e11',
    surface1: '#12161b',
    surface2: '#171d24',
    surface3: '#1f262e'
  },
  border: {
    default: '#232c35',
    subtle: '#1a2129'
  },
  text: {
    primary: '#e6e9ee',
    secondary: '#9aa4b0',
    tertiary: '#6b7683',
    disabled: '#4a545f'
  },
  accent: {
    primary: '#f5a524', // Omega orange
    hover: '#ffb940'
  },
  status: {
    pass: '#22c55e',
    fail: '#ef4444',
    running: '#f5a524',
    idle: '#6b7683'
  },
  radius: 8
};

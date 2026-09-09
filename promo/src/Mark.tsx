import React from 'react';

// The Oikotie mark: three steps and an arc that leaps past them.
// Inherits colour from `color`, like ui/icons/icon.svg.
export const Mark: React.FC<{ size: number; color?: string }> = ({ size, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" style={{ color, display: 'block' }}>
    <path d="M3.6 20.8 C4.2 7.4 19.5 3.6 26 11" fill="none" stroke="currentColor" strokeWidth={3.3} strokeLinecap="round" />
    <polygon points="30.4,16.5 22.9,13.5 29.1,8.5" fill="currentColor" />
    <circle cx={5} cy={27.6} r={3} fill="currentColor" />
    <circle cx={14.5} cy={27.6} r={3} fill="currentColor" />
    <circle cx={24} cy={27.6} r={3} fill="currentColor" />
  </svg>
);

import React from 'react';
import { T } from './theme';

// The Oikotie mark: an O whose corner is cut by the shortcut. Same artwork as
// ui/icons/icon.svg; `tile` lets it sit on a spruce ground of its own.
export const Mark: React.FC<{ size: number; tile?: string }> = ({ size, tile = T.ink }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" style={{ display: 'block', flex: '0 0 auto' }}>
    <rect width={32} height={32} rx={8} fill={tile} />
    <path d="M16 7.5A8.5 8.5 0 1 0 24.5 16" fill="none" stroke={T.page} strokeWidth={3.6} strokeLinecap="round" />
    <path d="M16 7.5L24.5 16" stroke={T.signal} strokeWidth={3.6} strokeLinecap="round" />
  </svg>
);

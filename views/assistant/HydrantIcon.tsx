import React from 'react';

/**
 * App-owned hydrant glyph.
 *
 * lucide-react has no hydrant; its FireExtinguisher is a different object and
 * would misread at a glance on a parking screen, so this is drawn here rather
 * than borrowed. Inherits currentColor and sizes like the lucide icons beside it.
 */
export const HydrantIcon = ({ size = 22 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.9}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {/* bonnet */}
    <path d="M9 6.5a3 3 0 0 1 6 0" />
    <path d="M8.5 6.5h7" />
    {/* barrel */}
    <path d="M9 6.5h6v9a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z" />
    {/* side outlets */}
    <path d="M9 10.5H7.2M15 10.5h1.8" />
    {/* base */}
    <path d="M7 20h10" />
    <path d="M9.5 17.5h5V20h-5z" />
  </svg>
);

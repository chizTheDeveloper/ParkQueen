import React from 'react';
import { TIER_VISUALS } from './crowns';

// Crown SVG path — 3-peak royal crown + base band, viewBox 0 0 24 20
const CROWN_PATH = 'M2 18 L2 9 L7 13 L12 2 L17 13 L22 9 L22 18 Z';
const BASE_RECT = { x: 2, y: 16, width: 20, height: 2.5, rx: 1 };

const GRADIENT_ID = 'crown-diamond-gradient';

interface CrownBadgeProps {
    tier: number;
    size?: number;
    className?: string;
}

export const CrownBadge: React.FC<CrownBadgeProps> = ({ tier, size = 16, className = '' }) => {
    const v = TIER_VISUALS[Math.min(tier, TIER_VISUALS.length - 1)];
    const glowPx = Math.max(3, Math.round(size * 0.22));
    const svgStyle = v.glow ? { filter: `drop-shadow(0 0 ${glowPx}px ${v.glow})` } : undefined;
    const fillAttr = v.fill === 'gradient' ? `url(#${GRADIENT_ID})` : v.fill;
    const isOutline = v.fill === 'none';

    return (
        <svg
            width={size}
            height={size * (20 / 24)}
            viewBox="0 0 24 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            style={svgStyle}
            aria-hidden="true"
        >
            {v.fill === 'gradient' && (
                <defs>
                    <linearGradient id={GRADIENT_ID} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%"   stopColor="#f59e0b" />
                        <stop offset="33%"  stopColor="#1e75ff" />
                        <stop offset="66%"  stopColor="#a855f7" />
                        <stop offset="100%" stopColor="#38bdf8" />
                    </linearGradient>
                </defs>
            )}
            <path
                d={CROWN_PATH}
                fill={fillAttr}
                stroke={isOutline ? v.stroke : undefined}
                strokeWidth={isOutline ? 1.4 : undefined}
                strokeLinejoin="round"
            />
            <rect
                {...BASE_RECT}
                fill={fillAttr}
                stroke={isOutline ? v.stroke : undefined}
                strokeWidth={isOutline ? 1.4 : undefined}
            />
        </svg>
    );
};

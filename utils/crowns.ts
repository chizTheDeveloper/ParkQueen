export const TITLE_THRESHOLDS = [
    { crowns: 0,    title: 'Newcomer',           tier: 0 },
    { crowns: 10,   title: 'Trusted Driver',      tier: 1 },
    { crowns: 50,   title: 'Street Scout',        tier: 2 },
    { crowns: 150,  title: 'Neighborhood Guide',  tier: 3 },
    { crowns: 400,  title: 'Parking Expert',      tier: 4 },
    { crowns: 750,  title: 'Block Captain',       tier: 5 },
    { crowns: 1500, title: 'Parking Veteran',     tier: 6 },
    { crowns: 3000, title: 'Urban Legend',        tier: 7 },
];

// Per-tier visual config: fill, glow, text color
export const TIER_VISUALS = [
    { fill: 'none',    stroke: '#6b7280', glow: null,                        textColor: '#9ca3af' }, // Newcomer — outline
    { fill: '#cd7f32', stroke: 'none',    glow: null,                        textColor: '#cd7f32' }, // Trusted Driver — bronze
    { fill: '#94a3b8', stroke: 'none',    glow: null,                        textColor: '#94a3b8' }, // Street Scout — silver
    { fill: '#f59e0b', stroke: 'none',    glow: 'rgba(245,158,11,0.55)',     textColor: '#f59e0b' }, // Neighborhood Guide — gold
    { fill: '#1e75ff', stroke: 'none',    glow: 'rgba(30,117,255,0.55)',     textColor: '#1e75ff' }, // Parking Expert — brand blue
    { fill: '#a855f7', stroke: 'none',    glow: 'rgba(168,85,247,0.55)',     textColor: '#a855f7' }, // Block Captain — purple
    { fill: '#e2e8f0', stroke: 'none',    glow: 'rgba(226,232,240,0.65)',    textColor: '#e2e8f0' }, // Parking Veteran — platinum
    { fill: 'gradient',stroke: 'none',    glow: 'rgba(56,189,248,0.65)',     textColor: '#38bdf8' }, // Urban Legend — diamond
];

export function getTierForCrowns(crowns: number): number {
    for (let i = TITLE_THRESHOLDS.length - 1; i >= 0; i--) {
        if (crowns >= TITLE_THRESHOLDS[i].crowns) return i;
    }
    return 0;
}

export function getTierForTitle(title: string): number {
    const idx = TITLE_THRESHOLDS.findIndex(t => t.title === title);
    return idx >= 0 ? idx : 0;
}

export function getTitleForCrowns(crowns: number): string {
    for (let i = TITLE_THRESHOLDS.length - 1; i >= 0; i--) {
        if (crowns >= TITLE_THRESHOLDS[i].crowns) return TITLE_THRESHOLDS[i].title;
    }
    return 'Newcomer';
}

export function getNextTitle(crowns: number): { title: string; crownsNeeded: number; tier: number } | null {
    for (const t of TITLE_THRESHOLDS) {
        if (crowns < t.crowns) return { title: t.title, crownsNeeded: t.crowns - crowns, tier: t.tier };
    }
    return null;
}

/** Progress within the current rank band, 0–100. Returns 100 at max rank. */
export function getProgressPct(crowns: number): number {
    const next = getNextTitle(crowns);
    if (!next) return 100;
    const thresholds = TITLE_THRESHOLDS.map(t => t.crowns);
    let prevThreshold = 0;
    for (let i = thresholds.length - 1; i >= 0; i--) {
        if (crowns >= thresholds[i]) { prevThreshold = thresholds[i]; break; }
    }
    const nextThreshold = crowns + next.crownsNeeded;
    const range = nextThreshold - prevThreshold;
    return range > 0 ? Math.min(((crowns - prevThreshold) / range) * 100, 100) : 0;
}

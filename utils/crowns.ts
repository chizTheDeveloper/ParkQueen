export const TITLE_THRESHOLDS = [
    { crowns: 0, title: 'Newcomer' },
    { crowns: 10, title: 'Trusted Driver' },
    { crowns: 50, title: 'Street Scout' },
    { crowns: 150, title: 'Neighborhood Guide' },
    { crowns: 400, title: 'Parking Expert' },
    { crowns: 750, title: 'Block Captain' },
    { crowns: 1500, title: 'Parking Veteran' },
    { crowns: 3000, title: 'Urban Legend' },
];

export function getTitleForCrowns(crowns: number): string {
    for (let i = TITLE_THRESHOLDS.length - 1; i >= 0; i--) {
        if (crowns >= TITLE_THRESHOLDS[i].crowns) return TITLE_THRESHOLDS[i].title;
    }
    return 'Newcomer';
}

export function getNextTitle(crowns: number): { title: string; crownsNeeded: number } | null {
    for (const t of TITLE_THRESHOLDS) {
        if (crowns < t.crowns) return { title: t.title, crownsNeeded: t.crowns - crowns };
    }
    return null;
}

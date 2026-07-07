// Timezone-safe date helpers for scheduled departure pickers.
// Do NOT use new Date("YYYY-MM-DD") — that parses as UTC midnight and shifts the
// day by the local offset (e.g. at 11 PM EDT, toISOString() gives tomorrow UTC).

export const localDateStr = (d: Date = new Date()): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Combine a "YYYY-MM-DD" date string with a Date that carries the desired hour/minute.
// The date portion comes from dateStr (local), the time from timeDate.getHours/Minutes().
export const combineDateAndTime = (dateStr: string, timeDate: Date): Date => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, timeDate.getHours(), timeDate.getMinutes(), 0, 0);
};

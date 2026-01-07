/**
 * ASCII Art US Map
 * Styled for terminal display with dim coloring
 * Designed to be ~100 characters wide for most terminals
 */

export const US_MAP_WIDTH = 100;
export const US_MAP_HEIGHT = 35;

// ASCII representation of continental US with textured interior
// Each character represents roughly a geographic point
// Interior is filled with dots (·) for terrain texture
export const usMapLines: string[] = [
    "                                                                                                    ",
    "                                          · · · · · · · · ·                                         ",
    "                 _______                 · · · · · · · · · · · ·                                    ",
    "              __/       \\__            · · · · · · · · · · · · · ·    ___                           ",
    "           __/             \\__       · · · · · · · · · · · · · · · · /   \\____                      ",
    "          /   · · · · · · ·   \\    · · · · · · · · · · · · · · · · ·/        \\__                    ",
    "         / · · · · · · · · · · \\__/· · · · · · · · · · · · · · · · /            \\                   ",
    "        | · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·|             \\____              ",
    "        | · · · · · · · · · · +---+· · · · · · · · · · · · · · · · |               \\  \\             ",
    "        | · · · · · · · · · · |    \\· · · · · · · · · · · · · · · ·|     +--+--+     \\ \\            ",
    "        | · · +----+----+ · · +-----+ · · · · · +----+· · · · · · ·|     |  |  | +--+ \\ |           ",
    "        | · · | · ·| · ·| · · | · · ·\\ · · · · ·| · ·+----+ · · · ·|  +--+--+--+ |  | |\\|           ",
    "        +----+· · ·| · ·+----+--------+ · · · ·+-----+ · ·+-----+ |     +-----+ +--+--+ RI          ",
    "        | · · · · · \\ · | · · · · · · | · · · ·+-----+· · +-----+ |     | · · |     | RI            ",
    "        | · · · · · ·\\ ·|· · · · · · · \\ · · · | · · |· · · · · · ||   |     |     |NJ\\              ",
    "        | · · · · · · +----+ · · · · · ·+· · · +----+------+ · · ·|    +--+--+-----+ NJ              ",
    "       / · · · · · · ·| · ·| · · · · · · \\ · · / · · | · · · \\· · ·|       |     |    \\               ",
    "      / · · · · · · · | · ·+----+ · · · · +---+------+------+ · · \\      +----+----+                ",
    "     | · · · · · · · ·| · ·| · ·| · · · · | · · | · ·| · · · | · · \\ · · |        \\               ",
    "     | · · · · · · · ·+----+· · +--------+------+----+-------+--\\----+---+ · · · · |              ",
    "     | · · · · · · · ·| · ·| · ·| · · · · · · · | · · · | · · · · ·\\       | · · · · \\             ",
    "      \\ · · __________|· · | · ·| · · · · · · · | · · · +-------+---\\------+ · · · · |            ",
    "       \\  / · · · · · | · ·+----+ · · · · · · · | · · · | · · · | · · \\ · · · · · · /             ",
    "        \\/· · · · · · | · ·| · ·+--------+------+------+-------+ · · · \\ · · · · ·/              ",
    "        | · · · · · · +----+· · | · · · · · · · | · · · | · · · | · · · ·\\--------/               ",
    "        | · · · · · · | · ·| · ·|· · · · · · · ·| · · · +-------+ · · · · | · · ·                 ",
    "        | · · · · · · | · ·+----+---------+-----+------+ · · · ·| · · · · / · · ·                 ",
    "         \\ · · · · · ·| · ·| · ·| · · · · | · · | · · ·| · · · ·+-------+ · · ·                  ",
    "          \\ · · · · · +----+· · | · · · · | · · +-----+-------+ · · · / · · ·                    ",
    "           \\ · · · · · · · | · ·| · · · · +------+ · · · · · ·/ · · ·/ · · · ·                    ",
    "            \\ · · · · · · ·+----+ · · · · · · · ·| · · · · · | · · / · · · · ·                    ",
    "             \\ · · · · · · · · ·| · · · · · · · ·| · · · · · | · ·/ · · · · · ·                   ",
    "              \\ · · · · · · · · | · · · · · · · ·| · · · · · | · / · · · · · · ·                  ",
    "               \\________________|_______________|___________|__/ · · · · · · · ·                 ",
    "                                                                                                    ",
];


// Pre-compute the clean map lines once at module load to avoid expensive regex on every render
const CLEAN_MAP_LINES = usMapLines.map(line => {
    // Single regex to replace all state abbreviations (much faster than 48 individual replaces)
    return line
        .replace(/\b(WA|OR|CA|NV|ID|MT|WY|UT|AZ|CO|NM|ND|SD|NE|KS|OK|TX|MN|IA|MO|AR|LA|WI|IL|IN|MI|OH|KY|TN|MS|AL|GA|FL|SC|NC|VA|WV|MD|DE|NJ|PA|NY|CT|RI|MA|VT|NH|ME)\b/g, '  ');
});

/**
 * Get a clean version of the map for rendering
 * Returns pre-computed result for optimal performance
 */
export function getCleanMap(): string[] {
    return CLEAN_MAP_LINES;
}

/**
 * Calculate the actual character position from percentage coordinates
 */
export function percentToMapPosition(xPercent: number, yPercent: number): { col: number; row: number } {
    const col = Math.round((xPercent / 100) * (US_MAP_WIDTH - 1));
    const row = Math.round((yPercent / 100) * (US_MAP_HEIGHT - 1));
    return { col: Math.max(0, Math.min(col, US_MAP_WIDTH - 1)), row: Math.max(0, Math.min(row, US_MAP_HEIGHT - 1)) };
}

/**
 * ASCII Art US Map
 * Styled for terminal display with dim coloring
 * Designed to be ~100 characters wide for most terminals
 */

export const US_MAP_WIDTH = 100;
export const US_MAP_HEIGHT = 35;

// ASCII representation of continental US
// Each character represents roughly a geographic point
export const usMapLines: string[] = [
    "                                                                                                    ",
    "                                          . . . . . . . . .                                         ",
    "                 _prior_                 . . . . . . . . . . . .                                    ",
    "              __prior__                . . . . . . . . . . . . . .    ___                           ",
    "           __/prior   \\__           . . . . . . . . . . . . . . . . /   \\____                      ",
    "          /     prior    \\        . . . . . . . . . . . . . . . . ./        \\__                    ",
    "         /                \\______/. . . . . . . . . . . . . . . . /            \\                   ",
    "        |                        . . . . . . . . . . . . . . . . .|             \\____              ",
    "        |    WA                 +---+. . . . . . . . . . . . . . |     VT  NH     \\  \\             ",
    "        |         MT            | ND \\. . . . . . . . . . . . . .|     +--+--+  MA  \\ \\            ",
    "        |    +----+----+        +-----+   MN    . . . . . . . . .| NY  |VT|NH| +--+  \\ |           ",
    "        | OR |    |    |  ID    |  ND  \\       +----+. . WI . . .|     +--+--+ |MA|  |\\|           ",
    "        +----+    | MT +--------+-------+  MN  | WI  +----+ MI  .|  +--+ NY +--+--+--+ RI          ",
    "        |        \\     |               |      +-----+    +-----+| PA +-----+  CT  | RI            ",
    "        |   OR    \\    |    WY          \\           |  MI       ||   |     | CT  NJ\\              ",
    "        |         +----+                 +    IA    +----+------+|   +--+--+-----+ NJ              ",
    "       /    NV    |    | WY               \\        /  IL | IN   \\|  PA   | NJ  DE \\               ",
    "      /           |    +----+              +------+------+------+\\      +----+----+                ",
    "     |            | UT |    |   NE         |  IL  | IN  | OH    | \\  MD |  DE     \\               ",
    "     |   NV       +----+    +--------------+------+-----+-------+--\\----+---+  MD  |              ",
    "     |            |    | CO |              |            |  WV   VA  \\       |       \\             ",
    "      \\    _______|    |    |     KS       |   MO       +-------+----\\------+   VA   |            ",
    "       \\  /   CA  | UT +----+              |            | KY    |     \\             /             ",
    "        \\/        |    |    +--------------+------+-----+-------+ VA   \\     NC    /              ",
    "        |         +----+ CO |              |            |   TN  |       \\---------/               ",
    "        | CA      |    |    |    OK        |  AR        +-------+   NC   |                        ",
    "        |         | AZ +----+--------------+------+-----+       |        /                        ",
    "         \\        |    |    |              |      |  MS | AL GA +-------+   SC                    ",
    "          \\       +----+ NM |      TX      |  LA  +-----+-------+      /                          ",
    "           \\           |    |              |      |            /  GA  /                           ",
    "            \\          +----+              +------+    AL     /      /                            ",
    "             \\ AZ           |                    |           |  FL  /                             ",
    "              \\        NM   |         TX         |     FL    |     /                              ",
    "               \\____________|____________________|___________|____/                               ",
    "                                                                                                    ",
];

/**
 * Get a clean version of the map for rendering
 * Replaces state abbreviations with spaces for cleaner look
 */
export function getCleanMap(): string[] {
    const stateAbbrevs = [
        'WA', 'OR', 'CA', 'NV', 'ID', 'MT', 'WY', 'UT', 'AZ', 'CO', 'NM',
        'ND', 'SD', 'NE', 'KS', 'OK', 'TX', 'MN', 'IA', 'MO', 'AR', 'LA',
        'WI', 'IL', 'IN', 'MI', 'OH', 'KY', 'TN', 'MS', 'AL', 'GA', 'FL',
        'SC', 'NC', 'VA', 'WV', 'MD', 'DE', 'NJ', 'PA', 'NY', 'CT', 'RI',
        'MA', 'VT', 'NH', 'ME'
    ];

    return usMapLines.map(line => {
        let cleaned = line;
        stateAbbrevs.forEach(abbrev => {
            cleaned = cleaned.replace(new RegExp(`\\b${abbrev}\\b`, 'g'), '  ');
        });
        // Also clean up "prior" placeholders
        cleaned = cleaned.replace(/prior/g, '     ');
        return cleaned;
    });
}

/**
 * Calculate the actual character position from percentage coordinates
 */
export function percentToMapPosition(xPercent: number, yPercent: number): { col: number; row: number } {
    const col = Math.round((xPercent / 100) * (US_MAP_WIDTH - 1));
    const row = Math.round((yPercent / 100) * (US_MAP_HEIGHT - 1));
    return { col: Math.max(0, Math.min(col, US_MAP_WIDTH - 1)), row: Math.max(0, Math.min(row, US_MAP_HEIGHT - 1)) };
}
